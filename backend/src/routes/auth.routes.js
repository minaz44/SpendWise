// backend/src/routes/auth.routes.js

const express = require('express');
const router  = express.Router();

const {
  register,
  verifyOTP,
  resendOTP,
  login,
  refreshToken,
  logout,
  getMe,
  updateProfile,
  changePassword,
} = require('../controllers/auth.controller');

const { protect } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  registerValidator,
  loginValidator,
  changePasswordValidator,
} = require('../middleware/validators/auth.validator');

// ── Public routes ─────────────────────────────────────────────────────────────
router.post('/register',    authLimiter, ...registerValidator, register);
router.post('/verify-otp',  authLimiter, verifyOTP);
router.post('/resend-otp',  authLimiter, resendOTP);
router.post('/login',       authLimiter, ...loginValidator, login);
router.post('/refresh',     refreshToken);

// ── Protected routes ──────────────────────────────────────────────────────────
router.use(protect);
router.post('/logout',         logout);
router.get('/me',              getMe);
router.put('/profile',         updateProfile);
router.put('/change-password', ...changePasswordValidator, changePassword);

module.exports = router;