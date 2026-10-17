const mongoose = require("mongoose");

const exportLogSchema = new mongoose.Schema({
  exportId: { type: String, required: [true, "Export ID is required"], unique: true, index: true },
  reportName: { type: String, required: [true, "Report name is required"], trim: true },
  reportType: { type: String, required: [true, "Report type is required"] },
  format: {
    type: String,
    enum: {
      values: ["xlsx", "csv", "pdf"],
      message: "Format must be xlsx, csv, or pdf"
    },
    required: [true, "Export format is required"]
  },
  filters: { type: mongoose.Schema.Types.Mixed, default: {} },
  recordCount: { type: Number, default: 0, min: 0 },
  fileSize: { type: Number, default: 0, min: 0 },
  fileName: { type: String, default: "" },
  filePath: { type: String, default: "" },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
    index: true
  },
  errorMessage: { type: String, default: "" },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: [true, "User reference is required"] }
}, { timestamps: true });

exportLogSchema.index({ createdAt: -1, generatedBy: 1 });
exportLogSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("ExportLog", exportLogSchema);
