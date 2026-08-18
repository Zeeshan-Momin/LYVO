const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  tokenFamily: {
    type: String,
    required: true
  },
  refreshTokenHash: {
    type: String,
    required: true
  },
  ipAddress: String,
  userAgent: String,
  device: String,
  browser: String,
  isValid: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, { timestamps: true });

// Create compound index for querying and automatic index cleanup
sessionSchema.index({ refreshTokenHash: 1 });
sessionSchema.index({ userId: 1 });

module.exports = mongoose.model("Session", sessionSchema);
