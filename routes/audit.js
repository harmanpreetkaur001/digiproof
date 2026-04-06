const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const rbac = require('../middleware/rbac');

// Audit route — GET only, no delete endpoint
router.get('/', authMiddleware, async (req, res) => {
  try {
    const AuditLog = require('../models/AuditLog');
    const { action, role, limit = 500 } = req.query;
    const filter = {};
    if (action) filter.action = action;
    if (role) filter.role = role;
    const logs = await AuditLog.find(filter).sort({ time: -1 }).limit(Number(limit));
    res.json(logs);
  } catch {
    res.json([]);
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const AuditLog = require('../models/AuditLog');
    const log = await AuditLog.create({
      ...req.body,
      userName: req.user.name,
      role: req.user.role,
      ip: req.ip
    });
    res.json(log);
  } catch {
    res.json({ success: true });
  }
});

// Block any delete attempts on audit logs
router.delete('*', (req, res) => {
  res.status(403).json({ error: 'Audit logs are immutable and cannot be deleted' });
});

module.exports = router;
