const StockInward = require("../models/StockInward");
const RazorpaySettlement = require("../models/RazorpaySettlement");
const CourierInvoice = require("../models/CourierInvoice");
const SavedReport = require("../models/SavedReport");
const ExportLog = require("../models/ExportLog");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Expense = require("../models/Expense");
const mongoose = require("mongoose");

/**
 * 1. Stock Inward (GRN) Foundation
 */
async function recordStockInward(data, user) {
  const {
    grnNumber,
    supplier,
    invoiceNumber,
    invoiceDate,
    receivedDate,
    items,
    notes
  } = data;

  if (!grnNumber || !grnNumber.trim()) {
    const err = new Error("GRN number is required");
    err.statusCode = 400;
    throw err;
  }

  const existingGrn = await StockInward.findOne({ grnNumber: grnNumber.trim().toUpperCase() });
  if (existingGrn) {
    const err = new Error(`GRN number '${grnNumber.trim().toUpperCase()}' already exists`);
    err.statusCode = 409;
    throw err;
  }

  if (!supplier || !supplier.name || !supplier.name.trim()) {
    const err = new Error("Supplier name is required");
    err.statusCode = 400;
    throw err;
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    const err = new Error("At least one received item is required");
    err.statusCode = 400;
    throw err;
  }

  // Validate each item and check product reference existence
  const validatedItems = [];
  for (const item of items) {
    if (!item.product || !mongoose.Types.ObjectId.isValid(item.product)) {
      const err = new Error("Valid product ID reference is required for each inward item");
      err.statusCode = 400;
      throw err;
    }

    const prod = await Product.findById(item.product).select("name sku").lean();
    if (!prod) {
      const err = new Error(`Referenced product ID '${item.product}' does not exist in catalog`);
      err.statusCode = 400;
      throw err;
    }

    const qty = Number(item.quantityReceived);
    if (isNaN(qty) || qty <= 0) {
      const err = new Error(`Quantity received for ${prod.name} must be a positive integer`);
      err.statusCode = 400;
      throw err;
    }

    const unitCost = Number(item.unitCost);
    if (isNaN(unitCost) || unitCost < 0) {
      const err = new Error(`Unit cost for ${prod.name} cannot be negative`);
      err.statusCode = 400;
      throw err;
    }

    const tax = Math.max(0, Number(item.taxAmount) || 0);
    const freight = Math.max(0, Number(item.freightShare) || 0);
    const landed = item.landedUnitCost !== undefined && !isNaN(Number(item.landedUnitCost))
      ? Number(item.landedUnitCost)
      : unitCost + (tax / qty) + (freight / qty);

    validatedItems.push({
      product: prod._id,
      sku: item.sku || prod.sku || "",
      name: item.name || prod.name,
      quantityReceived: qty,
      unitCost,
      taxAmount: tax,
      freightShare: freight,
      landedUnitCost: landed
    });
  }

  const stockInward = await StockInward.create({
    grnNumber: grnNumber.trim().toUpperCase(),
    supplier: {
      name: supplier.name.trim(),
      gstin: (supplier.gstin || "").trim().toUpperCase(),
      contact: (supplier.contact || "").trim()
    },
    invoiceNumber: (invoiceNumber || "").trim(),
    invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
    receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
    items: validatedItems,
    notes: notes || "",
    status: "received",
    createdBy: user?._id,
    updatedBy: user?._id
  });

  return stockInward;
}

async function getStockInwards({ page = 1, limit = 20, status } = {}) {
  const query = {};
  if (status && status !== "all") {
    query.status = status;
  }

  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (pg - 1) * lim;

  const [inwards, total] = await Promise.all([
    StockInward.find(query)
      .sort({ receivedDate: -1 })
      .skip(skip)
      .limit(lim)
      .populate("createdBy", "name email")
      .lean(),
    StockInward.countDocuments(query)
  ]);

  return {
    inwards,
    pagination: {
      total,
      page: pg,
      limit: lim,
      pages: Math.ceil(total / lim) || 1
    }
  };
}

/**
 * 2. Razorpay Settlement Reconciliation (Idempotent)
 */
async function importRazorpaySettlement(data, user) {
  const {
    settlementId,
    settlementDate,
    grossAmount,
    feeAmount,
    taxAmount,
    feeProvenance = "actual",
    adjustment = 0,
    netAmount,
    utr,
    transactions = []
  } = data;

  if (!settlementId || !settlementId.trim()) {
    const err = new Error("Settlement ID is required");
    err.statusCode = 400;
    throw err;
  }

  const cleanSettlementId = settlementId.trim();
  const existing = await RazorpaySettlement.findOne({ settlementId: cleanSettlementId });
  if (existing) {
    const err = new Error(`Settlement '${cleanSettlementId}' has already been imported (idempotency guard)`);
    err.statusCode = 409;
    throw err;
  }

  if (grossAmount === undefined || isNaN(Number(grossAmount))) {
    const err = new Error("Gross amount is required");
    err.statusCode = 400;
    throw err;
  }
  if (feeAmount === undefined || isNaN(Number(feeAmount))) {
    const err = new Error("Fee amount is required");
    err.statusCode = 400;
    throw err;
  }
  if (taxAmount === undefined || isNaN(Number(taxAmount))) {
    const err = new Error("Tax amount is required");
    err.statusCode = 400;
    throw err;
  }
  if (netAmount === undefined || isNaN(Number(netAmount))) {
    const err = new Error("Net settlement amount is required");
    err.statusCode = 400;
    throw err;
  }

  // Process transaction reconciliation
  const processedTransactions = [];
  const paymentIdSeen = new Set();
  let matchedCount = 0;
  let unmatchedCount = 0;
  let mismatchCount = 0;
  let duplicateCount = 0;

  for (const tx of transactions) {
    const pId = (tx.paymentId || "").trim();
    if (!pId) continue;

    // Check duplicate within the same batch
    if (paymentIdSeen.has(pId)) {
      duplicateCount++;
      processedTransactions.push({
        paymentId: pId,
        orderId: tx.orderId || "",
        lyvoOrderNumber: tx.lyvoOrderNumber || "",
        amount: Number(tx.amount) || 0,
        fee: Number(tx.fee) || 0,
        tax: Number(tx.tax) || 0,
        reconciliationStatus: "duplicate",
        mismatchReason: "Duplicate payment ID detected in batch"
      });
      continue;
    }
    paymentIdSeen.add(pId);

    // Look for matching Order in LYVO database
    const order = await Order.findOne({
      $or: [
        { razorpayPaymentId: pId },
        { razorpayOrderId: tx.orderId },
        { orderNumber: tx.lyvoOrderNumber }
      ].filter(cond => Object.values(cond)[0])
    }).select("_id orderNumber pricing.total isPaid status").lean();

    if (!order) {
      unmatchedCount++;
      processedTransactions.push({
        paymentId: pId,
        orderId: tx.orderId || "",
        lyvoOrderNumber: tx.lyvoOrderNumber || "",
        amount: Number(tx.amount) || 0,
        fee: Number(tx.fee) || 0,
        tax: Number(tx.tax) || 0,
        reconciliationStatus: "unmatched_order",
        mismatchReason: "No corresponding order found in LYVO system"
      });
    } else {
      const orderTotal = order.pricing?.total || 0;
      const txAmount = Number(tx.amount) || 0;
      const isAmountMatch = Math.abs(orderTotal - txAmount) < 0.01;

      if (!isAmountMatch) {
        mismatchCount++;
        processedTransactions.push({
          paymentId: pId,
          orderId: tx.orderId || "",
          lyvoOrderNumber: order.orderNumber,
          lyvoOrderId: order._id,
          amount: txAmount,
          fee: Number(tx.fee) || 0,
          tax: Number(tx.tax) || 0,
          reconciliationStatus: "amount_mismatch",
          mismatchReason: `Settlement amount ₹${txAmount} does not match order total ₹${orderTotal}`
        });
      } else {
        matchedCount++;
        processedTransactions.push({
          paymentId: pId,
          orderId: tx.orderId || "",
          lyvoOrderNumber: order.orderNumber,
          lyvoOrderId: order._id,
          amount: txAmount,
          fee: Number(tx.fee) || 0,
          tax: Number(tx.tax) || 0,
          reconciliationStatus: "matched"
        });
      }
    }
  }

  const totalTx = processedTransactions.length;
  let overallStatus = "unreconciled";
  if (totalTx > 0 && matchedCount === totalTx) {
    overallStatus = "fully_reconciled";
  } else if (matchedCount > 0) {
    overallStatus = "partially_reconciled";
  }

  const settlement = await RazorpaySettlement.create({
    settlementId: cleanSettlementId,
    settlementDate: settlementDate ? new Date(settlementDate) : new Date(),
    grossAmount: Number(grossAmount),
    feeAmount: Number(feeAmount),
    taxAmount: Number(taxAmount),
    feeProvenance: feeProvenance === "estimated" ? "estimated" : "actual",
    adjustment: Number(adjustment) || 0,
    netAmount: Number(netAmount),
    utr: (utr || "").trim(),
    transactions: processedTransactions,
    reconciliationSummary: {
      totalTransactions: totalTx,
      matchedCount,
      unmatchedCount,
      mismatchCount,
      duplicateCount,
      status: overallStatus
    },
    importedAt: new Date(),
    importedBy: user?._id
  });

  return settlement;
}

async function getRazorpaySettlements({ page = 1, limit = 20 } = {}) {
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (pg - 1) * lim;

  const [settlements, total] = await Promise.all([
    RazorpaySettlement.find()
      .sort({ settlementDate: -1 })
      .skip(skip)
      .limit(lim)
      .populate("importedBy", "name email")
      .lean(),
    RazorpaySettlement.countDocuments()
  ]);

  return {
    settlements,
    pagination: {
      total,
      page: pg,
      limit: lim,
      pages: Math.ceil(total / lim) || 1
    }
  };
}

/**
 * 3. Delhivery Courier Freight Reconciliation (Idempotent)
 */
async function importCourierInvoice(data, user) {
  const {
    invoiceNumber,
    invoiceDate,
    carrier = "delhivery",
    billingPeriod,
    totalBilledAmount,
    lineItems = []
  } = data;

  if (!invoiceNumber || !invoiceNumber.trim()) {
    const err = new Error("Invoice number is required");
    err.statusCode = 400;
    throw err;
  }

  const cleanInvoiceNo = invoiceNumber.trim();
  const existing = await CourierInvoice.findOne({ invoiceNumber: cleanInvoiceNo });
  if (existing) {
    const err = new Error(`Carrier invoice '${cleanInvoiceNo}' has already been imported (idempotency guard)`);
    err.statusCode = 409;
    throw err;
  }

  if (totalBilledAmount === undefined || isNaN(Number(totalBilledAmount))) {
    const err = new Error("Total billed amount is required");
    err.statusCode = 400;
    throw err;
  }

  const processedLines = [];
  const waybillSeen = new Set();
  let matchedCount = 0;
  let unmatchedCount = 0;
  let mismatchCount = 0;
  let duplicateCount = 0;
  let totalActualFreight = 0;

  for (const item of lineItems) {
    const wb = (item.waybill || "").trim();
    if (!wb) continue;

    const charge = Number(item.totalCarrierCharge) || 0;
    totalActualFreight += charge;

    if (waybillSeen.has(wb)) {
      duplicateCount++;
      processedLines.push({
        waybill: wb,
        orderNumber: item.orderNumber || "",
        freight: Number(item.freight) || 0,
        fuelSurcharge: Number(item.fuelSurcharge) || 0,
        codHandling: Number(item.codHandling) || 0,
        rtoFreight: Number(item.rtoFreight) || 0,
        taxAmount: Number(item.taxAmount) || 0,
        totalCarrierCharge: charge,
        reconciliationStatus: "duplicate",
        mismatchReason: "Duplicate waybill detected in invoice batch"
      });
      continue;
    }
    waybillSeen.add(wb);

    // Look for Order with this waybill
    const order = await Order.findOne({ "shipping.waybill": wb })
      .select("_id orderNumber pricing.shippingCost status")
      .lean();

    if (!order) {
      unmatchedCount++;
      processedLines.push({
        waybill: wb,
        orderNumber: item.orderNumber || "",
        freight: Number(item.freight) || 0,
        fuelSurcharge: Number(item.fuelSurcharge) || 0,
        codHandling: Number(item.codHandling) || 0,
        rtoFreight: Number(item.rtoFreight) || 0,
        taxAmount: Number(item.taxAmount) || 0,
        totalCarrierCharge: charge,
        reconciliationStatus: "unmatched_awb",
        mismatchReason: "Waybill not found in LYVO shipments"
      });
    } else {
      matchedCount++;
      processedLines.push({
        waybill: wb,
        orderNumber: order.orderNumber,
        orderId: order._id,
        chargedWeightGrams: Number(item.chargedWeightGrams) || null,
        freight: Number(item.freight) || 0,
        fuelSurcharge: Number(item.fuelSurcharge) || 0,
        codHandling: Number(item.codHandling) || 0,
        rtoFreight: Number(item.rtoFreight) || 0,
        taxAmount: Number(item.taxAmount) || 0,
        totalCarrierCharge: charge,
        reconciliationStatus: "matched"
      });
    }
  }

  const totalShipments = processedLines.length;
  let status = "unreconciled";
  if (totalShipments > 0 && matchedCount === totalShipments) {
    status = "reconciled";
  } else if (matchedCount > 0) {
    status = "partially_reconciled";
  }

  const invoice = await CourierInvoice.create({
    invoiceNumber: cleanInvoiceNo,
    invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
    carrier,
    billingPeriod: {
      start: billingPeriod?.start ? new Date(billingPeriod.start) : null,
      end: billingPeriod?.end ? new Date(billingPeriod.end) : null
    },
    totalBilledAmount: Number(totalBilledAmount),
    totalShipments,
    lineItems: processedLines,
    reconciliationSummary: {
      matchedShipments: matchedCount,
      unmatchedShipments: unmatchedCount,
      mismatchCount,
      duplicateCount,
      totalActualFreight,
      status
    },
    importedAt: new Date(),
    importedBy: user?._id
  });

  return invoice;
}

async function getCourierInvoices({ page = 1, limit = 20 } = {}) {
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (pg - 1) * lim;

  const [invoices, total] = await Promise.all([
    CourierInvoice.find()
      .sort({ invoiceDate: -1 })
      .skip(skip)
      .limit(lim)
      .populate("importedBy", "name email")
      .lean(),
    CourierInvoice.countDocuments()
  ]);

  return {
    invoices,
    pagination: {
      total,
      page: pg,
      limit: lim,
      pages: Math.ceil(total / lim) || 1
    }
  };
}

/**
 * 4. Reconciliation Center Summary
 */
async function getFinancialReconciliationSummary() {
  const [
    settlementsSummary,
    courierSummary,
    unreconciledPaidOrders,
    unreconciledShipments
  ] = await Promise.all([
    RazorpaySettlement.aggregate([
      {
        $group: {
          _id: null,
          totalSettlements: { $sum: 1 },
          totalGrossSettled: { $sum: "$grossAmount" },
          totalFeePaid: { $sum: "$feeAmount" },
          totalTaxPaid: { $sum: "$taxAmount" },
          totalNetReceived: { $sum: "$netAmount" },
          matchedTxCount: { $sum: "$reconciliationSummary.matchedCount" },
          unmatchedTxCount: { $sum: "$reconciliationSummary.unmatchedCount" },
          mismatchTxCount: { $sum: "$reconciliationSummary.mismatchCount" }
        }
      }
    ]),
    CourierInvoice.aggregate([
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalBilled: { $sum: "$totalBilledAmount" },
          totalActualFreight: { $sum: "$reconciliationSummary.totalActualFreight" },
          matchedShipmentCount: { $sum: "$reconciliationSummary.matchedShipments" },
          unmatchedShipmentCount: { $sum: "$reconciliationSummary.unmatchedShipments" }
        }
      }
    ]),
    Order.countDocuments({ isPaid: true, paymentMethod: { $ne: "cod" }, status: { $ne: "cancelled" } }),
    Order.countDocuments({ "shipping.waybill": { $ne: "" }, status: { $in: ["shipped", "delivered"] } })
  ]);

  const pSummary = settlementsSummary[0] || {
    totalSettlements: 0,
    totalGrossSettled: 0,
    totalFeePaid: 0,
    totalTaxPaid: 0,
    totalNetReceived: 0,
    matchedTxCount: 0,
    unmatchedTxCount: 0,
    mismatchTxCount: 0
  };

  const cSummary = courierSummary[0] || {
    totalInvoices: 0,
    totalBilled: 0,
    totalActualFreight: 0,
    matchedShipmentCount: 0,
    unmatchedShipmentCount: 0
  };

  return {
    payments: {
      ...pSummary,
      totalPaidOrders: unreconciledPaidOrders,
      unreconciledCount: Math.max(0, unreconciledPaidOrders - pSummary.matchedTxCount),
      status: pSummary.unmatchedTxCount > 0 || pSummary.mismatchTxCount > 0 ? "attention_required" : "healthy"
    },
    shipping: {
      ...cSummary,
      totalDispatchedShipments: unreconciledShipments,
      unreconciledCount: Math.max(0, unreconciledShipments - cSummary.matchedShipmentCount),
      status: cSummary.unmatchedShipmentCount > 0 ? "attention_required" : "healthy"
    }
  };
}

/**
 * 5. Saved Reports Management
 */
async function createSavedReport(data, user) {
  const { name, description, reportType, filters, selectedColumns, sortBy, sortDir } = data;

  if (!name || !name.trim()) {
    throw new Error("Report name is required");
  }
  if (!reportType) {
    throw new Error("Report type is required");
  }

  const savedReport = await SavedReport.create({
    name: name.trim(),
    description: (description || "").trim(),
    reportType,
    filters: filters || {},
    selectedColumns: selectedColumns || [],
    sortBy: sortBy || "createdAt",
    sortDir: sortDir || "desc",
    createdBy: user?._id
  });

  return savedReport;
}

async function getSavedReports(user) {
  return SavedReport.find({ createdBy: user?._id })
    .sort({ createdAt: -1 })
    .lean();
}

async function deleteSavedReport(id, user) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid report ID");
  }
  const res = await SavedReport.findOneAndDelete({ _id: id, createdBy: user?._id });
  if (!res) {
    throw new Error("Saved report not found or unauthorized");
  }
  return { success: true };
}

/**
 * 6. Export Logs Management
 */
async function logExport(data, user) {
  const { exportId, reportName, reportType, format, filters, recordCount = 0 } = data;

  if (!exportId || !format || !reportName || !reportType) {
    throw new Error("Missing required export log parameters");
  }

  const log = await ExportLog.create({
    exportId,
    reportName,
    reportType,
    format,
    filters: filters || {},
    recordCount,
    status: "pending",
    generatedBy: user?._id
  });

  return log;
}

async function updateExportLog(exportId, { status, recordCount, fileSize, errorMessage }) {
  const update = {};
  if (status) update.status = status;
  if (recordCount !== undefined) update.recordCount = recordCount;
  if (fileSize !== undefined) update.fileSize = fileSize;
  if (errorMessage !== undefined) update.errorMessage = errorMessage;

  return ExportLog.findOneAndUpdate({ exportId }, update, { new: true });
}

async function getExportLogs({ page = 1, limit = 20, user } = {}) {
  const query = user?.role === "admin" ? {} : { generatedBy: user?._id };
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (pg - 1) * lim;

  const [logs, total] = await Promise.all([
    ExportLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .populate("generatedBy", "name email")
      .lean(),
    ExportLog.countDocuments(query)
  ]);

  return {
    logs,
    pagination: {
      total,
      page: pg,
      limit: lim,
      pages: Math.ceil(total / lim) || 1
    }
  };
}

/**
 * Normalizes start and end dates with sensible defaults (last 30 days)
 */
function parseFinanceDateRange(startDate, endDate) {
  const end = endDate ? new Date(endDate) : new Date();
  if (typeof endDate === "string" && endDate.length <= 10) {
    end.setHours(23, 59, 59, 999);
  }

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (typeof startDate === "string" && startDate.length <= 10) {
    start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

/**
 * 7. Finance Dashboard Overview Aggregation
 */
async function getFinanceOverview({ startDate, endDate } = {}) {
  const { start, end } = parseFinanceDateRange(startDate, endDate);

  const orderMatch = {
    createdAt: { $gte: start, $lte: end },
    status: { $ne: "cancelled" }
  };

  const expenseMatch = {
    expenseDate: { $gte: start, $lte: end },
    status: { $ne: "cancelled" }
  };

  const settlementMatch = {
    settlementDate: { $gte: start, $lte: end }
  };

  const courierMatch = {
    invoiceDate: { $gte: start, $lte: end }
  };

  const [
    revenueAgg,
    cogsAgg,
    expenseTotalsAgg,
    expenseCategoryAgg,
    settlementAgg,
    courierAgg,
    paidOrdersCount,
    dispatchedOrdersCount
  ] = await Promise.all([
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          paidOrders: { $sum: { $cond: ["$isPaid", 1, 0] } },
          grossMerchandiseSales: {
            $sum: {
              $reduce: {
                input: "$items",
                initialValue: 0,
                in: { $add: ["$$value", { $multiply: ["$$this.price", "$$this.quantity"] }] }
              }
            }
          },
          productDiscounts: {
            $sum: {
              $reduce: {
                input: "$items",
                initialValue: 0,
                in: {
                  $add: [
                    "$$value",
                    {
                      $multiply: [
                        { $max: [0, { $subtract: [{ $ifNull: ["$$this.mrp", "$$this.price"] }, "$$this.price"] }] },
                        "$$this.quantity"
                      ]
                    }
                  ]
                }
              }
            }
          },
          couponDiscounts: {
            $sum: {
              $ifNull: [
                "$pricing.couponDiscount",
                {
                  $reduce: {
                    input: "$items",
                    initialValue: 0,
                    in: { $add: ["$$value", { $ifNull: ["$$this.allocatedCouponDiscount", 0] }] }
                  }
                }
              ]
            }
          },
          shippingRevenue: { $sum: { $ifNull: ["$pricing.shippingCost", 0] } },
          taxCollected: { $sum: { $ifNull: ["$pricing.tax", 0] } },
          refundsValue: { $sum: { $ifNull: ["$totalRefundedAmount", 0] } },
          paidCustomerRevenue: { $sum: { $cond: ["$isPaid", "$pricing.total", 0] } }
        }
      }
    ]),
    Order.aggregate([
      { $match: orderMatch },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          totalUnitsSold: { $sum: "$items.quantity" },
          knownCogs: {
            $sum: {
              $cond: [
                { $eq: ["$items.costPriceSource", "actual"] },
                { $multiply: [{ $ifNull: ["$items.costPrice", 0] }, "$items.quantity"] },
                0
              ]
            }
          },
          estimatedCogs: {
            $sum: {
              $cond: [
                { $eq: ["$items.costPriceSource", "estimated"] },
                { $multiply: [{ $ifNull: ["$items.costPrice", 0] }, "$items.quantity"] },
                0
              ]
            }
          },
          unknownCostUnits: {
            $sum: {
              $cond: [
                { $or: [{ $eq: ["$items.costPrice", null] }, { $eq: ["$items.costPriceSource", "unknown"] }] },
                "$items.quantity",
                0
              ]
            }
          }
        }
      }
    ]),
    Expense.aggregate([
      { $match: expenseMatch },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: "$grossAmount" },
          taxableExpenses: { $sum: "$taxableAmount" },
          totalGstPaid: { $sum: "$totalGst" },
          itcEligible: {
            $sum: { $cond: [{ $eq: ["$itcEligibility", "eligible"] }, "$itcAmount", 0] }
          },
          itcPending: {
            $sum: { $cond: [{ $eq: ["$itcEligibility", "pending_verification"] }, "$totalGst", 0] }
          },
          itcIneligible: {
            $sum: { $cond: [{ $in: ["$itcEligibility", ["ineligible", "blocked"]] }, "$totalGst", 0] }
          }
        }
      }
    ]),
    Expense.aggregate([
      { $match: expenseMatch },
      {
        $group: {
          _id: "$category",
          totalSpend: { $sum: "$grossAmount" },
          taxableSpend: { $sum: "$taxableAmount" },
          gstSpend: { $sum: "$totalGst" },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalSpend: -1 } }
    ]),
    RazorpaySettlement.aggregate([
      { $match: settlementMatch },
      {
        $group: {
          _id: null,
          settlementsCount: { $sum: 1 },
          grossSettled: { $sum: "$grossAmount" },
          gatewayFeesPaid: { $sum: "$feeAmount" },
          gatewayTaxPaid: { $sum: "$taxAmount" },
          netBankSettlement: { $sum: "$netAmount" },
          matchedCount: { $sum: "$reconciliationSummary.matchedCount" },
          unmatchedCount: { $sum: "$reconciliationSummary.unmatchedCount" },
          mismatchCount: { $sum: "$reconciliationSummary.mismatchCount" }
        }
      }
    ]),
    CourierInvoice.aggregate([
      { $match: courierMatch },
      {
        $group: {
          _id: null,
          invoicesCount: { $sum: 1 },
          totalBilledFreight: { $sum: "$totalBilledAmount" },
          totalActualFreight: { $sum: "$reconciliationSummary.totalActualFreight" },
          matchedShipments: { $sum: "$reconciliationSummary.matchedShipments" },
          unmatchedShipments: { $sum: "$reconciliationSummary.unmatchedShipments" }
        }
      }
    ]),
    Order.countDocuments({ isPaid: true, status: { $ne: "cancelled" } }),
    Order.countDocuments({ "shipping.waybill": { $ne: "" }, status: { $in: ["shipped", "delivered"] } })
  ]);

  const rev = revenueAgg[0] || {
    totalOrders: 0,
    paidOrders: 0,
    grossMerchandiseSales: 0,
    productDiscounts: 0,
    couponDiscounts: 0,
    shippingRevenue: 0,
    taxCollected: 0,
    refundsValue: 0,
    paidCustomerRevenue: 0
  };

  const netMerchandiseSales = rev.grossMerchandiseSales - rev.couponDiscounts;
  const netRevenue = netMerchandiseSales + rev.shippingRevenue - rev.refundsValue;
  const aov = rev.paidOrders > 0
    ? Math.round((netMerchandiseSales + rev.shippingRevenue) / rev.paidOrders)
    : 0;

  const cogsData = cogsAgg[0] || {
    totalUnitsSold: 0,
    knownCogs: 0,
    estimatedCogs: 0,
    unknownCostUnits: 0
  };

  const totalCogs = cogsData.knownCogs + cogsData.estimatedCogs;
  const cogsCoveragePercent = cogsData.totalUnitsSold > 0
    ? Math.round(((cogsData.totalUnitsSold - cogsData.unknownCostUnits) / cogsData.totalUnitsSold) * 100)
    : 100;
  const cogsStatus = cogsData.unknownCostUnits > 0
    ? "incomplete"
    : (cogsData.estimatedCogs > 0 ? "estimated" : "actual");

  const grossProfit = cogsStatus === "incomplete" ? null : (netRevenue - totalCogs);
  const grossMarginPercent = (grossProfit !== null && netRevenue > 0)
    ? Math.round((grossProfit / netRevenue) * 1000) / 10
    : null;

  const expTotals = expenseTotalsAgg[0] || {
    totalExpenses: 0,
    taxableExpenses: 0,
    totalGstPaid: 0,
    itcEligible: 0,
    itcPending: 0,
    itcIneligible: 0
  };

  const operatingProfit = grossProfit !== null ? (grossProfit - expTotals.totalExpenses) : null;
  const operatingMarginPercent = (operatingProfit !== null && netRevenue > 0)
    ? Math.round((operatingProfit / netRevenue) * 1000) / 10
    : null;

  const settlements = settlementAgg[0] || {
    settlementsCount: 0,
    grossSettled: 0,
    gatewayFeesPaid: 0,
    gatewayTaxPaid: 0,
    netBankSettlement: 0,
    matchedCount: 0,
    unmatchedCount: 0,
    mismatchCount: 0
  };

  const courier = courierAgg[0] || {
    invoicesCount: 0,
    totalBilledFreight: 0,
    totalActualFreight: 0,
    matchedShipments: 0,
    unmatchedShipments: 0
  };

  return {
    dateRange: { start, end },
    kpis: {
      revenue: {
        grossMerchandiseSales: rev.grossMerchandiseSales,
        productDiscounts: rev.productDiscounts,
        couponDiscounts: rev.couponDiscounts,
        netMerchandiseSales,
        shippingRevenue: rev.shippingRevenue,
        refundsValue: rev.refundsValue,
        netRevenue,
        aov,
        totalOrders: rev.totalOrders,
        paidOrders: rev.paidOrders,
        provenance: "ACTUAL"
      },
      profitability: {
        knownCogs: cogsData.knownCogs,
        estimatedCogs: cogsData.estimatedCogs,
        totalCogs,
        unknownCostUnits: cogsData.unknownCostUnits,
        cogsCoveragePercent,
        cogsStatus,
        cogsProvenance: cogsStatus.toUpperCase(),
        grossProfit,
        grossProfitProvenance: grossProfit !== null ? "DERIVED" : "UNKNOWN",
        grossMarginPercent,
        operatingExpenses: expTotals.totalExpenses,
        operatingExpensesProvenance: "ACTUAL",
        operatingProfit,
        operatingProfitProvenance: operatingProfit !== null ? "DERIVED" : "UNKNOWN",
        operatingMarginPercent
      },
      gatewayEconomics: {
        customerPaidRevenue: rev.paidCustomerRevenue,
        grossSettled: settlements.grossSettled,
        actualGatewayFeesPaid: settlements.gatewayFeesPaid,
        actualGatewayTaxPaid: settlements.gatewayTaxPaid,
        netBankSettlement: settlements.netBankSettlement,
        settlementsCount: settlements.settlementsCount,
        matchedTxCount: settlements.matchedCount,
        unmatchedTxCount: settlements.unmatchedCount,
        mismatchTxCount: settlements.mismatchCount,
        provenance: settlements.settlementsCount > 0 ? "ACTUAL" : "UNRECONCILED"
      },
      logisticsEconomics: {
        customerShippingCollected: rev.shippingRevenue,
        actualFreightBilled: courier.totalBilledFreight,
        actualFreightCost: courier.totalActualFreight,
        invoicesCount: courier.invoicesCount,
        matchedShipmentsCount: courier.matchedShipments,
        unmatchedShipmentsCount: courier.unmatchedShipments,
        provenance: courier.invoicesCount > 0 ? "ACTUAL" : "UNRECONCILED"
      },
      taxTracking: {
        taxCollectedOnSales: rev.taxCollected,
        taxCollectedProvenance: "ACTUAL (Held in trust, not revenue)",
        taxPaidOnExpenses: expTotals.totalGstPaid,
        itcEligible: expTotals.itcEligible,
        itcPendingVerification: expTotals.itcPending,
        itcBlockedOrIneligible: expTotals.itcIneligible,
        taxPaidProvenance: "ACTUAL"
      }
    },
    expensesByCategory: expenseCategoryAgg.map(c => ({
      category: c._id,
      spend: c.totalSpend,
      taxable: c.taxableSpend,
      gst: c.gstSpend,
      count: c.count
    })),
    reconciliationSummary: {
      payments: {
        totalPaidOrders: paidOrdersCount,
        matchedSettlementCount: settlements.matchedCount,
        unreconciledPaidOrders: Math.max(0, paidOrdersCount - settlements.matchedCount),
        mismatchCount: settlements.mismatchCount
      },
      shipping: {
        totalDispatchedShipments: dispatchedOrdersCount,
        matchedInvoiceCount: courier.matchedShipments,
        unreconciledShipments: Math.max(0, dispatchedOrdersCount - courier.matchedShipments),
        unmatchedInvoiceWaybills: courier.unmatchedShipments
      }
    },
    disclosures: [
      "Management Finance Dashboard is for internal business operations and does not constitute audited statutory accounts.",
      "COGS is calculated using immutable order item snapshots. If unknown costs exist, Gross Profit is flagged as incomplete rather than assuming zero cost.",
      "Tax collected is held in trust for statutory remittance and is not recognized as revenue."
    ]
  };
}

/**
 * 8. Management Income Statement (P&L) Calculation Service
 */
async function getManagementPnL({ startDate, endDate } = {}) {
  const overview = await getFinanceOverview({ startDate, endDate });
  const { kpis, expensesByCategory, dateRange } = overview;
  const { revenue, profitability, taxTracking } = kpis;

  const expensesMap = {};
  for (const exp of expensesByCategory) {
    expensesMap[exp.category] = exp.spend;
  }

  const standardCategories = [
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
  ];

  const operatingExpensesBreakdown = {};
  for (const cat of standardCategories) {
    operatingExpensesBreakdown[cat] = {
      amount: expensesMap[cat] || 0,
      provenance: "ACTUAL"
    };
  }

  return {
    dateRange,
    statementType: "Management P&L — Not Statutory Financial Statements",
    revenue: {
      grossMerchandiseSales: { amount: revenue.grossMerchandiseSales, provenance: "ACTUAL" },
      productDiscounts: { amount: revenue.productDiscounts, provenance: "ACTUAL" },
      couponDiscounts: { amount: revenue.couponDiscounts, provenance: "ACTUAL" },
      netMerchandiseSales: { amount: revenue.netMerchandiseSales, provenance: "DERIVED" },
      shippingRevenue: { amount: revenue.shippingRevenue, provenance: "ACTUAL" },
      refunds: { amount: revenue.refundsValue, provenance: "ACTUAL" },
      netRevenue: { amount: revenue.netRevenue, provenance: "DERIVED" }
    },
    cogs: {
      knownCogs: { amount: profitability.knownCogs, provenance: "ACTUAL" },
      estimatedCogs: { amount: profitability.estimatedCogs, provenance: "ESTIMATED" },
      totalCogs: { amount: profitability.totalCogs, provenance: "DERIVED" },
      unknownCostUnits: profitability.unknownCostUnits,
      cogsCoveragePercent: profitability.cogsCoveragePercent,
      cogsStatus: profitability.cogsStatus,
      grossProfit: {
        amount: profitability.grossProfit,
        provenance: profitability.grossProfit !== null ? "DERIVED" : "UNKNOWN"
      },
      grossMarginPercent: profitability.grossMarginPercent
    },
    operatingExpenses: {
      ...operatingExpensesBreakdown,
      totalOperatingExpenses: { amount: profitability.operatingExpenses, provenance: "DERIVED" }
    },
    operatingResult: {
      operatingProfit: {
        amount: profitability.operatingProfit,
        provenance: profitability.operatingProfit !== null ? "DERIVED" : "UNKNOWN"
      },
      operatingMarginPercent: profitability.operatingMarginPercent,
      isComplete: profitability.cogsStatus !== "incomplete",
      status: profitability.cogsStatus
    },
    taxInformation: {
      taxCollectedOnSales: taxTracking.taxCollectedOnSales,
      taxPaidOnExpenses: taxTracking.taxPaidOnExpenses,
      itcEligible: taxTracking.itcEligible,
      itcPendingVerification: taxTracking.itcPendingVerification,
      itcBlockedOrIneligible: taxTracking.itcBlockedOrIneligible
    },
    disclosures: [
      "Management P&L is for internal business operations and does not constitute audited statutory accounts.",
      "Depreciation, amortization, financing costs, and income tax are excluded.",
      "Tax collected on sales is held in trust and excluded from business revenue.",
      profitability.cogsStatus === "incomplete"
        ? `Notice: ${profitability.unknownCostUnits} units sold had missing cost prices (${profitability.cogsCoveragePercent}% coverage). Gross Profit is flagged incomplete.`
        : "COGS coverage is complete based on recorded item cost snapshots."
    ]
  };
}

module.exports = {
  recordStockInward,
  getStockInwards,
  importRazorpaySettlement,
  getRazorpaySettlements,
  importCourierInvoice,
  getCourierInvoices,
  getFinancialReconciliationSummary,
  getFinanceOverview,
  getManagementPnL,
  createSavedReport,
  getSavedReports,
  deleteSavedReport,
  logExport,
  updateExportLog,
  getExportLogs
};
