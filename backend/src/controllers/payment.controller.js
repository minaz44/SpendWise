// backend/src/controllers/payment.controller.js

const Razorpay   = require('razorpay');
const crypto     = require('crypto');
const Transaction = require('../models/Transaction.model');
const Budget      = require('../models/Budget.model');
const User        = require('../models/User.model');
const { env }     = require('../config/env');

//─────────────────────────────────────
// Razorpay instance
//─────────────────────────────────────
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

//─────────────────────────────────────
// HELPER — check budget before payment
//─────────────────────────────────────
const checkBudget = async (userId, amount, categoryName) => {
  const now    = new Date();
  const budget = await Budget.findOne({
    userId,
    month: now.getMonth() + 1,
    year:  now.getFullYear(),
  });

  if (!budget) return { hasBudget: false };

  const remaining   = budget.totalBudget - budget.totalSpent;
  const percentUsed = budget.totalBudget > 0
    ? ((budget.totalSpent + amount) / budget.totalBudget) * 100
    : 0;

  const catBudget = budget.categories.find(
    c => c.categoryName?.toLowerCase() === categoryName?.toLowerCase()
  );

  return {
    hasBudget:       true,
    totalBudget:     budget.totalBudget,
    totalSpent:      budget.totalSpent,
    remaining,
    afterPayment:    remaining - amount,
    percentAfter:    Math.round(percentUsed),
    willExceed:      remaining < amount,
    willHit80:       percentUsed >= 80,
    categoryBudget:  catBudget || null,
  };
};

//─────────────────────────────────────
// 1. POST /api/payments/order
// Create Razorpay order
//─────────────────────────────────────
const createOrder = async (req, res, next) => {
  try {
    const { amount, currency, description, categoryName, notes } = req.body;

    if (!amount || amount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be at least ₹1.',
      });
    }

    // Budget awareness check
    const budgetCheck = await checkBudget(req.user._id, amount, categoryName);

    // Create Razorpay order (amount in paise)
    const order = await razorpay.orders.create({
      amount:   Math.round(amount * 100),
      currency: currency || 'INR',
      receipt:  `sw_${req.user._id}_${Date.now()}`,
      notes: {
        userId:      req.user._id.toString(),
        description: description || '',
        categoryName: categoryName || '',
        ...notes,
      },
    });

    // Save pending transaction
    const transaction = await Transaction.create({
      userId:      req.user._id,
      type:        'expense',
      amount,
      currency:    currency || 'INR',
      description: description || 'Razorpay Payment',
      categoryName: categoryName || 'Uncategorized',
      date:        new Date(),
      paymentMethod: 'other',
      source:      'razorpay',
      paymentData: {
        razorpayOrderId: order.id,
        status:          'pending',
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        order: {
          id:       order.id,
          amount:   order.amount,
          currency: order.currency,
        },
        transaction: { id: transaction._id },
        budgetAlert: budgetCheck.hasBudget ? {
          willExceed:   budgetCheck.willExceed,
          willHit80:    budgetCheck.willHit80,
          remaining:    budgetCheck.remaining,
          afterPayment: budgetCheck.afterPayment,
          percentAfter: budgetCheck.percentAfter,
          message: budgetCheck.willExceed
            ? `⚠️ This payment will exceed your monthly budget by ₹${Math.abs(budgetCheck.afterPayment).toFixed(0)}`
            : budgetCheck.willHit80
            ? `⚠️ This will use ${budgetCheck.percentAfter}% of your monthly budget`
            : null,
        } : null,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// 2. POST /api/payments/verify
// Verify payment signature + complete transaction
//─────────────────────────────────────
const verifyPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification fields.',
      });
    }

    // Verify signature
    const body      = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected  = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. Invalid signature.',
      });
    }

    // Update transaction to completed
    const transaction = await Transaction.findOneAndUpdate(
      {
        userId: req.user._id,
        'paymentData.razorpayOrderId': razorpay_order_id,
      },
      {
        $set: {
          'paymentData.razorpayPaymentId': razorpay_payment_id,
          'paymentData.status':            'completed',
        },
      },
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found for this order.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully.',
      data: { transaction },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// 3. POST /api/payments/webhook
// Razorpay webhook — auto-update on payment events
//─────────────────────────────────────
const webhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret    = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Verify webhook signature
    const expected = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (expected !== signature) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
    }

    // Acknowledge immediately
    res.status(200).json({ success: true });

    const event   = req.body.event;
    const payment = req.body.payload?.payment?.entity;

    if (!payment) return;

    if (event === 'payment.captured') {
      await Transaction.findOneAndUpdate(
        { 'paymentData.razorpayPaymentId': payment.id },
        { $set: { 'paymentData.status': 'completed' } }
      );
    }

    if (event === 'payment.failed') {
      await Transaction.findOneAndUpdate(
        { 'paymentData.razorpayOrderId': payment.order_id },
        { $set: { 'paymentData.status': 'failed' } }
      );
    }

    if (event === 'refund.created') {
      await Transaction.findOneAndUpdate(
        { 'paymentData.razorpayPaymentId': payment.id },
        { $set: { 'paymentData.status': 'refunded' } }
      );
    }
  } catch (error) {
    console.error('Webhook error:', error.message);
  }
};

//─────────────────────────────────────
// 4. GET /api/payments/history
// Payment history for current user
//─────────────────────────────────────
const getPaymentHistory = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1'));
    const limit = Math.min(50, parseInt(req.query.limit || '10'));
    const skip  = (page - 1) * limit;

    const filter = {
      userId: req.user._id,
      source: 'razorpay',
    };

    if (req.query.status) {
      filter['paymentData.status'] = req.query.status;
    }

    const [payments, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        payments,
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
// 5. GET /api/payments/budget-check
// Check budget before making a payment
//─────────────────────────────────────
const budgetCheck = async (req, res, next) => {
  try {
    const { amount, categoryName } = req.query;

    if (!amount) {
      return res.status(400).json({ success: false, message: 'amount is required.' });
    }

    const check = await checkBudget(req.user._id, parseFloat(amount), categoryName);

    return res.status(200).json({
      success: true,
      data:    check,
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// 6. GET /api/payments/stats
// Payment stats summary
//─────────────────────────────────────
const getPaymentStats = async (req, res, next) => {
  try {
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, thisMonth, byStatus] = await Promise.all([
      Transaction.countDocuments({ userId: req.user._id, source: 'razorpay' }),
      Transaction.aggregate([
        {
          $match: {
            userId: req.user._id,
            source: 'razorpay',
            'paymentData.status': 'completed',
            date: { $gte: monthStart },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Transaction.aggregate([
        { $match: { userId: req.user._id, source: 'razorpay' } },
        { $group: { _id: '$paymentData.status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalPayments:     total,
        thisMonth:         thisMonth[0] || { total: 0, count: 0 },
        byStatus:          byStatus,
        razorpayKeyId:     process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  webhook,
  getPaymentHistory,
  budgetCheck,
  getPaymentStats,
};