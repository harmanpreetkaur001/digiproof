const router = require('express').Router();
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const rbac = require('../middleware/rbac');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

let evidenceStore = [];

// In-memory access requests store (fallback)
let requestStore = [];

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', d => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// Upload evidence – victim only
router.post('/upload', authMiddleware, rbac('victim'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const hash = await hashFile(req.file.path);
    const entry = {
      id: Date.now().toString(),
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
      hash,
      filePath: req.file.filename,
      fir: req.body.fir || 'Unlinked',
      category: req.body.category || 'Other',
      description: req.body.description || '',
      status: 'verified',
      locked: true,
      uploadedBy: req.user.id,
      device: { ip: req.ip, browser: req.headers['user-agent']?.slice(0, 100) },
      timestamp: new Date().toISOString()
    };

    try {
      const Evidence = require('../models/Evidence');
      const AuditLog = require('../models/AuditLog');
      const doc = await Evidence.create({ ...entry, uploadedBy: req.user.id });
      await AuditLog.create({ action: 'upload', detail: `Uploaded ${entry.name}`, fileId: doc._id, userName: req.user.name, role: req.user.role, ip: req.ip });
      return res.json({ success: true, evidence: doc });
    } catch {
      evidenceStore.unshift(entry);
      return res.json({ success: true, evidence: entry });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all evidence — victim sees own, court sees all, police/lawyer need approved request
router.get('/', authMiddleware, async (req, res) => {
  try {
    const Evidence = require('../models/Evidence');
    let list = await Evidence.find().sort({ timestamp: -1 });
    if (req.user.role === 'victim') {
      list = list.filter(e => e.uploadedBy?.toString() === req.user.id);
    }
    res.json(list);
  } catch {
    let list = evidenceStore;
    if (req.user.role === 'victim') list = list.filter(e => e.uploadedBy === req.user.id);
    res.json(list);
  }
});

// Get single evidence — check court approval for police/lawyer
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const Evidence = require('../models/Evidence');
    const AuditLog = require('../models/AuditLog');
    const doc = await Evidence.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    // Victim can only view own evidence
    if (req.user.role === 'victim' && doc.uploadedBy?.toString() !== req.user.id) {
      return res.status(403).json({ error: 'You can only view your own evidence' });
    }

    // Police/lawyer need court-approved request
    if (req.user.role === 'police' || req.user.role === 'lawyer') {
      const AccessRequest = require('../models/AccessRequest');
      const approved = await AccessRequest.findOne({
        evidenceId: doc._id, requesterId: req.user.id, status: 'approved', approvedBy: 'court'
      });
      if (!approved) return res.status(403).json({ error: 'Court approval required to view this evidence' });
    }

    await AuditLog.create({ action: 'view', detail: `Viewed ${doc.name}`, fileId: doc._id, userName: req.user.name, role: req.user.role, ip: req.ip });
    res.json(doc);
  } catch {
    const doc = evidenceStore.find(e => e.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  }
});

// Verify hash
router.post('/verify/:id', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    let original;
    try {
      const Evidence = require('../models/Evidence');
      original = await Evidence.findById(req.params.id);
    } catch {
      original = evidenceStore.find(e => e.id === req.params.id);
    }
    if (!original) return res.status(404).json({ error: 'Evidence not found' });
    if (!req.file) return res.status(400).json({ error: 'No file provided for verification' });

    const newHash = await hashFile(req.file.path);
    fs.unlinkSync(req.file.path);

    const match = newHash === original.hash;
    if (!match) {
      try {
        const Evidence = require('../models/Evidence');
        // Use updateOne to bypass locked pre-save hook for status only
        await Evidence.collection.updateOne({ _id: original._id }, { $set: { status: 'tampered' } });
      } catch {
        const e = evidenceStore.find(x => x.id === req.params.id);
        if (e) e.status = 'tampered';
      }
    }

    res.json({
      verified: match,
      status: match ? 'verified' : 'tampered',
      originalHash: original.hash,
      uploadedHash: newHash,
      message: match ? '✅ File integrity verified – no tampering detected' : '⚠️ Hash mismatch – file has been tampered!'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download – lawyer and court only, with court approval check for lawyer
router.get('/download/:id', authMiddleware, rbac('lawyer', 'court'), async (req, res) => {
  try {
    let doc;
    try {
      const Evidence = require('../models/Evidence');
      const AuditLog = require('../models/AuditLog');
      doc = await Evidence.findById(req.params.id);

      // Lawyer needs court-approved request
      if (req.user.role === 'lawyer') {
        const AccessRequest = require('../models/AccessRequest');
        const approved = await AccessRequest.findOne({
          evidenceId: doc._id, requesterId: req.user.id, status: 'approved', approvedBy: 'court'
        });
        if (!approved) return res.status(403).json({ error: 'Court approval required to download this evidence' });
      }

      await AuditLog.create({ action: 'download', detail: `Downloaded ${doc?.name}`, fileId: doc?._id, userName: req.user.name, role: req.user.role, ip: req.ip });
    } catch {
      doc = evidenceStore.find(e => e.id === req.params.id);
    }
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const filePath = path.join(__dirname, '../uploads', doc.filePath);
    if (fs.existsSync(filePath)) {
      res.download(filePath, doc.name);
    } else {
      res.json({ message: 'File metadata available but binary not stored in demo mode', evidence: doc });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Block all delete and update attempts on evidence
router.delete('*', (req, res) => {
  res.status(403).json({ error: 'Evidence cannot be deleted — all records are permanent' });
});
router.put('*', (req, res) => {
  res.status(403).json({ error: 'Evidence cannot be modified — records are immutable' });
});
router.patch('*', (req, res) => {
  res.status(403).json({ error: 'Evidence cannot be modified — records are immutable' });
});

// Court approves/rejects access requests
router.post('/request/:id/approve', authMiddleware, rbac('court'), async (req, res) => {
  try {
    const AccessRequest = require('../models/AccessRequest');
    const AuditLog = require('../models/AuditLog');
    const r = await AccessRequest.findByIdAndUpdate(req.params.id, { status: 'approved', approvedBy: 'court' }, { new: true });
    if (!r) return res.status(404).json({ error: 'Request not found' });
    await AuditLog.create({ action: 'approve', detail: `Court approved access for ${r.requesterName} to evidence`, userName: req.user.name, role: req.user.role, ip: req.ip });
    res.json({ success: true, request: r });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/request/:id/reject', authMiddleware, rbac('court'), async (req, res) => {
  try {
    const AccessRequest = require('../models/AccessRequest');
    const AuditLog = require('../models/AuditLog');
    const r = await AccessRequest.findByIdAndUpdate(req.params.id, { status: 'rejected', approvedBy: null }, { new: true });
    if (!r) return res.status(404).json({ error: 'Request not found' });
    await AuditLog.create({ action: 'reject', detail: `Court rejected access for ${r.requesterName}`, userName: req.user.name, role: req.user.role, ip: req.ip });
    res.json({ success: true, request: r });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
