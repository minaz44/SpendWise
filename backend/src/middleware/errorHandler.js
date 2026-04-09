// backend/src/middleware/errorHandler.js

const { env } = require('../config/env');

// ─── Response helpers ────────────────────────────────────────────────────────
const sendError = (res, message, statusCode = 500, errors = null) => {
  const body = { success: false, message, timestamp: new Date().toISOString() };
  if (errors && env.isDev) body.errors = errors;
  return res.status(statusCode).json(body);
};

// ─── Async wrapper ───────────────────────────────────────────────────────────
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ─── 404 ─────────────────────────────────────────────────────────────────────
const notFound = (req, res, next) => {
  const error  = new Error(`Route not found: ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

// ─── Global error handler ────────────────────────────────────────────────────
const errorHandler = (err, req, res, next) => {
  let statusCode = err.status || err.statusCode || 500;
  let message    = err.message || 'Internal server error';

  // ── Mongoose errors ──────────────────────────────────────────────────────
  if (err.name === 'ValidationError') {
    statusCode = 422;
    message    = Object.values(err.errors).map(e => e.message).join(', ');
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    message    = `Invalid ${err.path}: ${err.value}`;
  }

  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message    = `${field} already exists.`;
  }

  // ── JWT errors ───────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message    = 'Invalid token. Please login again.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message    = 'Token expired. Please login again.';
  }

  // ── Multer errors ────────────────────────────────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message    = 'File too large. Maximum size is 10MB.';
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    message    = 'Unexpected file field.';
  }

  // ── Razorpay errors ──────────────────────────────────────────────────────
  if (err.statusCode === 400 && err.error?.description) {
    statusCode = 400;
    message    = err.error.description;
  }

  // ── Log ─────────────────────────────────────────────────────────────────
  if (statusCode >= 500) {
    console.error(`[${new Date().toISOString()}] ${statusCode} - ${message}`, {
      url:    req.originalUrl,
      method: req.method,
      ...(env.isDev && { stack: err.stack }),
    });
  } else {
    console.warn(`[${new Date().toISOString()}] ${statusCode} - ${message}`, {
      url:    req.originalUrl,
      method: req.method,
    });
  }

  return sendError(res, message, statusCode, env.isDev ? { stack: err.stack } : null);
};

module.exports = { asyncHandler, notFound, errorHandler, sendError };