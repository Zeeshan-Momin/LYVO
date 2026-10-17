const ah = require("express-async-handler");
const expenseService = require("../services/expenseService");
const financeService = require("../services/financeService");

// --- EXPENSES ---
exports.createExpense = ah(async (req, res) => {
  const expense = await expenseService.createExpense(req.body, req.user);
  res.status(201).json({ success: true, expense });
});

exports.getExpenses = ah(async (req, res) => {
  const result = await expenseService.getExpenses(req.query);
  res.json({ success: true, ...result });
});

exports.getExpenseSummary = ah(async (req, res) => {
  const summary = await expenseService.getExpenseSummary(req.query);
  res.json({ success: true, ...summary });
});

exports.cancelExpense = ah(async (req, res) => {
  const expense = await expenseService.cancelExpense(req.params.id, req.user);
  res.json({ success: true, message: "Expense cancelled successfully", expense });
});

// --- STOCK INWARD (GRN) ---
exports.recordStockInward = ah(async (req, res) => {
  const stockInward = await financeService.recordStockInward(req.body, req.user);
  res.status(201).json({ success: true, stockInward });
});

exports.getStockInwards = ah(async (req, res) => {
  const result = await financeService.getStockInwards(req.query);
  res.json({ success: true, ...result });
});

// --- RECONCILIATION ---
exports.importRazorpaySettlement = ah(async (req, res) => {
  const settlement = await financeService.importRazorpaySettlement(req.body, req.user);
  res.status(201).json({ success: true, settlement });
});

exports.getRazorpaySettlements = ah(async (req, res) => {
  const result = await financeService.getRazorpaySettlements(req.query);
  res.json({ success: true, ...result });
});

exports.importCourierInvoice = ah(async (req, res) => {
  const invoice = await financeService.importCourierInvoice(req.body, req.user);
  res.status(201).json({ success: true, invoice });
});

exports.getCourierInvoices = ah(async (req, res) => {
  const result = await financeService.getCourierInvoices(req.query);
  res.json({ success: true, ...result });
});

exports.getReconciliationSummary = ah(async (req, res) => {
  const summary = await financeService.getFinancialReconciliationSummary();
  res.json({ success: true, ...summary });
});

// --- SAVED REPORTS & EXPORT LOGS ---
exports.createSavedReport = ah(async (req, res) => {
  const report = await financeService.createSavedReport(req.body, req.user);
  res.status(201).json({ success: true, report });
});

exports.getSavedReports = ah(async (req, res) => {
  const reports = await financeService.getSavedReports(req.user);
  res.json({ success: true, reports });
});

exports.deleteSavedReport = ah(async (req, res) => {
  await financeService.deleteSavedReport(req.params.id, req.user);
  res.json({ success: true, message: "Saved report deleted successfully" });
});

exports.logExport = ah(async (req, res) => {
  const log = await financeService.logExport(req.body, req.user);
  res.status(201).json({ success: true, log });
});

exports.getExportLogs = ah(async (req, res) => {
  const result = await financeService.getExportLogs({ ...req.query, user: req.user });
  res.json({ success: true, ...result });
});

// --- FINANCE DASHBOARD & P&L ---
exports.getFinanceOverview = ah(async (req, res) => {
  const overview = await financeService.getFinanceOverview(req.query);
  res.json({ success: true, ...overview });
});

exports.getManagementPnL = ah(async (req, res) => {
  const pnl = await financeService.getManagementPnL(req.query);
  res.json({ success: true, ...pnl });
});

// --- PROFITABILITY & UNIT ECONOMICS (PHASE 3D-1) ---
const profitabilityService = require("../services/profitabilityService");

exports.getProductProfitability = ah(async (req, res) => {
  const result = await profitabilityService.getProductProfitability(req.query);
  res.json({ success: true, ...result });
});

exports.getCategoryProfitability = ah(async (req, res) => {
  const result = await profitabilityService.getCategoryProfitability(req.query);
  res.json({ success: true, ...result });
});

exports.getChannelProfitability = ah(async (req, res) => {
  const result = await profitabilityService.getChannelProfitability(req.query);
  res.json({ success: true, ...result });
});

exports.getOrderUnitEconomics = ah(async (req, res) => {
  const result = await profitabilityService.getOrderUnitEconomics(req.params.id);
  res.json({ success: true, data: result });
});

// --- REPORT EXECUTION ENGINE (PHASE 3D-2) ---
const reportExecutionService = require("../services/reportExecutionService");

exports.executeReport = ah(async (req, res) => {
  const result = await reportExecutionService.executeReport(req.body, req.user);
  res.json(result);
});

exports.executeSavedReport = ah(async (req, res) => {
  const result = await reportExecutionService.executeSavedReport(req.params.id, req.user, req.query);
  res.json(result);
});

// --- REPORT EXPORT ENGINE (PHASE 3D-3) ---
const reportExportService = require("../services/reportExportService");

exports.exportReportXlsx = ah(async (req, res) => {
  const { savedReportId, ...runtimeOverrides } = req.body || {};
  const result = await reportExportService.exportReport({
    reportDefinition: savedReportId ? {} : req.body,
    savedReportId: savedReportId || null,
    runtimeOverrides: savedReportId ? runtimeOverrides : {},
    format: "xlsx",
    user: req.user
  });
  res.json(result);
});

exports.exportReportPdf = ah(async (req, res) => {
  const { savedReportId, ...runtimeOverrides } = req.body || {};
  const result = await reportExportService.exportReport({
    reportDefinition: savedReportId ? {} : req.body,
    savedReportId: savedReportId || null,
    runtimeOverrides: savedReportId ? runtimeOverrides : {},
    format: "pdf",
    user: req.user
  });
  res.json(result);
});

exports.downloadExport = ah(async (req, res) => {
  const fileInfo = await reportExportService.getExportFileForDownload(req.params.id, req.user);
  res.setHeader("Content-Type", fileInfo.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${fileInfo.fileName}"`);
  res.sendFile(fileInfo.filePath);
});
