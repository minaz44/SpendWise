// backend/src/controllers/auth.controller.js

const User = require('../models/User.model');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../utils/jwt');
const {
  sendOTPEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
} = require('../services/email.service');

// ─── Generate 6-digit OTP ─────────────────────────────────────────────────────
const generateOTP = () => String(Math.floor(100000 + Math.random() * 900000));

//─────────────────────────────────────
// HELPER — build safe user object
//─────────────────────────────────────
const sanitizeUser = (user) => ({
  id:              user._id,
  name:            user.name,
  email:           user.email,
  avatar:          user.avatar,
  currency:        user.currency,
  language:        user.language,
  timezone:        user.timezone,
  monthlyIncome:   user.monthlyIncome,
  plan:            user.plan,
  initials:        user.initials,
  isPremium:       user.isPremium,
  isEmailVerified: user.isEmailVerified,
  notifications:   user.notifications,
  smsTracking:     user.smsTracking,
  createdAt:       user.createdAt,
});

//─────────────────────────────────────
// POST /api/auth/register
//─────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { name, email, password, currency, monthlyIncome } = req.body;

    // Check duplicate email
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing && existing.isEmailVerified) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // Generate OTP
    const otp        = generateOTP();
    const otpExpiry  = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    let user;
    if (existing && !existing.isEmailVerified) {
      // Re-send OTP to unverified account
      existing.emailVerifyOTP       = otp;
      existing.emailVerifyOTPExpiry = otpExpiry;
      await existing.save({ validateBeforeSave: false });
      user = existing;
    } else {
      // Create new user (not verified yet)
      user = await User.create({
        name,
        email,
        password,
        currency:             currency      || 'INR',
        monthlyIncome:        monthlyIncome || 0,
        isEmailVerified:      false,
        emailVerifyOTP:       otp,
        emailVerifyOTPExpiry: otpExpiry,
      });
    }

    // Send OTP email (non-blocking — don't fail register if email fails)
    sendOTPEmail({ to: email, name, otp }).catch(err =>
      console.error('OTP email failed:', err.message)
    );

    return res.status(201).json({
      success: true,
      message: 'Account created! Please check your email for the 6-digit OTP to verify your account.',
      data: { email, requiresVerification: true },
    });

  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// POST /api/auth/verify-otp
//─────────────────────────────────────
const verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+emailVerifyOTP +emailVerifyOTPExpiry +refreshToken');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found. Please register first.' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, message: 'Email is already verified. Please login.' });
    }

    // Check OTP match
    if (user.emailVerifyOTP !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please check your email and try again.' });
    }

    // Check OTP expiry
    if (!user.emailVerifyOTPExpiry || user.emailVerifyOTPExpiry < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please register again to get a new OTP.' });
    }

    // Mark as verified and clear OTP fields
    user.isEmailVerified      = true;
    user.emailVerifyOTP       = undefined;
    user.emailVerifyOTPExpiry = undefined;

    // Generate tokens
    const accessToken  = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken  = refreshToken;
    user.lastLoginAt   = new Date();
    await user.save({ validateBeforeSave: false });

    // Send welcome email (non-blocking)
    sendWelcomeEmail({ to: user.email, name: user.name }).catch(err =>
      console.error('Welcome email failed:', err.message)
    );

    return res.status(200).json({
      success: true,
      message: 'Email verified! Welcome to SpendWise 🎉',
      data: {
        user: sanitizeUser(user),
        accessToken,
        refreshToken,
      },
    });

  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// POST /api/auth/resend-otp
//─────────────────────────────────────
const resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() }).select('+emailVerifyOTP +emailVerifyOTPExpiry');

    if (!user)                return res.status(404).json({ success: false, message: 'Account not found.' });
    if (user.isEmailVerified) return res.status(400).json({ success: false, message: 'Email is already verified.' });

    const otp       = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.emailVerifyOTP       = otp;
    user.emailVerifyOTPExpiry = otpExpiry;
    await user.save({ validateBeforeSave: false });

    sendOTPEmail({ to: user.email, name: user.name, otp }).catch(err =>
      console.error('Resend OTP email failed:', err.message)
    );

    return res.status(200).json({ success: true, message: 'A new OTP has been sent to your email.' });

  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// POST /api/auth/login
//─────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password +refreshToken');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact support.' });
    }

    // Block login if email not verified
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in.',
        data: { requiresVerification: true, email: user.email },
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const accessToken  = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    user.lastLoginAt  = new Date();
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: 'Login successful!',
      data: { user: sanitizeUser(user), accessToken, refreshToken },
    });

  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// POST /api/auth/refresh
//─────────────────────────────────────
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token is required.' });
    }

    let decoded;
    try { decoded = verifyRefreshToken(token); }
    catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
    }

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== token) {
      return res.status(401).json({ success: false, message: 'Refresh token is invalid or has been revoked.' });
    }

    const newAccessToken  = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);
    user.refreshToken     = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: 'Tokens refreshed.',
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    });

  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// POST /api/auth/logout  (protected)
//─────────────────────────────────────
const logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// GET /api/auth/me  (protected)
//─────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.status(200).json({ success: true, data: { user: sanitizeUser(user) } });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// PUT /api/auth/profile  (protected)
//─────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const allowed = ['name', 'phone', 'currency', 'language', 'timezone', 'monthlyIncome', 'notifications', 'smsTracking'];
    const updates = {};
    allowed.forEach(field => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });

    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true });
    return res.status(200).json({ success: true, message: 'Profile updated.', data: { user: sanitizeUser(user) } });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// PUT /api/auth/change-password  (protected)
//─────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();

    // Notify user by email (non-blocking)
    sendPasswordChangedEmail({ to: user.email, name: user.name }).catch(err =>
      console.error('Password change email failed:', err.message)
    );

    return res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  verifyOTP,
  resendOTP,
  login,
  refreshToken,
  logout,
  getMe,
  updateProfile,
  changePassword,
};