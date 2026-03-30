// backend/src/routes/aiAdvanced.routes.js

const express = require('express');
const router  = express.Router();

const {
  predictBudget,
  detectAnomalies,
  detectSubscriptions,
  spendingForecast,
  scoreHistory,
  listSubscriptions,
} = require('../controllers/aiAdvanced.controller');

const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/predict-budget',       predictBudget);
router.get('/anomalies',            detectAnomalies);
router.get('/subscriptions',        detectSubscriptions);
router.get('/subscriptions/list',   listSubscriptions);
router.get('/forecast',             spendingForecast);
router.get('/score-history',        scoreHistory);

module.exports = router;