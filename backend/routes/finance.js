const router = require("express").Router();
const financeCtrl = require("../controllers/financeController");
const { protect, adminOnly } = require("../middleware/auth");

const guard = [protect, adminOnly];

// --- Expense Management ---
router.post("/expenses", ...guard, financeCtrl.createExpense);
router.get("/expenses", ...guard, financeCtrl.getExpenses);
router.get("/expenses/summary", ...guard, financeCtrl.getExpenseSummary);
router.delete("/expenses/:id", ...guard, financeCtrl.cancelExpense);

// --- Stock Inward (Procurement GRN) Foundation ---
router.post("/procurement/inward", ...guard, financeCtrl.recordStockInward);
router.get("/procurement/inward", ...guard, financeCtrl.getStockInwards);

// --- Reconciliation: Razorpay Settlements ---
router.post("/reconciliation/razorpay/import", ...guard, financeCtrl.importRazorpaySettlement);
router.get("/reconciliation/razorpay", ...guard, financeCtrl.getRazorpaySettlements);

// --- Reconciliation: Delhivery Courier Freight Invoices ---
router.post("/reconciliation/delhivery/import", ...guard, financeCtrl.importCourierInvoice);
router.get("/reconciliation/delhivery", ...guard, financeCtrl.getCourierInvoices);

// --- Reconciliation: Center Summary ---
router.get("/reconciliation/summary", ...guard, financeCtrl.getReconciliationSummary);

// --- Saved Reports & Export Logs ---
router.post("/reports/saved", ...guard, financeCtrl.createSavedReport);
router.get("/reports/saved", ...guard, financeCtrl.getSavedReports);
router.delete("/reports/saved/:id", ...guard, financeCtrl.deleteSavedReport);
router.post("/reports/exports/log", ...guard, financeCtrl.logExport);
router.get("/reports/exports/history", ...guard, financeCtrl.getExportLogs);

// --- Report Builder & Execution Engine (Phase 3D-2) ---
router.post("/reports/execute", ...guard, financeCtrl.executeReport);
router.get("/reports/saved/:id/execute", ...guard, financeCtrl.executeSavedReport);

// --- Report Export Engine (Phase 3D-3) ---
router.post("/reports/export/xlsx", ...guard, financeCtrl.exportReportXlsx);
router.post("/reports/export/pdf", ...guard, financeCtrl.exportReportPdf);
router.get("/reports/exports/download/:id", ...guard, financeCtrl.downloadExport);

// --- Finance Dashboard & P&L Management Reports ---
router.get("/overview", ...guard, financeCtrl.getFinanceOverview);
router.get("/pnl", ...guard, financeCtrl.getManagementPnL);

// --- Profitability & Unit Economics (Phase 3D-1) ---
router.get("/profitability/products", ...guard, financeCtrl.getProductProfitability);
router.get("/profitability/categories", ...guard, financeCtrl.getCategoryProfitability);
router.get("/profitability/channels", ...guard, financeCtrl.getChannelProfitability);
router.get("/profitability/orders/:id", ...guard, financeCtrl.getOrderUnitEconomics);

module.exports = router;
