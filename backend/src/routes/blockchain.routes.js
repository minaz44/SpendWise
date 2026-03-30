// backend/src/routes/blockchain.routes.js

const express = require('express');
const router  = express.Router();

const {
  auditOne,
  auditAll,
  verifyOne,
  verifyFullChain,
  getAuditTrail,
  getStats,
  getProof,
} = require('../controllers/blockchain.controller');

const { protect } = require('../middleware/auth.middleware');

router.use(protect);

// Audit
router.post('/audit/:transactionId', auditOne);
router.post('/audit-all',            auditAll);

// Verify
router.get('/verify/:transactionId', verifyOne);
router.get('/verify-chain',          verifyFullChain);

// Trail + stats
router.get('/trail',                 getAuditTrail);
router.get('/stats',                 getStats);

// Proof of spending
router.get('/proof/:transactionId',  getProof);

module.exports = router;