// backend/src/controllers/publicApi.controller.js

const { askClaudeJSON } = require('../services/groq.service');
const Category    = require('../models/Category.model');
const Transaction = require('../models/Transaction.model');
const User        = require('../models/User.model');

//─────────────────────────────────────
// POST /api/public/categorize
// AI categorization endpoint
//─────────────────────────────────────
const categorize = async (req, res, next) => {
  try {
    const { merchant, description, amount, type, currency } = req.body;

    if (!merchant && !description) {
      return res.status(400).json({
        success: false,
        message: 'merchant or description is required.',
      });
    }

    const categories = await Category.find({ isSystem: true, isActive: true }).lean();
    const categoryList = categories.map(c => `${c.name} (${c.type})`).join(', ');

    const systemPrompt = `You are a financial transaction categorizer.
Pick the best category. Respond ONLY with JSON.`;

    const userPrompt = `Transaction: ${merchant || description}
Amount: ${amount || 'unknown'} ${currency || 'INR'}
Type: ${type || 'expense'}
Categories: ${categoryList}

Respond: {"categoryName": "name", "confidence": 0-100, "reason": "brief"}`;

    const result = await askClaudeJSON(systemPrompt, userPrompt, 256);
    const matched = categories.find(c => c.name.toLowerCase() === result.categoryName?.toLowerCase());

    return res.status(200).json({
      success: true,
      data: {
        categoryName:  matched?.name  || result.categoryName || 'Uncategorized',
        categoryIcon:  matched?.icon  || '📦',
        categoryColor: matched?.color || '#888780',
        confidence:    result.confidence,
        reason:        result.reason,
        apiVersion:    'v1',
      },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// POST /api/public/analyze
// Spending analysis endpoint
//─────────────────────────────────────
const analyze = async (req, res, next) => {
  try {
    const { transactions, currency } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'transactions array is required.',
      });
    }

    if (transactions.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 100 transactions per request.',
      });
    }

    // Calculate totals
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const totalIncome  = transactions.filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0);

    const byCategory = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      byCategory[t.category || 'Uncategorized'] = (byCategory[t.category || 'Uncategorized'] || 0) + t.amount;
    });

    const systemPrompt = `You are a financial analyst. Analyze spending data and provide insights.
Respond ONLY with valid JSON.`;

    const userPrompt = `Transactions: ${transactions.length}
Total Expense: ${currency || 'INR'} ${totalExpense.toFixed(0)}
Total Income: ${currency || 'INR'} ${totalIncome.toFixed(0)}
By Category: ${Object.entries(byCategory).map(([k,v]) => `${k}: ${v.toFixed(0)}`).join(', ')}

Respond:
{
  "summary": "2 sentence summary",
  "topCategory": "highest spend category",
  "savingsRate": 0-100,
  "spendingHealth": "good|fair|poor",
  "insights": ["insight1", "insight2", "insight3"]
}`;

    const analysis = await askClaudeJSON(systemPrompt, userPrompt, 512);

    return res.status(200).json({
      success: true,
      data: {
        totals:    { totalExpense, totalIncome, netSavings: totalIncome - totalExpense },
        byCategory,
        analysis,
        apiVersion: 'v1',
      },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// POST /api/public/predict
// Budget prediction endpoint
//─────────────────────────────────────
const predict = async (req, res, next) => {
  try {
    const { monthlyHistory, currency } = req.body;

    if (!Array.isArray(monthlyHistory) || monthlyHistory.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'monthlyHistory array with at least 2 months is required.',
      });
    }

    const systemPrompt = `You are a financial forecasting AI.
Predict next month budget based on history. Respond ONLY with JSON.`;

    const userPrompt = `Monthly spending history:
${monthlyHistory.map(m => `${m.month}: ${currency || 'INR'} ${m.expense}`).join('\n')}

Predict next month. Respond:
{
  "predictedExpense": number,
  "confidence": 0-100,
  "trend": "increasing|decreasing|stable",
  "advice": "one sentence budget advice"
}`;

    const prediction = await askClaudeJSON(systemPrompt, userPrompt, 256);

    return res.status(200).json({
      success: true,
      data: { prediction, apiVersion: 'v1' },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// POST /api/public/score
// Financial score endpoint
//─────────────────────────────────────
const score = async (req, res, next) => {
  try {
    const { totalIncome, totalExpense, transactionCount, currency } = req.body;

    if (!totalExpense) {
      return res.status(400).json({
        success: false,
        message: 'totalExpense is required.',
      });
    }

    const savingsRate = totalIncome > 0
      ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

    const systemPrompt = `You are a financial health scoring system.
Score financial health 0-100. Respond ONLY with JSON.`;

    const userPrompt = `Financial Data:
Income: ${currency || 'INR'} ${totalIncome || 0}
Expense: ${currency || 'INR'} ${totalExpense}
Savings Rate: ${savingsRate.toFixed(1)}%
Transactions: ${transactionCount || 0}

Respond:
{
  "score": 0-100,
  "grade": "A+|A|B+|B|C+|C|D|F",
  "label": "Excellent|Very Good|Good|Fair|Needs Improvement|Poor",
  "summary": "one sentence summary"
}`;

    const result = await askClaudeJSON(systemPrompt, userPrompt, 256);

    return res.status(200).json({
      success: true,
      data: { ...result, apiVersion: 'v1' },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// GET /api/public/categories
// Get all system categories
//─────────────────────────────────────
const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isSystem: true, isActive: true })
      .select('name icon color type keywords')
      .lean();

    return res.status(200).json({
      success: true,
      data: { categories, total: categories.length, apiVersion: 'v1' },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { categorize, analyze, predict, score, getCategories };