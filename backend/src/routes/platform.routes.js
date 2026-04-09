// backend/src/routes/platform.routes.js

const express = require('express');
const router  = express.Router();

const {
  createKey,
  listKeys,
  revokeKey,
  getKeyUsage,
  getPlatformDashboard,
} = require('../controllers/apiKey.controller');

const {
  categorize,
  analyze,
  predict,
  score,
  getCategories,
} = require('../controllers/publicApi.controller');

const { protect }                              = require('../middleware/auth.middleware');
const { authenticateAPIKey, requirePermission } = require('../middleware/apiAuth.middleware');

//─────────────────────────────────────
// PLATFORM MANAGEMENT (JWT protected)
//─────────────────────────────────────
router.get('/dashboard',         protect, getPlatformDashboard);
router.get('/keys',              protect, listKeys);
router.post('/keys',             protect, createKey);
router.delete('/keys/:id',       protect, revokeKey);
router.get('/keys/:id/usage',    protect, getKeyUsage);

// Tier info (public)
router.get('/tiers', (req, res) => {
  res.json({
    success: true,
    data: {
      tiers: {
        free:       { daily: 100,    monthly: 1000,   price: 'Free',    features: ['categorization'] },
        starter:    { daily: 1000,   monthly: 10000,  price: '₹499/mo', features: ['categorization', 'analysis', 'score'] },
        growth:     { daily: 10000,  monthly: 100000, price: '₹1499/mo',features: ['all endpoints'] },
        enterprise: { daily: 999999, monthly: 999999, price: 'Custom',  features: ['unlimited', 'SLA', 'support'] },
      },
    },
  });
});

//─────────────────────────────────────
// PUBLIC API ENDPOINTS (API Key auth)
//─────────────────────────────────────
router.get('/v1/categories',
  authenticateAPIKey,
  getCategories
);

router.post('/v1/categorize',
  authenticateAPIKey,
  requirePermission('categorization'),
  categorize
);

router.post('/v1/analyze',
  authenticateAPIKey,
  requirePermission('analysis'),
  analyze
);

router.post('/v1/predict',
  authenticateAPIKey,
  requirePermission('prediction'),
  predict
);

router.post('/v1/score',
  authenticateAPIKey,
  requirePermission('score'),
  score
);

module.exports = router;