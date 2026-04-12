// backend/src/services/email.service.js

const nodemailer = require('nodemailer');

const createTransporter = () => nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const emailShell = (content) => `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{background:#0D0D1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
  .wrapper{max-width:560px;margin:0 auto;padding:40px 20px;}
  .card{background:#13131f;border:1px solid #2a2a3e;border-radius:20px;overflow:hidden;}
  .header{background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:32px 36px;text-align:center;}
  .logo{font-size:28px;font-weight:900;color:#fff;}
  .tagline{color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;}
  .body{padding:36px;}
  .greeting{font-size:22px;font-weight:700;color:#f1f1f1;margin-bottom:12px;}
  .text{font-size:15px;color:#9ca3af;line-height:1.7;margin-bottom:20px;}
  .otp-box{background:#0D0D1A;border:1.5px solid #6366f1;border-radius:14px;padding:24px;text-align:center;margin:28px 0;}
  .otp-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#6366f1;margin-bottom:10px;}
  .otp-code{font-size:42px;font-weight:900;color:#fff;letter-spacing:12px;}
  .otp-expiry{font-size:12px;color:#6b7280;margin-top:10px;}
  .btn{display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;text-align:center;width:100%;margin:20px 0;box-sizing:border-box;}
  .divider{border:none;border-top:1px solid #2a2a3e;margin:28px 0;}
  .feature-row{display:flex;gap:12px;margin-bottom:14px;align-items:flex-start;}
  .feature-icon{font-size:20px;flex-shrink:0;}
  .feature-text strong{display:block;color:#f1f1f1;font-size:14px;margin-bottom:2px;}
  .feature-text span{color:#6b7280;font-size:13px;}
  .avatar-box{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:#fff;margin:0 auto 16px;}
  .warning-box{background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:14px 16px;font-size:13px;color:#fca5a5;margin-top:20px;}
  .footer{padding:20px 36px 28px;text-align:center;}
  .footer p{font-size:12px;color:#4b5563;line-height:1.8;}
  .footer a{color:#6366f1;text-decoration:none;}
</style></head>
<body><div class="wrapper"><div class="card">
  <div class="header"><div class="logo">💰 SpendWise</div><div class="tagline">AI-Powered Personal Finance</div></div>
  ${content}
  <div class="footer"><p>© 2026 SpendWise · <a href="#">Privacy Policy</a> · <a href="#">Terms</a><br/>If this wasn't you, safely ignore this email.</p></div>
</div></div></body></html>`;

// ── 1. OTP Verification ───────────────────────────────────────────────────────
const sendOTPEmail = async ({ to, name, otp }) => {
  const content = `<div class="body">
    <div class="greeting">Verify your email 🔐</div>
    <p class="text">Hi ${name},<br/>Welcome to SpendWise! Use the OTP below to activate your account.</p>
    <div class="otp-box">
      <div class="otp-label">Your One-Time Password</div>
      <div class="otp-code">${otp}</div>
      <div class="otp-expiry">⏱ Expires in 10 minutes</div>
    </div>
    <p class="text">Do not share this code with anyone.</p>
    <div class="warning-box">⚠️ If you didn't create a SpendWise account, ignore this email.</div>
  </div>`;
  await createTransporter().sendMail({
    from: `"SpendWise" <${process.env.SMTP_USER}>`,
    to, subject: `${otp} — Your SpendWise verification code`, html: emailShell(content),
  });
};

// ── 2. Welcome ────────────────────────────────────────────────────────────────
const sendWelcomeEmail = async ({ to, name }) => {
  const content = `<div class="body">
    <div class="greeting">Welcome to SpendWise, ${name}! 🎉</div>
    <p class="text">Your email is verified. Here's what's waiting for you:</p>
    <hr class="divider"/>
    <div class="feature-row"><div class="feature-icon">🤖</div><div class="feature-text"><strong>AI Auto-Categorization</strong><span>Transactions categorized automatically using Llama 3.3</span></div></div>
    <div class="feature-row"><div class="feature-icon">📊</div><div class="feature-text"><strong>Smart Analytics</strong><span>Monthly insights, trends, and 3-month forecasts</span></div></div>
    <div class="feature-row"><div class="feature-icon">👥</div><div class="feature-text"><strong>Group Splitting</strong><span>Split bills with friends and flatmates effortlessly</span></div></div>
    <div class="feature-row"><div class="feature-icon">🔗</div><div class="feature-text"><strong>Blockchain Audit</strong><span>Every transaction secured on Polygon blockchain</span></div></div>
    <hr class="divider"/>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" class="btn">Open Dashboard →</a>
  </div>`;
  await createTransporter().sendMail({
    from: `"SpendWise" <${process.env.SMTP_USER}>`,
    to, subject: `Welcome to SpendWise, ${name}! 🎉`, html: emailShell(content),
  });
};

// ── 3. Password Changed ───────────────────────────────────────────────────────
const sendPasswordChangedEmail = async ({ to, name }) => {
  const content = `<div class="body">
    <div class="greeting">Password changed ✅</div>
    <p class="text">Hi ${name}, your password was changed on ${new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}.</p>
    <div class="warning-box">⚠️ If this wasn't you, reset your password immediately.</div>
  </div>`;
  await createTransporter().sendMail({
    from: `"SpendWise" <${process.env.SMTP_USER}>`,
    to, subject: 'Your SpendWise password was changed', html: emailShell(content),
  });
};

// ── 4. Budget Alert ───────────────────────────────────────────────────────────
const sendBudgetAlertEmail = async ({ to, name, percent, spent, limit }) => {
  const isOver = percent >= 100;
  const content = `<div class="body">
    <div class="greeting">${isOver ? '🚨 Budget exceeded!' : `⚠️ ${percent}% of budget used`}</div>
    <p class="text">Hi ${name}, here's your monthly budget update:</p>
    <div class="otp-box">
      <div class="otp-label">${isOver ? 'Over Budget' : 'Budget Warning'}</div>
      <div class="otp-code" style="font-size:28px;letter-spacing:2px;">₹${spent.toLocaleString('en-IN')} / ₹${limit.toLocaleString('en-IN')}</div>
      <div class="otp-expiry">${percent}% used</div>
    </div>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/analytics" class="btn">View Analytics →</a>
  </div>`;
  await createTransporter().sendMail({
    from: `"SpendWise" <${process.env.SMTP_USER}>`,
    to, subject: isOver ? '🚨 Budget exceeded!' : `⚠️ ${percent}% of budget used`, html: emailShell(content),
  });
};

// ── 5. Group Invite ───────────────────────────────────────────────────────────
const sendGroupInviteEmail = async ({ to, inviteeName, inviterName, groupName, groupType }) => {
  const content = `<div class="body">
    <div class="greeting">You've been invited! 👥</div>
    <p class="text">Hi ${inviteeName || 'there'},<br/><strong>${inviterName}</strong> added you to the <strong>"${groupName}"</strong> ${groupType} group on SpendWise.</p>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/register" class="btn">Join SpendWise & View Group →</a>
  </div>`;
  await createTransporter().sendMail({
    from: `"SpendWise" <${process.env.SMTP_USER}>`,
    to, subject: `${inviterName} added you to "${groupName}" on SpendWise`, html: emailShell(content),
  });
};

// ── 6. Friend Request ─────────────────────────────────────────────────────────
const sendFriendRequestEmail = async ({ to, toName, fromName, fromEmail }) => {
  const initials = fromName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const content = `<div class="body">
    <div class="avatar-box">${initials}</div>
    <div class="greeting" style="text-align:center;">Friend Request 👋</div>
    <p class="text" style="text-align:center;">
      <strong>${fromName}</strong> (${fromEmail}) wants to connect with you on SpendWise to split expenses together.
    </p>
    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/friends" class="btn">Accept Friend Request →</a>
    <p class="text" style="font-size:13px;text-align:center;margin-top:8px;">
      Go to Friends page in SpendWise to accept or decline.
    </p>
  </div>`;
  await createTransporter().sendMail({
    from: `"SpendWise" <${process.env.SMTP_USER}>`,
    to, subject: `${fromName} sent you a friend request on SpendWise`, html: emailShell(content),
  });
};

// ── Verify connection ─────────────────────────────────────────────────────────
const verifyEmailConnection = async () => {
  try {
    await createTransporter().verify();
    console.log('✅ Email service connected:', process.env.SMTP_USER);
  } catch (err) {
    console.warn('⚠️  Email service not configured:', err.message);
  }
};

module.exports = {
  sendOTPEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
  sendBudgetAlertEmail,
  sendGroupInviteEmail,
  sendFriendRequestEmail,
  verifyEmailConnection,
};