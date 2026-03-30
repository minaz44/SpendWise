// backend/src/services/blockchain.service.js

const crypto     = require('crypto');
const AuditTrail = require('../models/AuditTrail.model');
const Transaction = require('../models/Transaction.model');
const { env }    = require('../config/env');

//─────────────────────────────────────
// HASH HELPERS
//─────────────────────────────────────

/**
 * Create a deterministic SHA256 hash of a transaction
 */
const hashTransaction = (transaction) => {
  const data = JSON.stringify({
    id:           transaction._id?.toString(),
    userId:       transaction.userId?.toString(),
    type:         transaction.type,
    amount:       transaction.amount,
    currency:     transaction.currency,
    merchant:     transaction.merchant,
    categoryName: transaction.categoryName,
    date:         transaction.date,
    source:       transaction.source,
    createdAt:    transaction.createdAt,
  });

  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Create chain hash — links this block to previous
 */
const createChainHash = (hash, previousHash) => {
  return crypto
    .createHash('sha256')
    .update(`${hash}${previousHash}`)
    .digest('hex');
};

//─────────────────────────────────────
// CORE — Add transaction to audit chain
//─────────────────────────────────────

/**
 * Hash a transaction and add it to the audit trail
 * @param {object} transaction - Mongoose transaction document
 * @returns {object} - AuditTrail entry
 */
const auditTransaction = async (transaction) => {
  try {
    // Check if already audited
    const existing = await AuditTrail.findOne({ transactionId: transaction._id });
    if (existing) return existing;

    // Get last block for this user
    const lastBlock = await AuditTrail.findOne({ userId: transaction.userId })
      .sort({ blockIndex: -1 })
      .lean();

    const blockIndex    = lastBlock ? lastBlock.blockIndex + 1 : 1;
    const previousHash  = lastBlock ? lastBlock.chainHash : '0'.repeat(64);
    const hash          = hashTransaction(transaction);
    const chainHash     = createChainHash(hash, previousHash);

    // Create audit entry
    const audit = await AuditTrail.create({
      userId:        transaction.userId,
      transactionId: transaction._id,
      hash,
      previousHash,
      chainHash,
      blockIndex,
      snapshot: {
        type:         transaction.type,
        amount:       transaction.amount,
        currency:     transaction.currency,
        merchant:     transaction.merchant,
        categoryName: transaction.categoryName,
        date:         transaction.date,
        source:       transaction.source,
        userId:       transaction.userId?.toString(),
      },
    });

    // Update transaction with hash reference
    await Transaction.findByIdAndUpdate(transaction._id, {
      'blockchainData.txHash':    chainHash,
      'blockchainData.network':   'local-hashchain',
      'blockchainData.auditedAt': new Date(),
    });

    // Try Polygon on-chain if enabled
    if (env.blockchain.enabled && env.blockchain.signerKey) {
      submitToPolygon(audit).catch(err =>
        console.warn('⚠️ Polygon submission failed (non-critical):', err.message)
      );
    }

    return audit;
  } catch (error) {
    console.error('Audit trail error:', error.message);
    throw error;
  }
};

//─────────────────────────────────────
// VERIFY — Check transaction integrity
//─────────────────────────────────────

/**
 * Verify a transaction has not been tampered with
 * @param {string} transactionId
 * @returns {object} - verification result
 */
const verifyTransaction = async (transactionId) => {
  const audit = await AuditTrail.findOne({ transactionId }).lean();

  if (!audit) {
    return {
      verified:  false,
      reason:    'No audit record found for this transaction.',
      audited:   false,
    };
  }

  // Fetch current transaction
  const transaction = await Transaction.findById(transactionId)
    .setOptions({ includeDeleted: true })
    .lean();

  if (!transaction) {
    return { verified: false, reason: 'Transaction not found.', audited: true };
  }

  // Recompute hash from current data
  const currentHash = hashTransaction(transaction);

  // Compare with stored hash
  const isIntact = currentHash === audit.hash;

  // Verify chain link
  const expectedChainHash = createChainHash(audit.hash, audit.previousHash);
  const chainIntact       = expectedChainHash === audit.chainHash;

  return {
    verified:    isIntact && chainIntact,
    hashMatch:   isIntact,
    chainIntact,
    blockIndex:  audit.blockIndex,
    hash:        audit.hash,
    chainHash:   audit.chainHash,
    auditedAt:   audit.createdAt,
    onChain:     audit.onChain,
    reason:      !isIntact
      ? 'Transaction data has been modified after auditing.'
      : !chainIntact
      ? 'Chain link is broken — possible tampering.'
      : 'Transaction is intact and verified.',
  };
};

//─────────────────────────────────────
// VERIFY FULL CHAIN — Check all blocks
//─────────────────────────────────────

/**
 * Verify entire audit chain for a user
 */
const verifyChain = async (userId) => {
  const blocks = await AuditTrail.find({ userId })
    .sort({ blockIndex: 1 })
    .lean();

  if (blocks.length === 0) {
    return { valid: true, blocks: 0, message: 'No audit trail found.' };
  }

  let valid        = true;
  let brokenAt     = null;
  let checkedCount = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // Verify chain link to previous
    if (i > 0) {
      const prev     = blocks[i - 1];
      const expected = createChainHash(block.hash, block.previousHash);

      if (expected !== block.chainHash) {
        valid    = false;
        brokenAt = block.blockIndex;
        break;
      }

      if (block.previousHash !== prev.chainHash) {
        valid    = false;
        brokenAt = block.blockIndex;
        break;
      }
    }
    checkedCount++;
  }

  return {
    valid,
    blocks:       blocks.length,
    checkedBlocks: checkedCount,
    brokenAt,
    message: valid
      ? `✅ All ${blocks.length} blocks verified. Chain is intact.`
      : `❌ Chain broken at block ${brokenAt}. Possible tampering detected.`,
  };
};

//─────────────────────────────────────
// POLYGON — Submit to blockchain
// (activates when wallet key is added)
//─────────────────────────────────────

const submitToPolygon = async (audit) => {
  if (!env.blockchain.signerKey || !env.blockchain.rpcUrl) return null;

  try {
    const { ethers } = require('ethers');
    const provider   = new ethers.JsonRpcProvider(env.blockchain.rpcUrl);
    const wallet     = new ethers.Wallet(env.blockchain.signerKey, provider);

    // Submit hash as data payload (no contract needed — just record it)
    const tx = await wallet.sendTransaction({
      to:   wallet.address,
      data: ethers.hexlify(ethers.toUtf8Bytes(`SpendWise:${audit.chainHash}`)),
    });

    const receipt = await tx.wait();

    // Update audit with on-chain data
    await AuditTrail.findByIdAndUpdate(audit._id, {
      'onChain.txHash':      receipt.hash,
      'onChain.blockNumber': receipt.blockNumber,
      'onChain.network':     'polygon-amoy',
      'onChain.submittedAt': new Date(),
      'onChain.isOnChain':   true,
    });

    console.log(`✅ On-chain: ${receipt.hash}`);
    return receipt;
  } catch (err) {
    console.warn('Polygon submission error:', err.message);
    return null;
  }
};

module.exports = {
  auditTransaction,
  verifyTransaction,
  verifyChain,
  hashTransaction,
};