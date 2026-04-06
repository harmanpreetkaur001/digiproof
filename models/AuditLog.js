const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema({
  action: { type: String, required: true },
  detail: String,
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  role: String,
  ip: String,
  time: { type: Date, default: Date.now }
});

// Audit logs are immutable — block all updates and deletes
auditSchema.pre(['updateOne','findOneAndUpdate','findByIdAndUpdate','deleteOne','findOneAndDelete','findByIdAndDelete'], function() {
  throw new Error('Audit logs are immutable and cannot be modified or deleted');
});

module.exports = mongoose.model('AuditLog', auditSchema);
