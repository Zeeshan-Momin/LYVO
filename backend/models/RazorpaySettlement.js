const mongoose = require("mongoose");

const settlementTransactionSchema = new mongoose.Schema({
  paymentId: { type: String, required: [true, "Payment ID is required"], trim: true },
  orderId: { type: String, default: "", trim: true },
  lyvoOrderNumber: { type: String, default: "", trim: true },
  lyvoOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  amount: { type: Number, required: [true, "Transaction amount is required"] },
  fee: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  reconciliationStatus: {
    type: String,
    enum: ["matched", "unmatched_order", "amount_mismatch", "duplicate"],
    default: "unmatched_order"
  },
  mismatchReason: { type: String, default: "" }
});

const razorpaySettlementSchema = new mongoose.Schema({
  settlementId: {
    type: String,
    required: [true, "Settlement ID is required"],
    unique: true,
    trim: true
  },
  settlementDate: { type: Date, required: [true, "Settlement date is required"] },
  grossAmount: { type: Number, required: [true, "Gross amount is required"] },
  feeAmount: { type: Number, required: [true, "Fee amount is required"] },
  taxAmount: { type: Number, required: [true, "Tax amount is required"] },
  feeProvenance: {
    type: String,
    enum: ["actual", "estimated"],
    default: "actual"
  },
  adjustment: { type: Number, default: 0 },
  netAmount: { type: Number, required: [true, "Net settlement amount is required"] },
  utr: { type: String, default: "", trim: true },
  transactions: [settlementTransactionSchema],
  reconciliationSummary: {
    totalTransactions: { type: Number, default: 0 },
    matchedCount: { type: Number, default: 0 },
    unmatchedCount: { type: Number, default: 0 },
    mismatchCount: { type: Number, default: 0 },
    duplicateCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["fully_reconciled", "partially_reconciled", "unreconciled"],
      default: "unreconciled"
    }
  },
  importedAt: { type: Date, default: Date.now },
  importedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

razorpaySettlementSchema.index({ settlementDate: -1 });
razorpaySettlementSchema.index({ "transactions.paymentId": 1 });
razorpaySettlementSchema.index({ "reconciliationSummary.status": 1, settlementDate: -1 });

module.exports = mongoose.model("RazorpaySettlement", razorpaySettlementSchema);
