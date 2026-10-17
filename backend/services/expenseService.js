const Expense = require("../models/Expense");
const mongoose = require("mongoose");

/**
 * Creates a new expense with GST and ITC safety validation
 */
async function createExpense(data, user) {
  const {
    expenseDate,
    category,
    subcategory,
    description,
    vendor,
    invoiceNumber,
    invoiceDate,
    taxableAmount,
    cgst = 0,
    sgst = 0,
    igst = 0,
    cess = 0,
    grossAmount,
    paymentMethod,
    paymentStatus,
    itcEligibility = "pending_verification",
    itcClaimed = false,
    itcAmount = 0,
    attachmentUrl,
    notes
  } = data;

  if (!description || !description.trim()) {
    const err = new Error("Expense description is required");
    err.statusCode = 400;
    throw err;
  }

  if (!category) {
    const err = new Error("Expense category is required");
    err.statusCode = 400;
    throw err;
  }

  if (!vendor || !vendor.name || !vendor.name.trim()) {
    const err = new Error("Vendor name is required");
    err.statusCode = 400;
    throw err;
  }

  const numTaxable = Number(taxableAmount);
  if (isNaN(numTaxable) || numTaxable < 0) {
    const err = new Error("Taxable amount must be a valid non-negative number");
    err.statusCode = 400;
    throw err;
  }

  const numCgst = Math.max(0, Number(cgst) || 0);
  const numSgst = Math.max(0, Number(sgst) || 0);
  const numIgst = Math.max(0, Number(igst) || 0);
  const numCess = Math.max(0, Number(cess) || 0);
  const totalGst = numCgst + numSgst + numIgst + numCess;

  const computedGross = numTaxable + totalGst;
  const finalGross = grossAmount !== undefined && !isNaN(Number(grossAmount))
    ? Number(grossAmount)
    : computedGross;

  // ITC Safety check: ITC amount can NEVER exceed total GST paid on the invoice
  let finalItcAmount = 0;
  if (itcEligibility === "eligible") {
    finalItcAmount = itcAmount !== undefined && !isNaN(Number(itcAmount))
      ? Math.min(Number(itcAmount), totalGst)
      : totalGst;
  } else if (itcEligibility === "pending_verification") {
    finalItcAmount = Number(itcAmount) || 0;
  } else {
    // Ineligible or blocked
    finalItcAmount = 0;
  }

  const expense = await Expense.create({
    expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
    category,
    subcategory: subcategory || "",
    description: description.trim(),
    vendor: {
      name: vendor.name.trim(),
      gstin: (vendor.gstin || "").trim().toUpperCase(),
      pan: (vendor.pan || "").trim().toUpperCase()
    },
    invoiceNumber: (invoiceNumber || "").trim(),
    invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
    taxableAmount: numTaxable,
    cgst: numCgst,
    sgst: numSgst,
    igst: numIgst,
    cess: numCess,
    totalGst,
    grossAmount: finalGross,
    paymentMethod: paymentMethod || "bank_transfer",
    paymentStatus: paymentStatus || "paid",
    itcEligibility,
    itcClaimed: Boolean(itcClaimed),
    itcAmount: finalItcAmount,
    attachmentUrl: attachmentUrl || "",
    notes: notes || "",
    status: "approved",
    createdBy: user?._id,
    updatedBy: user?._id
  });

  return expense;
}

/**
 * Lists expenses with filtering and pagination
 */
async function getExpenses({
  startDate,
  endDate,
  category,
  paymentStatus,
  itcEligibility,
  status = "approved",
  page = 1,
  limit = 20
} = {}) {
  const query = {};

  if (status && status !== "all") {
    query.status = status;
  }

  if (category && category !== "all") {
    query.category = category;
  }

  if (paymentStatus && paymentStatus !== "all") {
    query.paymentStatus = paymentStatus;
  }

  if (itcEligibility && itcEligibility !== "all") {
    query.itcEligibility = itcEligibility;
  }

  if (startDate || endDate) {
    query.expenseDate = {};
    if (startDate) query.expenseDate.$gte = new Date(startDate);
    if (endDate) query.expenseDate.$lte = new Date(endDate);
  }

  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (pg - 1) * lim;

  const [expenses, total] = await Promise.all([
    Expense.find(query)
      .sort({ expenseDate: -1 })
      .skip(skip)
      .limit(lim)
      .populate("createdBy", "name email")
      .lean(),
    Expense.countDocuments(query)
  ]);

  return {
    expenses,
    pagination: {
      total,
      page: pg,
      limit: lim,
      pages: Math.ceil(total / lim) || 1
    }
  };
}

/**
 * Gets aggregated summary of expenses
 */
async function getExpenseSummary({ startDate, endDate } = {}) {
  const matchFilter = { status: { $ne: "cancelled" } };

  if (startDate || endDate) {
    matchFilter.expenseDate = {};
    if (startDate) matchFilter.expenseDate.$gte = new Date(startDate);
    if (endDate) matchFilter.expenseDate.$lte = new Date(endDate);
  }

  const [categoryAgg, totalsAgg, itcAgg] = await Promise.all([
    Expense.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          totalTaxable: { $sum: "$taxableAmount" },
          totalGst: { $sum: "$totalGst" },
          totalGross: { $sum: "$grossAmount" }
        }
      },
      { $sort: { totalGross: -1 } }
    ]),
    Expense.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: 1 },
          grossSpend: { $sum: "$grossAmount" },
          taxableSpend: { $sum: "$taxableAmount" },
          cgstPaid: { $sum: "$cgst" },
          sgstPaid: { $sum: "$sgst" },
          igstPaid: { $sum: "$igst" },
          cessPaid: { $sum: "$cess" },
          totalGstPaid: { $sum: "$totalGst" },
          totalItcEligible: {
            $sum: { $cond: [{ $eq: ["$itcEligibility", "eligible"] }, "$itcAmount", 0] }
          },
          totalItcPending: {
            $sum: { $cond: [{ $eq: ["$itcEligibility", "pending_verification"] }, "$totalGst", 0] }
          },
          totalItcIneligible: {
            $sum: { $cond: [{ $in: ["$itcEligibility", ["ineligible", "blocked"]] }, "$totalGst", 0] }
          }
        }
      }
    ]),
    Expense.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$itcEligibility",
          count: { $sum: 1 },
          gstAmount: { $sum: "$totalGst" },
          itcAmount: { $sum: "$itcAmount" }
        }
      }
    ])
  ]);

  const totals = totalsAgg[0] || {
    totalExpenses: 0,
    grossSpend: 0,
    taxableSpend: 0,
    cgstPaid: 0,
    sgstPaid: 0,
    igstPaid: 0,
    cessPaid: 0,
    totalGstPaid: 0,
    totalItcEligible: 0,
    totalItcPending: 0,
    totalItcIneligible: 0
  };

  return {
    totals,
    categoryBreakdown: categoryAgg.map(c => ({
      category: c._id,
      count: c.count,
      taxable: c.totalTaxable,
      gst: c.totalGst,
      gross: c.totalGross
    })),
    itcBreakdown: itcAgg
  };
}

/**
 * Cancels an expense (soft-delete / status update for financial auditability)
 */
async function cancelExpense(id, user) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error("Invalid expense ID");
    err.statusCode = 400;
    throw err;
  }

  const expense = await Expense.findByIdAndUpdate(
    id,
    { status: "cancelled", updatedBy: user?._id },
    { new: true }
  );

  if (!expense) {
    const err = new Error("Expense record not found");
    err.statusCode = 404;
    throw err;
  }

  return expense;
}

module.exports = {
  createExpense,
  getExpenses,
  getExpenseSummary,
  cancelExpense
};
