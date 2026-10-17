const mongoose = require("mongoose");

const taxRuleSchema = new mongoose.Schema({
  ruleCode: { type: String, required: true, uppercase: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  hsnCode: { type: String, required: true, trim: true, index: true },
  effectiveFrom: { type: Date, required: true },
  effectiveTo: { type: Date, default: null },
  version: { type: String, required: true, trim: true },

  taxType: { type: String, enum: ["GST"], default: "GST" },
  ratePercent: { type: Number, required: true, min: 0 },
  cgstPercent: { type: Number, required: true, min: 0 },
  sgstPercent: { type: Number, required: true, min: 0 },
  igstPercent: { type: Number, required: true, min: 0 },
  cessPercent: { type: Number, default: 0, min: 0 },

  hasSlabs: { type: Boolean, default: false },
  slabs: [{
    minPrice: Number,
    maxPrice: Number,
    ratePercent: Number,
    cgstPercent: Number,
    sgstPercent: Number,
    igstPercent: Number
  }],

  isTaxInclusiveDefault: { type: Boolean, default: true },
  isActive: { type: Boolean, default: false }, // Inactive until verified by CA/business
  notes: { type: String, default: "" },
  verifiedByAccountant: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: null }
}, { timestamps: true });

taxRuleSchema.index({ hsnCode: 1, effectiveFrom: -1, isActive: 1 });

module.exports = mongoose.model("TaxRule", taxRuleSchema);
