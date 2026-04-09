// backend/server-test.js

// Set test env vars BEFORE requiring app
process.env.NODE_ENV       = 'test';
process.env.PORT           = '5001';
process.env.JWT_SECRET     = 'test_jwt_secret_spendwise_2026';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_SECRET     = 'test_refresh_secret_2026';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.FRONTEND_URL   = 'http://localhost:5173';
process.env.GROQ_API_KEY   = 'test_groq_key';
process.env.MONGODB_URI    = 'mongodb://localhost:27017/spendwise_test';
process.env.MONGODB_NAME   = 'spendwise_test';
// Disable rate limiting in tests
process.env.RATE_LIMIT_MAX_REQUESTS = '99999';
process.env.RATE_LIMIT_WINDOW_MS    = '900000';
// Disable blockchain
process.env.BLOCKCHAIN_ENABLED = 'false';

const app = require('./src/app');
module.exports = app;