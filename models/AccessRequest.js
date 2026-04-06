const mongoose = require('mongoose');

const accessRequestSchema = new mongoose.Schema({
  evidenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Evidence', required: true },
  evidenceName: String,
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requesterName: String,
  requesterRole: { type: String, enum: ['police', 'lawyer'] },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approvedBy: { type: String, default: null }, // 'court' when approved
  requestedAt: { type: Date, default: Date.now }
});

// Access requests cannot be deleted
accessRequestSchema.pre(['deleteOne','findOneAndDelete','findByIdAndDelete'], function() {
  throw new Error('Access request records are immutable and cannot be deleted');
});

module.exports = mongoose.model('AccessRequest', accessRequestSchema);
