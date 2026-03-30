// backend/src/controllers/aiAdvanced.controller.js

const { askClaude, askClaudeJSON } = require('../services/groq.service');
const Transaction           = require('../models/Transaction.model');
const Budget                = require('../models/Budget.model');
const RecurringTransaction  = require('../models/RecurringTransaction.model');
const User                  = require('../models/User.model');

//─────────────────────────────────────
// HELPER — get N months of data
//─────────────────────────────────────
const getMonthlyBreakdown = async (userId, months = 6) => {
  const result = [];
  const now    = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

    const txns = await Transaction.find({
      userId, isDeleted: false,
      date: { $gte: start, $lte: end },
    }).lean();

    const expense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const income  = txns.filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0);

    const byCategory = {};
    txns.filter(t => t.type === 'expense').forEach(t => {
      const k = t.categoryName || 'Uncategorized';
      byCategory[k] = (byCategory[k] || 0) + t.amount;
    });

    result.push({
      month:      d.getMonth() + 1,
      year:       d.getFullYear(),
      label:      d.toLocaleString('en-IN', { month: 'short', year: 'numeric' }),
      expense,
      income,
      savings:    income - expense,
      byCategory,
      count:      txns.length,
    });
  }

  return result;
};

//─────────────────────────────────────
// 1. GET /api/ai/advanced/predict-budget
// AI predicts next month's budget
//─────────────────────────────────────
const predictBudget = async (req, res, next) => {
  try {
    const user     = await User.findById(req.user._id).lean();
    const history  = await getMonthlyBreakdown(req.user._id, 4);

    if (history.filter(h => h.count > 0).length < 2) {
      return res.status(200).json({
        success: true,
        data: { prediction: null, message: 'Need at least 2 months of data for budget prediction.' },
      });
    }

    const now       = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const systemPrompt = `You are a financial planning AI for Indian users.
Predict next month's budget based on spending history.
Be realistic and data-driven. Respond ONLY with valid JSON.`;

    const userPrompt = `User: ${user.name}
Monthly Income: ₹${user.monthlyIncome || 0}
Currency: ${user.currency || 'INR'}

Spending history (last 4 months):
${history.map(h => `${h.label}: Expense ₹${h.expense.toFixed(0)}, Income ₹${h.income.toFixed(0)}, Savings ₹${h.savings.toFixed(0)}`).join('\n')}

Category breakdown (latest month):
${Object.entries(history[history.length - 1]?.byCategory || {}).map(([k, v]) => `- ${k}: ₹${v.toFixed(0)}`).join('\n')}

Predict budget for ${nextMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}.
Respond with JSON:
{
  "totalPredicted": number,
  "confidence": 0-100,
  "categories": [
    { "name": "category", "predicted": number, "trend": "up|down|stable", "reason": "brief reason" }
  ],
  "savingsPotential": number,
  "advice": "2 sentence budget advice",
  "riskLevel": "low|medium|high"
}`;

    const prediction = await askClaudeJSON(systemPrompt, userPrompt, 1500);

    // Auto-create budget in DB if not exists
    const existing = await Budget.findOne({
      userId: req.user._id,
      month:  nextMonth.getMonth() + 1,
      year:   nextMonth.getFullYear(),
    });

    if (!existing && prediction.totalPredicted) {
      await Budget.create({
        userId:       req.user._id,
        month:        nextMonth.getMonth() + 1,
        year:         nextMonth.getFullYear(),
        totalBudget:  prediction.totalPredicted,
        isAiGenerated: true,
        aiInsights:   prediction.advice,
        categories:   (prediction.categories || []).map(c => ({
          categoryName: c.name,
          allocated:    c.predicted,
          spent:        0,
        })),
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        nextMonth: nextMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
        prediction,
        history: history.map(h => ({ label: h.label, expense: h.expense, income: h.income })),
        budgetCreated: !existing,
      },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// 2. GET /api/ai/advanced/anomalies
// Detect unusual transactions
//─────────────────────────────────────
const detectAnomalies = async (req, res, next) => {
  try {
    const days  = parseInt(req.query.days || '30');
    const since = new Date();
    since.setDate(since.getDate() - days);

    const transactions = await Transaction.find({
      userId:    req.user._id,
      isDeleted: false,
      date:      { $gte: since },
    }).sort({ date: -1 }).lean();

    if (transactions.length < 5) {
      return res.status(200).json({
        success: true,
        data: { anomalies: [], message: 'Not enough transactions to detect anomalies.' },
      });
    }

    // Calculate stats per category
    const categoryStats = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const k = t.categoryName || 'Uncategorized';
      if (!categoryStats[k]) categoryStats[k] = [];
      categoryStats[k].push(t.amount);
    });

    const categoryAvg = {};
    Object.entries(categoryStats).forEach(([k, amounts]) => {
      const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      const std = Math.sqrt(amounts.reduce((s, a) => s + Math.pow(a - avg, 2), 0) / amounts.length);
      categoryAvg[k] = { avg, std, count: amounts.length };
    });

    // Flag transactions > 2 standard deviations above mean
    const flagged = transactions.filter(t => {
      const stats = categoryAvg[t.categoryName];
      if (!stats || stats.count < 2) return false;
      return t.amount > stats.avg + 2 * stats.std;
    }).slice(0, 10);

    // Use AI to explain anomalies
    if (flagged.length === 0) {
      return res.status(200).json({
        success: true,
        data: { anomalies: [], message: 'No unusual transactions detected. Great spending consistency!' },
      });
    }

    const systemPrompt = `You are a financial anomaly detection AI.
Analyze flagged transactions and explain why they are unusual.
Respond ONLY with valid JSON array.`;

    const userPrompt = `Flagged transactions (statistically unusual):
${flagged.map(t => `- ₹${t.amount} at ${t.merchant || 'Unknown'} (${t.categoryName}) on ${new Date(t.date).toLocaleDateString('en-IN')}`).join('\n')}

Category averages:
${Object.entries(categoryAvg).map(([k, v]) => `- ${k}: avg ₹${v.avg.toFixed(0)}, std ₹${v.std.toFixed(0)}`).join('\n')}

For each flagged transaction, respond with JSON array:
[
  {
    "merchant": "name",
    "amount": number,
    "category": "category",
    "reason": "why this is unusual (1 sentence)",
    "severity": "low|medium|high",
    "suggestion": "what to do about it (1 sentence)"
  }
]`;

    const explanations = await askClaudeJSON(systemPrompt, userPrompt, 1024);

    // Merge with transaction IDs
    const anomalies = flagged.map((t, i) => ({
      transactionId: t._id,
      date:          t.date,
      amount:        t.amount,
      merchant:      t.merchant,
      category:      t.categoryName,
      avgForCategory: categoryAvg[t.categoryName]?.avg,
      ...(Array.isArray(explanations) ? explanations[i] || {} : {}),
    }));

    // Mark transactions as anomalies in DB
    await Promise.all(flagged.map(t =>
      Transaction.findByIdAndUpdate(t._id, {
        'aiData.isAnomaly': true,
        'aiData.anomalyReason': anomalies.find(a => a.transactionId?.toString() === t._id?.toString())?.reason || 'Unusual amount',
      })
    ));

    return res.status(200).json({
      success: true,
      data: {
        anomalies,
        totalScanned:  transactions.length,
        totalFlagged:  flagged.length,
        period:        `Last ${days} days`,
      },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// 3. GET /api/ai/advanced/subscriptions
// Auto-detect recurring/subscription payments
//─────────────────────────────────────
const detectSubscriptions = async (req, res, next) => {
  try {
    const since = new Date();
    since.setMonth(since.getMonth() - 4);

    const transactions = await Transaction.find({
      userId:    req.user._id,
      isDeleted: false,
      type:      'expense',
      date:      { $gte: since },
    }).sort({ date: 1 }).lean();

    if (transactions.length < 5) {
      return res.status(200).json({
        success: true,
        data: { subscriptions: [], message: 'Not enough transaction history to detect subscriptions.' },
      });
    }

    // Group by merchant + similar amount
    const merchantGroups = {};
    transactions.forEach(t => {
      const key = (t.merchant || t.description || 'unknown').toLowerCase().trim();
      if (!merchantGroups[key]) merchantGroups[key] = [];
      merchantGroups[key].push({ date: t.date, amount: t.amount, id: t._id });
    });

    // Find merchants with 2+ transactions with similar amounts
    const candidates = Object.entries(merchantGroups)
      .filter(([, txns]) => txns.length >= 2)
      .map(([merchant, txns]) => {
        const amounts  = txns.map(t => t.amount);
        const avgAmt   = amounts.reduce((s, a) => s + a, 0) / amounts.length;
        const isConsistent = amounts.every(a => Math.abs(a - avgAmt) / avgAmt < 0.05); // 5% variance
        const dates    = txns.map(t => new Date(t.date)).sort((a, b) => a - b);
        const gaps     = [];
        for (let i = 1; i < dates.length; i++) {
          gaps.push(Math.round((dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24)));
        }
        const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;

        return { merchant, txns, avgAmt, isConsistent, avgGap, count: txns.length };
      })
      .filter(c => c.isConsistent);

    if (candidates.length === 0) {
      return res.status(200).json({
        success: true,
        data: { subscriptions: [], message: 'No recurring payments detected.' },
      });
    }

    const systemPrompt = `You are a subscription detection AI for Indian users.
Analyze transaction patterns and identify subscriptions/recurring payments.
Respond ONLY with valid JSON array.`;

    const userPrompt = `Candidate recurring payments:
${candidates.map(c => `- ${c.merchant}: ₹${c.avgAmt.toFixed(0)} × ${c.count} times, avg gap ${c.avgGap.toFixed(0)} days`).join('\n')}

For each, respond with JSON array:
[
  {
    "merchant": "name",
    "amount": number,
    "frequency": "daily|weekly|monthly|quarterly|yearly",
    "category": "likely category",
    "isSubscription": true/false,
    "confidence": 0-100,
    "nextExpected": "YYYY-MM-DD estimate",
    "annualCost": number,
    "canCancel": true/false,
    "suggestion": "keep/review/cancel with reason"
  }
]`;

    const detected = await askClaudeJSON(systemPrompt, userPrompt, 1500);

    // Save detected subscriptions to DB
    const saved = [];
    if (Array.isArray(detected)) {
      for (const sub of detected.filter(s => s.isSubscription && s.confidence >= 70)) {
        const exists = await RecurringTransaction.findOne({
          userId:   req.user._id,
          merchant: { $regex: sub.merchant, $options: 'i' },
          isActive: true,
        });

        if (!exists) {
          const recurring = await RecurringTransaction.create({
            userId:       req.user._id,
            title:        sub.merchant,
            merchant:     sub.merchant,
            amount:       sub.amount,
            currency:     req.user.currency || 'INR',
            categoryName: sub.category || 'Subscription',
            frequency:    sub.frequency || 'monthly',
            startDate:    new Date(),
            nextDueDate:  sub.nextExpected ? new Date(sub.nextExpected) : new Date(),
            isActive:     true,
            autoDetected: true,
          });
          saved.push(recurring._id);
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        subscriptions:  Array.isArray(detected) ? detected : [],
        autoSaved:      saved.length,
        totalScanned:   transactions.length,
        candidates:     candidates.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// 4. GET /api/ai/advanced/forecast
// Predict future spending by category
//─────────────────────────────────────
const spendingForecast = async (req, res, next) => {
  try {
    const months  = parseInt(req.query.months || '3'); // how many months to forecast
    const history = await getMonthlyBreakdown(req.user._id, 4);
    const user    = await User.findById(req.user._id).lean();

    if (history.filter(h => h.count > 0).length < 2) {
      return res.status(200).json({
        success: true,
        data: { forecast: null, message: 'Need at least 2 months of data for forecasting.' },
      });
    }

    const systemPrompt = `You are a financial forecasting AI for Indian users.
Use historical spending data to forecast future expenses.
Be realistic and account for trends. Respond ONLY with valid JSON.`;

    const userPrompt = `Historical spending (last 4 months):
${history.map(h => `${h.label}: Total ₹${h.expense.toFixed(0)}`).join('\n')}

Category trends:
${Object.entries(history[history.length-1]?.byCategory || {}).slice(0, 8).map(([k, v]) => `- ${k}: ₹${v.toFixed(0)}`).join('\n')}

Monthly Income: ₹${user.monthlyIncome || 0}

Forecast spending for next ${months} months. Respond with JSON:
{
  "forecast": [
    {
      "month": "Month Year",
      "totalExpense": number,
      "totalIncome": number,
      "netSavings": number,
      "categories": [{ "name": "category", "amount": number }],
      "confidence": 0-100
    }
  ],
  "trend": "increasing|decreasing|stable",
  "avgMonthlyExpense": number,
  "projectedAnnualSavings": number,
  "keyRisk": "main financial risk",
  "opportunity": "main savings opportunity"
}`;

    const forecast = await askClaudeJSON(systemPrompt, userPrompt, 1500);

    return res.status(200).json({
      success: true,
      data: {
        forecast,
        history: history.map(h => ({
          label:   h.label,
          expense: h.expense,
          income:  h.income,
          savings: h.savings,
        })),
        forecastMonths: months,
      },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// 5. GET /api/ai/advanced/score-history
// Track financial score evolution over time
//─────────────────────────────────────
const scoreHistory = async (req, res, next) => {
  try {
    const history = await getMonthlyBreakdown(req.user._id, 6);
    const user    = await User.findById(req.user._id).lean();

    if (history.filter(h => h.count > 0).length < 2) {
      return res.status(200).json({
        success: true,
        data: { scores: [], message: 'Need more transaction history to show score evolution.' },
      });
    }

    // Calculate a simple score for each month
    const scores = history.map(h => {
      if (h.count === 0) return { label: h.label, score: null };

      const savingsRate  = h.income > 0 ? (h.savings / h.income) * 100 : 0;
      const savingsScore = Math.min(25, Math.max(0, savingsRate * 0.5));
      const spendScore   = h.expense > 0 ? Math.min(25, 25 - (h.expense / (user.monthlyIncome || h.expense)) * 10) : 20;
      const consistency  = Math.min(25, h.count * 2);
      const total        = Math.round(savingsScore + spendScore + consistency + 15);

      const grade =
        total >= 90 ? 'A+' :
        total >= 80 ? 'A'  :
        total >= 70 ? 'B+' :
        total >= 60 ? 'B'  :
        total >= 50 ? 'C+' :
        total >= 40 ? 'C'  : 'D';

      return {
        label:       h.label,
        month:       h.month,
        year:        h.year,
        score:       Math.min(100, Math.max(0, total)),
        grade,
        expense:     h.expense,
        income:      h.income,
        savings:     h.savings,
        savingsRate: parseFloat(savingsRate.toFixed(1)),
      };
    }).filter(s => s.score !== null);

    // AI commentary on score trend
    const trend = scores.length >= 2
      ? scores[scores.length - 1].score - scores[0].score
      : 0;

    const systemPrompt = `You are a financial coach. Give brief encouraging commentary on a user's financial score trend. Max 2 sentences.`;
    const userPrompt   = `Score trend over ${scores.length} months: ${scores.map(s => `${s.label}: ${s.score}`).join(', ')}. Overall change: ${trend > 0 ? '+' : ''}${trend.toFixed(0)} points.`;

    const commentary = await askClaude(systemPrompt, userPrompt, 200);

    return res.status(200).json({
      success: true,
      data: {
        scores,
        currentScore: scores[scores.length - 1] || null,
        trend:        trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable',
        trendPoints:  parseFloat(trend.toFixed(1)),
        commentary,
      },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// 6. GET /api/ai/advanced/subscriptions/list
// List all saved recurring transactions
//─────────────────────────────────────
const listSubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await RecurringTransaction.find({
      userId:   req.user._id,
      isActive: true,
    }).sort({ nextDueDate: 1 }).lean();

    const totalMonthly = subscriptions
      .filter(s => s.frequency === 'monthly')
      .reduce((sum, s) => sum + s.amount, 0);

    const totalAnnual = subscriptions.reduce((sum, s) => {
      const multipliers = { daily: 365, weekly: 52, monthly: 12, quarterly: 4, yearly: 1 };
      return sum + s.amount * (multipliers[s.frequency] || 12);
    }, 0);

    return res.status(200).json({
      success: true,
      data: {
        subscriptions,
        summary: {
          total:        subscriptions.length,
          totalMonthly,
          totalAnnual,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  predictBudget,
  detectAnomalies,
  detectSubscriptions,
  spendingForecast,
  scoreHistory,
  listSubscriptions,
};