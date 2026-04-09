// backend/src/controllers/notification.controller.js

const User        = require('../models/User.model');
const Budget      = require('../models/Budget.model');
const Transaction = require('../models/Transaction.model');

//─────────────────────────────────────
// GET /api/notifications/budget-alerts
//─────────────────────────────────────
const getBudgetAlerts = async (req, res, next) => {
  try {
    const now  = new Date();
    const user = await User.findById(req.user._id);
    const alerts = [];

    // ── Check monthly spending cap ──────────────────
    const budget = await Budget.findOne({
      userId: req.user._id,
      month:  now.getMonth() + 1,
      year:   now.getFullYear(),
    });

    if (budget && budget.totalBudget > 0) {
      const pct = budget.totalBudget > 0
        ? (budget.totalSpent / budget.totalBudget) * 100 : 0;

      if (pct >= 100) {
        alerts.push({
          type:    'danger',
          title:   '🚨 Spending Cap Exceeded!',
          message: `You've exceeded your monthly cap of ₹${budget.totalBudget.toLocaleString('en-IN')}. Spent: ₹${budget.totalSpent.toLocaleString('en-IN')}`,
          pct:     Math.round(pct),
          action:  'budget',
        });
      } else if (pct >= 80) {
        alerts.push({
          type:    'warning',
          title:   '⚠️ Approaching Spending Cap',
          message: `You've used ${Math.round(pct)}% of your ₹${budget.totalBudget.toLocaleString('en-IN')} monthly cap`,
          pct:     Math.round(pct),
          action:  'budget',
        });
      } else if (pct >= 50) {
        alerts.push({
          type:    'info',
          title:   '💡 Halfway Through Budget',
          message: `You've used ${Math.round(pct)}% of your monthly spending cap`,
          pct:     Math.round(pct),
          action:  'budget',
        });
      }

      // Category-level alerts
      budget.categories.forEach(cat => {
        if (cat.allocated > 0 && cat.spent > cat.allocated) {
          alerts.push({
            type:    'warning',
            title:   `${cat.icon || '📊'} ${cat.categoryName} Over Budget`,
            message: `Spent ₹${cat.spent.toFixed(0)} vs ₹${cat.allocated.toFixed(0)} budget`,
            action:  'category',
            category: cat.categoryName,
          });
        }
      });
    }

    // ── Check income vs spending ────────────────────
    if (user.monthlyIncome > 0) {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const totalSpentAgg = await Transaction.aggregate([
        { $match: { userId: req.user._id, type: 'expense', isDeleted: false, date: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      const totalSpent = totalSpentAgg[0]?.total || 0;
      const spentPct   = (totalSpent / user.monthlyIncome) * 100;

      if (spentPct >= 100 && !budget) {
        alerts.push({
          type:    'danger',
          title:   '🚨 Exceeded Monthly Income!',
          message: `Spent ₹${totalSpent.toLocaleString('en-IN')} which exceeds your income of ₹${user.monthlyIncome.toLocaleString('en-IN')}`,
          pct:     Math.round(spentPct),
          action:  'income',
        });
      } else if (spentPct >= 80 && !budget) {
        alerts.push({
          type:    'warning',
          title:   '⚠️ High Spending This Month',
          message: `Spent ${Math.round(spentPct)}% of your monthly income`,
          pct:     Math.round(spentPct),
          action:  'income',
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        alerts,
        budget: budget ? {
          totalBudget:  budget.totalBudget,
          totalSpent:   budget.totalSpent,
          remaining:    budget.totalBudget - budget.totalSpent,
          percentUsed:  budget.percentageUsed,
        } : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// GET /api/notifications/weekly-summary
//─────────────────────────────────────
const getWeeklySummary = async (req, res, next) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const transactions = await Transaction.find({
      userId: req.user._id, isDeleted: false, date: { $gte: since },
    }).lean();

    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
    const totalIncome  = transactions.filter(t => t.type === 'income' ).reduce((s,t) => s + t.amount, 0);

    const byCategory = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      byCategory[t.categoryName] = (byCategory[t.categoryName] || 0) + t.amount;
    });
    const topCategory = Object.entries(byCategory).sort((a,b) => b[1]-a[1])[0];

    return res.status(200).json({
      success: true,
      data: {
        period:       'Last 7 days',
        totalExpense, totalIncome,
        netSavings:   totalIncome - totalExpense,
        transactions: transactions.length,
        topCategory:  topCategory ? { name: topCategory[0], amount: topCategory[1] } : null,
        message: `This week you spent ₹${totalExpense.toFixed(0)} across ${transactions.length} transactions.`,
      },
    });
  } catch (error) { next(error); }
};

//─────────────────────────────────────
// GET /api/notifications/anomaly-alerts
//─────────────────────────────────────
const getAnomalyAlerts = async (req, res, next) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const anomalies = await Transaction.find({
      userId: req.user._id, isDeleted: false,
      'aiData.isAnomaly': true, date: { $gte: since },
    }).sort({ date: -1 }).limit(5).lean();

    return res.status(200).json({
      success: true,
      data: {
        anomalies,
        count: anomalies.length,
        message: anomalies.length > 0
          ? `${anomalies.length} unusual transaction(s) detected this week.`
          : 'No unusual transactions this week.',
      },
    });
  } catch (error) { next(error); }
};

//─────────────────────────────────────
// POST /api/notifications/set-budget
// Set monthly spending cap
//─────────────────────────────────────
const setMonthlyBudget = async (req, res, next) => {
  try {
    const { totalBudget, month, year } = req.body;
    const now = new Date();

    if (!totalBudget || totalBudget <= 0) {
      return res.status(400).json({ success: false, message: 'Budget amount is required.' });
    }

    const budget = await Budget.findOneAndUpdate(
      {
        userId: req.user._id,
        month:  month  || now.getMonth() + 1,
        year:   year   || now.getFullYear(),
      },
      { $set: { totalBudget, 'alerts.at50Percent': false, 'alerts.at80Percent': false, 'alerts.at100Percent': false } },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: `Monthly spending cap set to ₹${totalBudget.toLocaleString('en-IN')}`,
      data: { budget },
    });
  } catch (error) { next(error); }
};

//─────────────────────────────────────
// GET /api/notifications/budget
// Get current month budget/cap
//─────────────────────────────────────
const getMonthlyBudget = async (req, res, next) => {
  try {
    const now = new Date();
    const budget = await Budget.findOne({
      userId: req.user._id,
      month:  now.getMonth() + 1,
      year:   now.getFullYear(),
    });

    return res.status(200).json({
      success: true,
      data: { budget: budget || null },
    });
  } catch (error) { next(error); }
};

const subscribe   = async (req, res) => res.json({ success: true, message: 'Subscribed.' });
const unsubscribe = async (req, res) => res.json({ success: true, message: 'Unsubscribed.' });

module.exports = {
  getBudgetAlerts, getWeeklySummary, getAnomalyAlerts,
  setMonthlyBudget, getMonthlyBudget,
  subscribe, unsubscribe,
};