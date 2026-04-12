// backend/src/middleware/validators/transaction.validator.js

const { body, query, param, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed.',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// Create transaction
const createTransactionValidator = [
  body('type')
    .notEmpty().withMessage('Type is required.')
    .isIn(['expense', 'income', 'transfer']).withMessage('Type must be expense, income, or transfer.'),

  body('amount')
    .notEmpty().withMessage('Amount is required.')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0.'),

  body('date')
    .optional()
    .isISO8601().withMessage('Date must be a valid date.'),

  body('currency')
    .optional()
    .isIn(['INR', 'USD', 'EUR', 'GBP', 'AED']).withMessage('Invalid currency.'),

  body('categoryId')
    .optional()
    .isMongoId().withMessage('Invalid category ID.'),

  body('paymentMethod')
    .optional()
    .isIn(['upi', 'cash', 'card', 'netbanking', 'wallet', 'cheque', 'other'])
    .withMessage('Invalid payment method.'),

  body('merchant')
    .optional()
    .isLength({ max: 100 }).withMessage('Merchant name too long.'),

  body('description')
    .optional()
    .isLength({ max: 500 }).withMessage('Description too long.'),

  body('notes')
    .optional()
    .isLength({ max: 1000 }).withMessage('Notes too long.'),

  body('tags')
    .optional()
    .isArray().withMessage('Tags must be an array.'),

  validate,
];

// Update transaction
const updateTransactionValidator = [
  param('id')
    .isMongoId().withMessage('Invalid transaction ID.'),

  body('type')
    .optional()
    .isIn(['expense', 'income', 'transfer']).withMessage('Invalid type.'),

  body('amount')
    .optional()
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0.'),

  body('date')
    .optional()
    .isISO8601().withMessage('Invalid date.'),

  body('categoryId')
    .optional()
    .isMongoId().withMessage('Invalid category ID.'),

  body('paymentMethod')
    .optional()
    .customSanitizer(value => value ? value.toLowerCase() : value)
    .isIn(['upi', 'cash', 'card', 'netbanking', 'wallet', 'cheque', 'other'])
    .withMessage('Invalid payment method.'),

  validate,
];

// Get transactions query
const getTransactionsValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer.'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.'),

  query('type')
    .optional()
    .isIn(['expense', 'income', 'transfer']).withMessage('Invalid type.'),

  query('sortBy')
    .optional()
    .isIn(['date', 'amount', 'createdAt']).withMessage('Invalid sort field.'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc.'),

  query('minAmount')
    .optional()
    .isFloat({ min: 0 }).withMessage('Min amount must be positive.'),

  query('maxAmount')
    .optional()
    .isFloat({ min: 0 }).withMessage('Max amount must be positive.'),

  query('startDate')
    .optional()
    .isISO8601().withMessage('Invalid start date.'),

  query('endDate')
    .optional()
    .isISO8601().withMessage('Invalid end date.'),

  query('month')
    .optional()
    .isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12.'),

  query('year')
    .optional()
    .isInt({ min: 2000 }).withMessage('Invalid year.'),

  validate,
];

module.exports = {
  createTransactionValidator,
  updateTransactionValidator,
  getTransactionsValidator,
};