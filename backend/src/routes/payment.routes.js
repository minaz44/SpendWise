// backend/src/routes/payment.routes.js

const express = require('express');
const router  = express.Router();

const {
  createOrder,
  verifyPayment,
  webhook,
  getPaymentHistory,
  budgetCheck,
  getPaymentStats,
} = require('../controllers/payment.controller');

const { protect } = require('../middleware/auth.middleware');

//─────────────────────────────────────
// PUBLIC — Razorpay webhook (no auth)
//─────────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), webhook);

//─────────────────────────────────────
// PROTECTED
//─────────────────────────────────────
router.use(protect);

router.post('/order',         createOrder);
router.post('/verify',        verifyPayment);
router.get('/history',        getPaymentHistory);
router.get('/budget-check',   budgetCheck);
router.get('/stats',          getPaymentStats);

module.exports = router;