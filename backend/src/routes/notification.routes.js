// backend/src/routes/notification.routes.js

const express = require('express');
const router  = express.Router();
const {
  subscribe, unsubscribe,
  getBudgetAlerts, getWeeklySummary, getAnomalyAlerts,
  setMonthlyBudget, getMonthlyBudget,
} = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

router.post('/subscribe',      subscribe);
router.delete('/unsubscribe',  unsubscribe);
router.get('/budget-alerts',   getBudgetAlerts);
router.get('/weekly-summary',  getWeeklySummary);
router.get('/anomaly-alerts',  getAnomalyAlerts);
router.post('/budget',         setMonthlyBudget);
router.get('/budget',          getMonthlyBudget);

module.exports = router;