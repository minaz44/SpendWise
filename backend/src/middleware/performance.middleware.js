// backend/src/middleware/performance.middleware.js

const compression = require('compression');

//─────────────────────────────────────
// 1. Response Compression
//─────────────────────────────────────
const compressResponse = compression({
  level:  6, // balanced speed/compression
  filter: (req, res) => {
    // Don't compress small responses
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  threshold: 1024, // only compress if > 1KB
});

//─────────────────────────────────────
// 2. Response Time Tracking
//─────────────────────────────────────
const trackResponseTime = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    // Only set header if not already sent
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${duration}ms`);
    }
    if (duration > 2000) {
      console.warn(`⚠️  Slow response: ${req.method} ${req.path} took ${duration}ms`);
    }
  });

  next();
};

//─────────────────────────────────────
// 3. Cache Control Headers
//─────────────────────────────────────
const setCacheHeaders = (req, res, next) => {
  // Never cache auth endpoints
  if (req.path.includes('/auth/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    return next();
  }

  // Cache static-ish data for 5 minutes
  if (req.method === 'GET' && req.path.includes('/categories')) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    return next();
  }

  // Default — no cache for API responses
  res.setHeader('Cache-Control', 'no-store');
  next();
};

//─────────────────────────────────────
// 4. Request ID (for tracing)
//─────────────────────────────────────
const attachRequestId = (req, res, next) => {
  const requestId = `sw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  req.requestId   = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

//─────────────────────────────────────
// 5. Pagination defaults enforcer
//─────────────────────────────────────
const enforcePaginationLimits = (req, res, next) => {
  if (req.query.limit) {
    const limit = parseInt(req.query.limit);
    if (limit > 100) req.query.limit = '100';
    if (limit < 1)   req.query.limit = '10';
  }
  if (req.query.page) {
    const page = parseInt(req.query.page);
    if (page < 1) req.query.page = '1';
  }
  next();
};

//─────────────────────────────────────
// 6. Health metrics collector
//─────────────────────────────────────
const metrics = {
  requests:     0,
  errors:       0,
  avgResponseTime: 0,
  startTime:    Date.now(),
};

const collectMetrics = (req, res, next) => {
  metrics.requests++;
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.avgResponseTime = Math.round(
      (metrics.avgResponseTime * (metrics.requests - 1) + duration) / metrics.requests
    );
    if (res.statusCode >= 400) metrics.errors++;
  });

  next();
};

const getMetrics = () => ({
  ...metrics,
  uptime:       Math.round((Date.now() - metrics.startTime) / 1000),
  errorRate:    metrics.requests > 0
    ? parseFloat(((metrics.errors / metrics.requests) * 100).toFixed(2))
    : 0,
});

module.exports = {
  compressResponse,
  trackResponseTime,
  setCacheHeaders,
  attachRequestId,
  enforcePaginationLimits,
  collectMetrics,
  getMetrics,
};