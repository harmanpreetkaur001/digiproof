const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const rbac = require('../middleware/rbac');

let firStore = [];

router.get('/', authMiddleware, (req, res) => res.json(firStore));

router.post('/', authMiddleware, rbac('victim'), (req, res) => {
  const { firNumber, title, station, date, description } = req.body;
  if (!firNumber || !title) return res.status(400).json({ error: 'FIR number and title required' });
  const fir = { id: firNumber, title, station, date, description, status: 'active', createdBy: req.user.id, createdAt: new Date().toISOString() };
  firStore.unshift(fir);
  res.json({ success: true, fir });
});

router.delete('/:id', authMiddleware, rbac('victim', 'court'), (req, res) => {
  firStore = firStore.filter(f => f.id !== req.params.id);
  res.json({ success: true });
});

module.exports = router;
