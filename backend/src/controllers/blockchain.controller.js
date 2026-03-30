// backend/src/controllers/blockchain.controller.js

const {
  auditTransaction,
  verifyTransaction,
  verifyChain,
  hashTransaction,
} = require('../services/blockchain.service');

const Transaction = require('../models/Transaction.model');
const AuditTrail  = require('../models/AuditTrail.model');

//─────────────────────────────────────
// POST /api/blockchain/audit/:transactionId
// Hash and audit a single transaction
//─────────────────────────────────────
const auditOne = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({
      _id:    req.params.transactionId,
      userId: req.user._id,
    });

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    const audit = await auditTransaction(transaction);

    return res.status(200).json({
      success: true,
      message: 'Transaction audited and added to blockchain.',
      data: {
        blockIndex:   audit.blockIndex,
        hash:         audit.hash,
        chainHash:    audit.chainHash,
        previousHash: audit.previousHash,
        auditedAt:    audit.createdAt,
        onChain:      audit.onChain,
      },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// POST /api/blockchain/audit-all
// Audit all un-audited transactions
//─────────────────────────────────────
const auditAll = async (req, res, next) => {
  try {
    // Find all transactions not yet in audit trail
    const audited = await AuditTrail.find({ userId: req.user._id })
      .distinct('transactionId');

    const transactions = await Transaction.find({
      userId:     req.user._id,
      isDeleted:  false,
      _id:        { $nin: audited },
    }).sort({ createdAt: 1 });

    if (transactions.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'All transactions are already audited.',
        data: { audited: 0 },
      });
    }

    let count = 0;
    for (const txn of transactions) {
      await auditTransaction(txn);
      count++;
    }

    return res.status(200).json({
      success: true,
      message: `${count} transaction(s) added to blockchain.`,
      data: { audited: count },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// GET /api/blockchain/verify/:transactionId
// Verify a transaction's integrity
//─────────────────────────────────────
const verifyOne = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({
      _id:    req.params.transactionId,
      userId: req.user._id,
    });

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    const result = await verifyTransaction(req.params.transactionId);

    return res.status(200).json({
      success: true,
      data:    result,
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// GET /api/blockchain/verify-chain
// Verify entire chain for current user
//─────────────────────────────────────
const verifyFullChain = async (req, res, next) => {
  try {
    const result = await verifyChain(req.user._id);

    return res.status(200).json({
      success: true,
      data:    result,
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// GET /api/blockchain/trail
// Get audit trail (paginated)
//─────────────────────────────────────
const getAuditTrail = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1'));
    const limit = Math.min(50, parseInt(req.query.limit || '20'));
    const skip  = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      AuditTrail.find({ userId: req.user._id })
        .sort({ blockIndex: -1 })
        .skip(skip)
        .limit(limit)
        .populate('transactionId', 'type amount merchant categoryName date')
        .lean(),
      AuditTrail.countDocuments({ userId: req.user._id }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        entries,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// GET /api/blockchain/stats
// Blockchain stats for current user
//─────────────────────────────────────
const getStats = async (req, res, next) => {
  try {
    const [total, onChain, latest] = await Promise.all([
      AuditTrail.countDocuments({ userId: req.user._id }),
      AuditTrail.countDocuments({ userId: req.user._id, 'onChain.isOnChain': true }),
      AuditTrail.findOne({ userId: req.user._id })
        .sort({ blockIndex: -1 }).lean(),
    ]);

    const totalTxns = await Transaction.countDocuments({
      userId: req.user._id, isDeleted: false,
    });

    return res.status(200).json({
      success: true,
      data: {
        totalAudited:    total,
        totalOnChain:    onChain,
        totalTransactions: totalTxns,
        unaudited:       totalTxns - total,
        latestBlock:     latest?.blockIndex || 0,
        latestHash:      latest?.chainHash  || null,
        chainNetwork:    env.blockchain.enabled ? 'polygon-amoy' : 'local-hashchain',
        polygonReady:    Boolean(env.blockchain.signerKey),
      },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// GET /api/blockchain/proof/:transactionId
// Generate proof of spending (shareable)
//─────────────────────────────────────
const getProof = async (req, res, next) => {
  try {
    const audit = await AuditTrail.findOne({
      transactionId: req.params.transactionId,
      userId:        req.user._id,
    }).lean();

    if (!audit) {
      return res.status(404).json({
        success: false,
        message: 'No proof found. Audit this transaction first.',
      });
    }

    const verification = await verifyTransaction(req.params.transactionId);

    return res.status(200).json({
      success: true,
      data: {
        proof: {
          transactionId: req.params.transactionId,
          blockIndex:    audit.blockIndex,
          hash:          audit.hash,
          chainHash:     audit.chainHash,
          snapshot:      audit.snapshot,
          auditedAt:     audit.createdAt,
          verified:      verification.verified,
          onChain:       audit.onChain,
          certificate: `SpendWise Proof of Spending
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Transaction ID : ${req.params.transactionId}
Block Index    : ${audit.blockIndex}
Amount         : ${audit.snapshot?.currency} ${audit.snapshot?.amount}
Merchant       : ${audit.snapshot?.merchant || 'N/A'}
Date           : ${new Date(audit.snapshot?.date).toLocaleDateString('en-IN')}
Hash           : ${audit.hash}
Chain Hash     : ${audit.chainHash}
Audited At     : ${new Date(audit.createdAt).toLocaleString('en-IN')}
Status         : ${verification.verified ? '✅ VERIFIED' : '❌ TAMPERED'}
Network        : ${audit.onChain?.isOnChain ? `Polygon (${audit.onChain.txHash})` : 'Local Hash Chain'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const { env } = require('../config/env');

module.exports = {
  auditOne,
  auditAll,
  verifyOne,
  verifyFullChain,
  getAuditTrail,
  getStats,
  getProof,
};