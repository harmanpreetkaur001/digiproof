const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

async function sendOTPEmail(toEmail, otp, userName) {
  await transporter.sendMail({
    from: `"LockBox Security" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: '🔐 Your LockBox 2FA Verification Code',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0f1117;color:#e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#4f6ef7,#7c3aed);padding:28px 32px;text-align:center">
          <div style="font-size:36px">🔒</div>
          <h1 style="margin:8px 0 0;font-size:22px;color:#fff">LockBox</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px">Digital Evidence Vault</p>
        </div>
        <div style="padding:32px">
          <p style="margin:0 0 8px;color:#94a3b8;font-size:14px">Hello, <strong style="color:#e2e8f0">${userName}</strong></p>
          <p style="margin:0 0 24px;color:#94a3b8;font-size:14px">Your 2-step verification code for LockBox login:</p>
          <div style="background:#1e2433;border:2px solid #4f6ef7;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px">
            <div style="font-size:38px;font-weight:800;letter-spacing:12px;color:#4f6ef7;font-family:monospace">${otp}</div>
          </div>
          <p style="margin:0 0 8px;color:#64748b;font-size:12px">This code expires in <strong>5 minutes</strong>.</p>
          <p style="margin:0;color:#64748b;font-size:12px">If you did not request this, please ignore this email.</p>
        </div>
        <div style="background:#0a0d14;padding:16px 32px;text-align:center">
          <p style="margin:0;color:#475569;font-size:11px">LockBox — India Justice Tech | Tamper-proof Evidence Management</p>
        </div>
      </div>
    `
  });
}

module.exports = { sendOTPEmail };
