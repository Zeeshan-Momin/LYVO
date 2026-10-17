const mongoose = require("mongoose");

const stockInwardItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: [true, "Product reference is required"] },
  sku: { type: String, default: "", trim: true },
  name: { type: String, required: [true, "Product name is required"], trim: true },
  quantityReceived: {
    type: Number,
    required: [true, "Quantity received is required"],
    min: [1, "Quantity received must be at least 1"]
  },
  unitCost: {
    type: Number,
    required: [true, "Unit cost is required"],
    min: [0, "Unit cost cannot be negative"]
  },
  taxAmount: { type: Number, default: 0, min: [0, "Tax amount cannot be negative"] },
  freightShare: { type: Number, default: 0, min: [0, "Freight share cannot be negative"] },
  landedUnitCost: {
    type: Number,
    required: [true, "Landed unit cost is required"],
    min: [0, "Landed unit cost cannot be negative"]
  }
});

const stockInwardSchema = new mongoose.Schema({
  grnNumber: {
    type: String,
    required: [true, "GRN number is required"],
    unique: true,
    uppercase: true,
    trim: true
  },
  supplier: {
    name: { type: String, required: [true, "Supplier name is required"], trim: true },
    gstin: { type: String, default: "", uppercase: true, trim: true },
    contact: { type: String, default: "", trim: true }
  },
  invoiceNumber: { type: String, default: "", trim: true },
  invoiceDate: { type: Date, default: null },
  receivedDate: { type: Date, required: [true, "Received date is required"], default: Date.now },
  items: {
    type: [stockInwardItemSchema],
    validate: {
      validator: function(items) {
        return Array.isArray(items) && items.length > 0;
      },
      message: "At least one received item is required"
    }
  },
  totalQuantity: { type: Number, default: 0 },
  totalGrossCost: { type: Number, default: 0 },
  totalLandedCost: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["draft", "received", "cancelled"],
    default: "received"
  },
  notes: { type: String, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

stockInwardSchema.pre("validate", function(next) {
  if (this.items && this.items.length > 0) {
    this.totalQuantity = this.items.reduce((sum, item) => sum + (item.quantityReceived || 0), 0);
    this.totalGrossCost = this.items.reduce((sum, item) => sum + ((item.quantityReceived || 0) * (item.unitCost || 0)), 0);
    this.totalLandedCost = this.items.reduce((sum, item) => sum + ((item.quantityReceived || 0) * (item.landedUnitCost || 0)), 0);
  }
  next();
});

stockInwardSchema.index({ receivedDate: -1 });
stockInwardSchema.index({ "items.product": 1, receivedDate: -1 });
stockInwardSchema.index({ status: 1, receivedDate: -1 });

module.exports = mongoose.model("StockInward", stockInwardSchema);
