// backend/src/services/sms.service.js

const axios = require('axios');

/**
 * Send SMS via Fast2SMS (free tier — India only)
 * Sign up at https://www.fast2sms.com to get your API key.
 * Add to .env:  FAST2SMS_API_KEY=your_key_here
 */
const sendSMS = async ({ phone, message }) => {
  const apiKey = process.env.FAST2SMS_API_KEY;

  if (!apiKey) {
    console.warn('⚠️  FAST2SMS_API_KEY not set — SMS not sent');
    // In dev/test, just log the message instead of crashing
    console.log(`[SMS MOCK] To: ${phone} | Message: ${message}`);
    return { success: false, mock: true };
  }

  // Normalize phone — strip +91 or 0 prefix, keep 10 digits
  const normalized = phone.replace(/^\+91/, '').replace(/^0/, '').replace(/\D/g, '');
  if (normalized.length !== 10) {
    throw new Error(`Invalid Indian phone number: ${phone}`);
  }

  const response = await axios.post(
    'https://www.fast2sms.com/dev/bulkV2',
    {
      route:   'q',          // Quick SMS (transactional)
      numbers: normalized,
      message,
      flash:   0,
    },
    {
      headers: {
        authorization: apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );

  if (!response.data.return) {
    throw new Error(response.data.message || 'Fast2SMS send failed');
  }

  return { success: true, data: response.data };
};

/**
 * Send friend invite SMS to a non-SpendWise user
 */
const sendFriendInviteSMS = async ({ phone, fromName, inviteLink }) => {
  const message =
    `Hi! ${fromName} wants to split expenses with you on SpendWise 💰. ` +
    `Join free: ${inviteLink || 'https://spendwise.app'}`;

  return sendSMS({ phone, message });
};

/**
 * Send friend request notification SMS to an existing SpendWise user
 */
const sendFriendRequestSMS = async ({ phone, fromName }) => {
  const message =
    `SpendWise: ${fromName} sent you a friend request! ` +
    `Open the app to accept and start splitting expenses.`;

  return sendSMS({ phone, message });
};

module.exports = {
  sendSMS,
  sendFriendInviteSMS,
  sendFriendRequestSMS,
};