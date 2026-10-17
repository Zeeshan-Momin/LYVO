const mongoose = require("mongoose");
const SavedReport = require("../models/SavedReport");
const Order = require("../models/Order");
const Expense = require("../models/Expense");
const RazorpaySettlement = require("../models/RazorpaySettlement");
const CourierInvoice = require("../models/CourierInvoice");
const financeService = require("./financeService");
const taxService = require("./taxService");
const expenseService = require("./expenseService");
const profitabilityService = require("./profitabilityService");

const ALLOWED_REPORT_TYPES = [
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
];

const ALLOWED_DIMENSIONS = [
  "product",
  "sku",
  "category",
  "gender",
  "channel",
  "paymentMethod",
  "order",
  "orderNumber",
  "date",
  "month"
];

const ALLOWED_METRICS = [
  "unitsSold",
  "orderCount",
  "grossMerchandiseSales",
  "productDiscounts",
  "couponDiscounts",
  "couponAllocated",
  "netMerchandiseSales",
  "shippingRevenue",
  "refunds",
  "netRevenue",
  "knownCogs",
  "estimatedCogs",
  "totalCogs",
  "unknownCostUnits",
  "cogsCoveragePercent",
  "grossProfit",
  "grossMarginPercent",
  "gatewayFee",
  "freightCost",
  "contributionProfit",
  "contributionMarginPercent",
  "taxCollected"
];

function sanitizeFilterValue(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") {
    // Disallow raw MongoDB operator injections like {$gt: ...} or {$where: ...}
    const err = new Error("Invalid filter parameter structure");
    err.statusCode = 400;
    throw err;
  }
  return String(val).trim();
}

/**
 * Validates and normalizes report definition parameters
 */
function validateReportDefinition({
  reportType,
  dimensions = [],
  metrics = [],
  filters = {},
  selectedColumns = [],
  sortBy = "grossMerchandiseSales",
  sortDir = "desc",
  page = 1,
  limit = 50
}) {
  if (!reportType || !ALLOWED_REPORT_TYPES.includes(reportType)) {
    const err = new Error(`Invalid report type '${reportType}'. Allowed types: ${ALLOWED_REPORT_TYPES.join(", ")}`);
    err.statusCode = 400;
    throw err;
  }

  // Validate dimensions
  if (Array.isArray(dimensions)) {
    for (const dim of dimensions) {
      if (!ALLOWED_DIMENSIONS.includes(dim)) {
        const err = new Error(`Invalid dimension '${dim}'. Allowed dimensions: ${ALLOWED_DIMENSIONS.join(", ")}`);
        err.statusCode = 400;
        throw err;
      }
    }
  }

  // Validate metrics
  if (Array.isArray(metrics)) {
    for (const m of metrics) {
      if (!ALLOWED_METRICS.includes(m)) {
        const err = new Error(`Invalid metric '${m}'. Allowed metrics: ${ALLOWED_METRICS.join(", ")}`);
        err.statusCode = 400;
        throw err;
      }
    }
  }

  // Sanitize filters
  const sanitizedFilters = {};
  if (filters && typeof filters === "object") {
    for (const [k, v] of Object.entries(filters)) {
      if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        const err = new Error(`Invalid filter operator structure for '${k}'`);
        err.statusCode = 400;
        throw err;
      }
      sanitizedFilters[k] = v;
    }
  }

  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.max(1, Math.min(1000, parseInt(limit, 10) || 50));

  return {
    reportType,
    dimensions: Array.isArray(dimensions) ? dimensions : [],
    metrics: Array.isArray(metrics) ? metrics : [],
    filters: sanitizedFilters,
    selectedColumns: Array.isArray(selectedColumns) ? selectedColumns : [],
    sortBy: String(sortBy).trim(),
    sortDir: sortDir === "asc" ? "asc" : "desc",
    page: pg,
    limit: lim
  };
}

/**
 * Filter columns in result rows if selectedColumns are specified
 */
function projectSelectedColumns(rows, selectedColumns, identifierKeys = []) {
  if (!selectedColumns || !Array.isArray(selectedColumns) || selectedColumns.length === 0) {
    return rows;
  }
  const allowedSet = new Set([...selectedColumns, ...identifierKeys, "provenance"]);
  return rows.map(row => {
    const projected = {};
    for (const key of Object.keys(row)) {
      if (allowedSet.has(key)) {
        projected[key] = row[key];
      }
    }
    return projected;
  });
}

/**
 * 1. AD-HOC REPORT EXECUTION
 */
async function executeReport(definition, user) {
  const validated = validateReportDefinition(definition);
  const { reportType, dimensions, metrics, filters, selectedColumns, sortBy, sortDir, page, limit } = validated;

  const startDate = filters.startDate;
  const endDate = filters.endDate;

  let reportResult = null;
  let summary = {};
  let rows = [];
  let rowCount = 0;
  let disclosures = [];

  // Branch by Report Type
  switch (reportType) {
    case "financial_pnl": {
      const pnl = await financeService.getManagementPnL({ startDate, endDate });
      reportResult = pnl;
      summary = {
        statementType: pnl.statementType,
        netRevenue: pnl.revenue?.netRevenue?.amount,
        totalCogs: pnl.cogs?.totalCogs?.amount,
        grossProfit: pnl.cogs?.grossProfit?.amount,
        operatingExpenses: pnl.operatingExpenses?.totalOperatingExpenses?.amount,
        operatingProfit: pnl.operatingResult?.operatingProfit?.amount
      };
      rows = [pnl];
      rowCount = 1;
      disclosures = pnl.disclosures || [];
      break;
    }

    case "tax_liability": {
      const taxData = await taxService.getTaxOverview({ startDate, endDate });
      reportResult = taxData;
      summary = taxData.summary || {};
      rows = taxData.monthlyTrend || [];
      rowCount = rows.length;
      disclosures = ["Tax report generated from line-item snapshots. Excludes statutory filings."];
      break;
    }

    case "expenses": {
      const expRes = await expenseService.getExpenses({
        startDate,
        endDate,
        category: filters.category,
        paymentStatus: filters.paymentStatus,
        itcEligibility: filters.itcEligibility,
        page,
        limit
      });
      const expSummary = await expenseService.getExpenseSummary({ startDate, endDate });
      summary = expSummary.totals || {};
      rows = (expRes.expenses || []).map(e => ({
        expenseId: e._id,
        expenseDate: e.expenseDate,
        category: e.category,
        subcategory: e.subcategory,
        description: e.description,
        vendor: e.vendor?.name,
        taxableAmount: e.taxableAmount,
        cgst: e.cgst,
        sgst: e.sgst,
        igst: e.igst,
        totalGst: e.totalGst,
        grossAmount: e.grossAmount,
        paymentMethod: e.paymentMethod,
        paymentStatus: e.paymentStatus,
        itcEligibility: e.itcEligibility,
        itcAmount: e.itcAmount,
        status: e.status
      }));
      rowCount = expRes.pagination?.total || rows.length;
      disclosures = ["Operational expenses recorded in management accounts."];
      break;
    }

    case "settlement_reconciliation":
    case "logistics_reconciliation": {
      const recon = await financeService.getFinancialReconciliationSummary();
      reportResult = recon;
      summary = recon;
      rows = [recon];
      rowCount = 1;
      disclosures = ["Reconciliation summary tracking gateway settlements and courier invoices."];
      break;
    }

    case "product_profitability": {
      const prodRes = await profitabilityService.getProductProfitability({
        startDate,
        endDate,
        page,
        limit,
        sortBy,
        sortDir,
        search: filters.search,
        category: filters.category
      });
      summary = prodRes.summary || {};
      rows = projectSelectedColumns(
        prodRes.products || [],
        selectedColumns,
        ["productId", "sku", "name", "category", "gender"]
      );
      rowCount = prodRes.pagination?.total || rows.length;
      disclosures = [
        "GMS - Coupon Discounts = Net Merchandise Sales. Net Revenue = Net Merchandise Sales - Refunds.",
        "COGS derived exclusively from immutable historical order item snapshots."
      ];
      break;
    }

    case "category_profitability": {
      const catRes = await profitabilityService.getCategoryProfitability({ startDate, endDate });
      summary = { categoryCount: catRes.byCategory?.length, genderCount: catRes.byGender?.length };
      rows = projectSelectedColumns(
        dimensions.includes("gender") ? catRes.byGender : catRes.byCategory,
        selectedColumns,
        ["category", "gender"]
      );
      rowCount = rows.length;
      disclosures = catRes.disclosures || [];
      break;
    }

    case "channel_profitability": {
      const chanRes = await profitabilityService.getChannelProfitability({ startDate, endDate });
      summary = { channelCount: chanRes.channels?.length };
      rows = projectSelectedColumns(
        chanRes.channels || [],
        selectedColumns,
        ["channel", "channelLabel"]
      );
      rowCount = rows.length;
      disclosures = chanRes.disclosures || [];
      break;
    }

    case "order_profitability":
    case "sales_deep":
    case "custom":
    default: {
      // Dynamic dimension evaluation
      if (dimensions.includes("product") || dimensions.includes("sku")) {
        const pRes = await profitabilityService.getProductProfitability({
          startDate,
          endDate,
          page,
          limit,
          sortBy,
          sortDir,
          category: filters.category
        });
        summary = pRes.summary || {};
        rows = projectSelectedColumns(pRes.products || [], selectedColumns || metrics, ["productId", "sku", "name", "category"]);
        rowCount = pRes.pagination?.total || rows.length;
      } else if (dimensions.includes("category") || dimensions.includes("gender")) {
        const cRes = await profitabilityService.getCategoryProfitability({ startDate, endDate });
        rows = projectSelectedColumns(
          dimensions.includes("gender") ? cRes.byGender : cRes.byCategory,
          selectedColumns || metrics,
          ["category", "gender"]
        );
        rowCount = rows.length;
      } else if (dimensions.includes("channel") || dimensions.includes("paymentMethod")) {
        const chRes = await profitabilityService.getChannelProfitability({ startDate, endDate });
        rows = projectSelectedColumns(chRes.channels || [], selectedColumns || metrics, ["channel", "channelLabel"]);
        rowCount = rows.length;
      } else {
        // Order-level profitability rows
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();
        if (typeof endDate === "string" && endDate.length <= 10) end.setHours(23, 59, 59, 999);
        if (typeof startDate === "string" && startDate.length <= 10) start.setHours(0, 0, 0, 0);

        const orderMatch = {
          createdAt: { $gte: start, $lte: end },
          status: { $ne: "cancelled" },
          orderStatus: { $ne: "Cancelled" }
        };

        if (filters.paymentMethod) orderMatch.paymentMethod = filters.paymentMethod;
        if (filters.status) orderMatch.status = filters.status;

        const skip = (page - 1) * limit;
        const [ordersList, totalOrders] = await Promise.all([
          Order.find(orderMatch)
            .sort({ createdAt: sortDir === "asc" ? 1 : -1 })
            .skip(skip)
            .limit(limit)
            .select("orderNumber createdAt status isPaid paymentMethod pricing totalRefundedAmount financialSnapshot items shipping gatewaySettlement shippingSettlement")
            .lean(),
          Order.countDocuments(orderMatch)
        ]);

        rows = ordersList.map(o => {
          let knownCogs = 0;
          let estCogs = 0;
          let unknownUnits = 0;
          (o.items || []).forEach(it => {
            if (it.costPriceSource === "actual" && it.costPrice !== null) {
              knownCogs += (it.costPrice * (it.quantity || 1));
            } else if (it.costPriceSource === "estimated" && it.costPrice !== null) {
              estCogs += (it.costPrice * (it.quantity || 1));
            } else {
              unknownUnits += (it.quantity || 1);
            }
          });

          const gms = o.pricing?.subtotal || 0;
          const coupon = o.pricing?.couponDiscount || 0;
          const netMerchSales = gms - coupon;
          const shipping = o.pricing?.shippingCost || 0;
          const refunds = o.totalRefundedAmount || 0;
          const netRev = netMerchSales + shipping - refunds;
          const totCogs = unknownUnits > 0 ? null : (knownCogs + estCogs);
          const gp = totCogs !== null ? (netRev - totCogs) : null;
          const gwFee = o.paymentMethod === "cod" ? 0 : (o.gatewaySettlement?.fee || null);
          const freight = o.shippingSettlement?.actualFreightCost || null;
          const contrib = (gp !== null && gwFee !== null && freight !== null) ? (gp - gwFee - freight) : null;

          return {
            orderId: o._id,
            orderNumber: o.orderNumber,
            date: o.createdAt,
            status: o.status,
            paymentMethod: o.paymentMethod,
            grossMerchandiseSales: gms,
            couponDiscounts: coupon,
            netMerchandiseSales: netMerchSales,
            shippingRevenue: shipping,
            refunds,
            netRevenue: netRev,
            knownCogs,
            estimatedCogs: estCogs,
            totalCogs: totCogs,
            unknownCostUnits: unknownUnits,
            cogsStatus: unknownUnits > 0 ? "incomplete" : (estCogs > 0 ? "estimated" : "actual"),
            grossProfit: gp,
            gatewayFee: gwFee,
            freightCost: freight,
            contributionProfit: contrib,
            provenance: contrib !== null ? "DERIVED" : "UNKNOWN"
          };
        });

        rows = projectSelectedColumns(rows, selectedColumns || metrics, ["orderId", "orderNumber", "date", "status"]);
        rowCount = totalOrders;
      }
      disclosures = [
        "Revenue flow: GMS - Coupon = Net Merchandise Sales. Net Revenue = Net Merchandise Sales + Shipping - Refunds.",
        "Customer PII is strictly protected and omitted from management analytical reports."
      ];
      break;
    }
  }

  return {
    success: true,
    reportMetadata: {
      reportType,
      name: definition.name || `${reportType.replace(/_/g, " ").toUpperCase()} Report`,
      generatedAt: new Date(),
      generatedBy: {
        id: user?._id,
        name: user?.name,
        email: user?.email
      },
      dateRange: {
        start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        end: endDate || new Date().toISOString().split("T")[0]
      },
      dimensions,
      metrics,
      filters,
      selectedColumns,
      rowCount,
      pagination: {
        page,
        limit,
        total: rowCount,
        pages: Math.ceil(rowCount / limit) || 1
      }
    },
    summary,
    results: rows,
    rawStatement: reportResult,
    disclosures
  };
}

/**
 * 2. SAVED REPORT EXECUTION
 */
async function executeSavedReport(savedReportId, user, runtimeOverrides = {}) {
  if (!savedReportId || !mongoose.Types.ObjectId.isValid(savedReportId)) {
    const err = new Error("Invalid or missing Saved Report ID");
    err.statusCode = 400;
    throw err;
  }

  const savedReport = await SavedReport.findById(savedReportId).lean();
  if (!savedReport) {
    const err = new Error("Saved report template not found");
    err.statusCode = 404;
    throw err;
  }

  // Merge saved configuration with runtime filters/overrides
  const mergedDefinition = {
    name: savedReport.name,
    reportType: savedReport.reportType,
    filters: { ...(savedReport.filters || {}), ...(runtimeOverrides.filters || {}) },
    selectedColumns: runtimeOverrides.selectedColumns || savedReport.selectedColumns || [],
    dimensions: runtimeOverrides.dimensions || [],
    metrics: runtimeOverrides.metrics || [],
    sortBy: runtimeOverrides.sortBy || savedReport.sortBy || "grossMerchandiseSales",
    sortDir: runtimeOverrides.sortDir || savedReport.sortDir || "desc",
    page: runtimeOverrides.page || 1,
    limit: runtimeOverrides.limit || 50
  };

  // If runtimeOverrides provide startDate / endDate directly
  if (runtimeOverrides.startDate) mergedDefinition.filters.startDate = runtimeOverrides.startDate;
  if (runtimeOverrides.endDate) mergedDefinition.filters.endDate = runtimeOverrides.endDate;

  const executionResult = await executeReport(mergedDefinition, user);
  executionResult.savedReportInfo = {
    id: savedReport._id,
    name: savedReport.name,
    description: savedReport.description,
    createdAt: savedReport.createdAt
  };

  return executionResult;
}

module.exports = {
  executeReport,
  executeSavedReport,
  validateReportDefinition,
  ALLOWED_REPORT_TYPES,
  ALLOWED_DIMENSIONS,
  ALLOWED_METRICS
};
