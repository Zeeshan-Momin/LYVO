const mongoose = require("mongoose");

const savedReportSchema = new mongoose.Schema({
  name: { type: String, required: [true, "Report template name is required"], trim: true },
  description: { type: String, default: "", trim: true },
  reportType: {
    type: String,
    enum: {
      values: [
        "financial_pnl",
        "tax_liability",
        "sales_deep",
        "inventory_cost",
        "expenses",
        "settlement_reconciliation",
        "logistics_reconciliation",
        "product_profitability",
        "category_profitability",
        "channel_profitability",
        "order_profitability",
        "custom"
      ],
      message: "Invalid report type"
    },
    required: [true, "Report type is required"]
  },
  filters: { type: mongoose.Schema.Types.Mixed, default: {} },
  selectedColumns: [{ type: String }],
  sortBy: { type: String, default: "createdAt" },
  sortDir: { type: String, enum: ["asc", "desc"], default: "desc" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: [true, "Creator reference is required"] }
}, { timestamps: true });

savedReportSchema.index({ createdBy: 1, createdAt: -1 });
savedReportSchema.index({ reportType: 1, createdAt: -1 });

module.exports = mongoose.model("SavedReport", savedReportSchema);
