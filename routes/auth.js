const router = require('express').Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendOTPEmail } = require('../utils/mailer');

function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

// ── Register ──────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });

    const User = require('../models/User');
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email already registered' });

    await User.create({ name, email, password, role: role || 'victim' });
    res.json({ success: true, message: 'Registered successfully. Please login.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Step 1: Login — validate credentials, send OTP to Gmail ───────
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const User = require('../models/User');
    const OTP = require('../models/OTP');

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Delete any existing OTP for this email
    await OTP.deleteMany({ email });

    // Generate and store OTP in DB (expires in 5 min)
    const otp = generateOTP();
    await OTP.create({
      email,
      otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });

    // Send OTP via Gmail
    await sendOTPEmail(email, otp, user.name);

    res.json({ success: true, message: `OTP sent to ${email}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Step 2: Verify OTP — issue JWT ────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

    const User = require('../models/User');
    const OTP = require('../models/OTP');
    const AuditLog = require('../models/AuditLog');

    const record = await OTP.findOne({ email });
    if (!record) return res.status(401).json({ error: 'OTP expired or not found. Please login again.' });
    if (new Date() > record.expiresAt) {
      await OTP.deleteOne({ email });
      return res.status(401).json({ error: 'OTP expired. Please login again.' });
    }
    if (record.otp !== otp) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    // OTP verified — delete it
    await OTP.deleteOne({ email });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Log successful 2FA
    await AuditLog.create({
      action: 'login',
      detail: `${user.name} logged in as ${user.role} (2FA verified)`,
      userName: user.name,
      role: user.role,
      ip: req.ip
    });

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Resend OTP ────────────────────────────────────────────────────
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const User = require('../models/User');
    const OTP = require('../models/OTP');

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await OTP.deleteMany({ email });

    const otp = generateOTP();
    await OTP.create({
      email,
      otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });

    await sendOTPEmail(email, otp, user.name);
    res.json({ success: true, message: `New OTP sent to ${email}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
