const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
  expenseDate: { type: Date, required: [true, "Expense date is required"] },
  category: {
    type: String,
    enum: {
      values: [
        "marketing",
        "logistics_freight",
        "packaging",
        "software_it",
        "rent_utilities",
        "salaries",
        "legal_accounting",
        "bank_charges",
        "procurement",
        "other"
      ],
      message: "Invalid expense category"
    },
    required: [true, "Expense category is required"]
  },
  subcategory: { type: String, default: "", trim: true },
  description: { type: String, required: [true, "Description is required"], trim: true },
  vendor: {
    name: { type: String, required: [true, "Vendor name is required"], trim: true },
    gstin: { type: String, default: "", uppercase: true, trim: true },
    pan: { type: String, default: "", uppercase: true, trim: true }
  },
  invoiceNumber: { type: String, default: "", trim: true },
  invoiceDate: { type: Date, default: null },
  taxableAmount: {
    type: Number,
    required: [true, "Taxable amount is required"],
    min: [0, "Taxable amount cannot be negative"]
  },
  cgst: { type: Number, default: 0, min: [0, "CGST cannot be negative"] },
  sgst: { type: Number, default: 0, min: [0, "SGST cannot be negative"] },
  igst: { type: Number, default: 0, min: [0, "IGST cannot be negative"] },
  cess: { type: Number, default: 0, min: [0, "CESS cannot be negative"] },
  totalGst: { type: Number, default: 0, min: [0, "Total GST cannot be negative"] },
  grossAmount: {
    type: Number,
    required: [true, "Gross amount is required"],
    min: [0, "Gross amount cannot be negative"]
  },
  paymentMethod: {
    type: String,
    enum: ["bank_transfer", "upi", "card", "cash", "other"],
    default: "bank_transfer"
  },
  paymentStatus: {
    type: String,
    enum: ["paid", "unpaid", "partially_paid"],
    default: "paid"
  },
  itcEligibility: {
    type: String,
    enum: ["eligible", "ineligible", "blocked", "pending_verification"],
    default: "pending_verification"
  },
  itcClaimed: { type: Boolean, default: false },
  itcAmount: { type: Number, default: 0, min: [0, "ITC amount cannot be negative"] },
  attachmentUrl: { type: String, default: "" },
  notes: { type: String, default: "" },
  status: {
    type: String,
    enum: ["draft", "approved", "cancelled"],
    default: "approved"
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

expenseSchema.pre("validate", function(next) {
  if (this.cgst || this.sgst || this.igst || this.cess) {
    this.totalGst = (this.cgst || 0) + (this.sgst || 0) + (this.igst || 0) + (this.cess || 0);
  }
  if (!this.grossAmount && this.taxableAmount !== undefined) {
    this.grossAmount = this.taxableAmount + (this.totalGst || 0);
  }
  // ITC amount can never exceed total GST
  if (this.itcEligibility === "eligible" && (!this.itcAmount || this.itcAmount === 0)) {
    this.itcAmount = this.totalGst;
  } else if (this.itcEligibility === "ineligible" || this.itcEligibility === "blocked") {
    this.itcAmount = 0;
  }
  next();
});

expenseSchema.index({ expenseDate: -1, category: 1 });
expenseSchema.index({ "vendor.gstin": 1 });
expenseSchema.index({ status: 1, expenseDate: -1 });

module.exports = mongoose.model("Expense", expenseSchema);
