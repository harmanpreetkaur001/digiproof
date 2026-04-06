const mongoose = require('mongoose');

const evidenceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  originalName: String,
  type: String,
  size: Number,
  hash: { type: String, required: true },
  filePath: String,
  fir: String,
  category: String,
  description: String,
  status: { type: String, enum: ['verified', 'tampered'], default: 'verified' },
  locked: { type: Boolean, default: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  device: {
    browser: String,
    platform: String,
    ip: String,
    screen: String,
    timezone: String
  },
  timestamp: { type: Date, default: Date.now }
});

// Prevent updates after lock
evidenceSchema.pre('save', function (next) {
  if (!this.isNew && this.locked) {
    const err = new Error('Evidence is locked and cannot be modified');
    err.status = 403;
    return next(err);
  }
  next();
});

module.exports = mongoose.model('Evidence', evidenceSchema);
