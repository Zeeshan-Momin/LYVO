const mongoose = require("mongoose");

const courierInvoiceItemSchema = new mongoose.Schema({
  waybill: { type: String, required: [true, "Waybill / AWB is required"], trim: true },
  orderNumber: { type: String, default: "", trim: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  chargedWeightGrams: { type: Number, default: null },
  freight: { type: Number, default: 0, min: 0 },
  fuelSurcharge: { type: Number, default: 0, min: 0 },
  codHandling: { type: Number, default: 0, min: 0 },
  rtoFreight: { type: Number, default: 0, min: 0 },
  taxAmount: { type: Number, default: 0, min: 0 },
  totalCarrierCharge: { type: Number, required: [true, "Total carrier charge is required"], min: 0 },
  reconciliationStatus: {
    type: String,
    enum: ["matched", "unmatched_awb", "amount_mismatch", "duplicate"],
    default: "unmatched_awb"
  },
  mismatchReason: { type: String, default: "" }
});

const courierInvoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: [true, "Invoice number is required"],
    unique: true,
    trim: true
  },
  invoiceDate: { type: Date, required: [true, "Invoice date is required"] },
  carrier: { type: String, default: "delhivery", trim: true },
  billingPeriod: {
    start: { type: Date, default: null },
    end: { type: Date, default: null }
  },
  totalBilledAmount: { type: Number, required: [true, "Total billed amount is required"], min: 0 },
  totalShipments: { type: Number, default: 0 },
  lineItems: [courierInvoiceItemSchema],
  reconciliationSummary: {
    matchedShipments: { type: Number, default: 0 },
    unmatchedShipments: { type: Number, default: 0 },
    mismatchCount: { type: Number, default: 0 },
    duplicateCount: { type: Number, default: 0 },
    totalActualFreight: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["reconciled", "partially_reconciled", "unreconciled"],
      default: "unreconciled"
    }
  },
  importedAt: { type: Date, default: Date.now },
  importedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

courierInvoiceSchema.index({ invoiceDate: -1 });
courierInvoiceSchema.index({ "lineItems.waybill": 1 });
courierInvoiceSchema.index({ "reconciliationSummary.status": 1, invoiceDate: -1 });

module.exports = mongoose.model("CourierInvoice", courierInvoiceSchema);
