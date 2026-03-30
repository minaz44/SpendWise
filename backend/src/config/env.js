// backend/src/config/env.js

const requiredEnvVars = [
  'PORT',
  'NODE_ENV',
  'MONGODB_URI',
  'MONGODB_NAME',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'GROQ_API_KEY',
  'FRONTEND_URL',
];

const validateEnv = () => {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((key) => console.error(`   - ${key}`));
    process.exit(1);
  }
  console.log('✅ Environment variables validated');
};

const env = {
  port:    parseInt(process.env.PORT, 10),
  nodeEnv: process.env.NODE_ENV,
  isDev:   process.env.NODE_ENV === 'development',
  isProd:  process.env.NODE_ENV === 'production',

  db: {
    uri:  process.env.MONGODB_URI,
    name: process.env.MONGODB_NAME,
  },

  jwt: {
    secret:           process.env.JWT_SECRET,
    expiresIn:        process.env.JWT_EXPIRES_IN,
    refreshSecret:    process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  },

  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model:  'llama-3.3-70b-versatile',
  },

  frontend: {
    url: process.env.FRONTEND_URL,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS    || '900000', 10),
    max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100',    10),
  },

  upload: {
    maxSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
    dir:       process.env.UPLOAD_DIR               || 'uploads',
  },

  razorpay: {
    keyId:         process.env.RAZORPAY_KEY_ID,
    keySecret:     process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },

  blockchain: {
    enabled:   process.env.BLOCKCHAIN_ENABLED === 'true',
    rpcUrl:    process.env.POLYGON_RPC_URL,
    chainId:   parseInt(process.env.CHAIN_ID || '80001', 10),
    signerKey: process.env.BACKEND_SIGNER_PRIVATE_KEY,
    contracts: {
      groupSettlement: process.env.SPENDWISE_GROUP_SETTLEMENT_CONTRACT,
      financialScore:  process.env.SPENDWISE_FINANCIAL_SCORE_CONTRACT,
      auditTrail:      process.env.SPENDWISE_AUDIT_TRAIL_CONTRACT,
    },
  },

  apiPlatform: {
    freeTierDailyLimit:  parseInt(process.env.API_FREE_TIER_DAILY_LIMIT  || '100',    10),
    starterMonthlyLimit: parseInt(process.env.API_STARTER_MONTHLY_LIMIT  || '10000',  10),
    growthMonthlyLimit:  parseInt(process.env.API_GROWTH_MONTHLY_LIMIT   || '100000', 10),
  },
};

module.exports = { validateEnv, env };