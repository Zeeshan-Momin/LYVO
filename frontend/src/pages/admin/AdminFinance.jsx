import { useState, useEffect } from "react"
import {
  FiDollarSign, FiTrendingUp, FiActivity, FiLayers, FiShield,
  FiAlertTriangle, FiCheckCircle, FiInfo, FiTruck, FiCreditCard,
  FiPieChart, FiArrowUpRight, FiArrowDownRight, FiHelpCircle, FiCalendar,
  FiPackage, FiInbox, FiFileText, FiSliders, FiBookmark, FiDownload
} from "react-icons/fi"
import { financeAPI, adminAPI } from "../../api"
import Loading from "../../components/common/Loading"
import ExpenseManager from "../../components/admin/finance/ExpenseManager"
import StockInwardManager from "../../components/admin/finance/StockInwardManager"
import SettlementManager from "../../components/admin/finance/SettlementManager"
import CourierInvoiceManager from "../../components/admin/finance/CourierInvoiceManager"
import ReconciliationCenter from "../../components/admin/finance/ReconciliationCenter"
import ReportBuilder from "../../components/admin/finance/ReportBuilder"
import SavedReportsManager from "../../components/admin/finance/SavedReportsManager"
import ExportCenter from "../../components/admin/finance/ExportCenter"

const PROVENANCE_BADGES = {
  ACTUAL: { bg: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20", label: "ACTUAL" },
  ESTIMATED: { bg: "bg-blue-400/10 text-blue-400 border-blue-400/20", label: "ESTIMATED" },
  DERIVED: { bg: "bg-purple-400/10 text-purple-400 border-purple-400/20", label: "DERIVED" },
  UNRECONCILED: { bg: "bg-amber-400/10 text-amber-400 border-amber-400/20", label: "UNRECONCILED" },
  UNKNOWN: { bg: "bg-rose-400/10 text-rose-400 border-rose-400/20", label: "UNKNOWN" }
}

function ProvenanceTag({ type }) {
  const t = (type || "UNKNOWN").toUpperCase()
  const conf = PROVENANCE_BADGES[t] || PROVENANCE_BADGES.UNKNOWN
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${conf.bg}`}>
      {conf.label}
    </span>
  )
}

export default function AdminFinance() {
  const [activeTab, setActiveTab] = useState("overview") // "overview" | "pnl" | "reconciliation" | "expenses" | "inward" | "settlements" | "invoices" | "reports" | "saved_reports" | "exports"
  const [dateRangeOption, setDateRangeOption] = useState("30d") // "7d" | "30d" | "90d" | "year" | "custom"
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")

  const [selectedSavedTemplate, setSelectedSavedTemplate] = useState(null)

  const [overviewData, setOverviewData] = useState(null)
  const [loadingOverview, setLoadingOverview] = useState(true)

  const [pnlData, setPnlData] = useState(null)
  const [loadingPnl, setLoadingPnl] = useState(false)

  const getDateParams = () => {
    const end = new Date()
    let start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    if (dateRangeOption === "7d") {
      start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    } else if (dateRangeOption === "30d") {
      start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    } else if (dateRangeOption === "90d") {
      start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    } else if (dateRangeOption === "year") {
      start = new Date(new Date().getFullYear(), 0, 1)
    } else if (dateRangeOption === "custom" && customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd }
    }

    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0]
    }
  }

  // Load Overview
  useEffect(() => {
    if (activeTab !== "overview") return
    setLoadingOverview(true)
    const params = getDateParams()
    financeAPI.getOverview(params)
      .then(res => setOverviewData(res.data))
      .catch(err => console.error("Error fetching finance overview:", err))
      .finally(() => setLoadingOverview(false))
  }, [activeTab, dateRangeOption, customStart, customEnd])

  // Load P&L
  useEffect(() => {
    if (activeTab !== "pnl") return
    setLoadingPnl(true)
    const params = getDateParams()
    financeAPI.getPnL(params)
      .then(res => setPnlData(res.data))
      .catch(err => console.error("Error fetching management P&L:", err))
      .finally(() => setLoadingPnl(false))
  }, [activeTab, dateRangeOption, customStart, customEnd])

  const kpis = overviewData?.kpis
  const isCogsIncomplete = kpis?.profitability?.cogsStatus === "incomplete"

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-3xl tracking-wider">Finance & Management P&L</h1>
            <span className="bg-acid/10 text-acid border border-acid/20 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full">
              Operational & Managerial
            </span>
          </div>
          <p className="text-white/40 text-sm mt-0.5">
            Financial control, income statement economics, procurement, expense vouchers, and reconciliation
          </p>
        </div>

        {/* Global Date Range Selector */}
        {["overview", "pnl", "expenses"].includes(activeTab) && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-dark-700 p-1 rounded-xl border border-white/10 text-xs">
              {[
                { id: "7d", label: "7D" },
                { id: "30d", label: "30D" },
                { id: "90d", label: "90D" },
                { id: "year", label: "This Year" },
                { id: "custom", label: "Custom" }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDateRangeOption(tab.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    dateRangeOption === tab.id
                      ? "bg-acid text-dark-900 font-semibold shadow"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {dateRangeOption === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="input py-1 px-2 text-xs w-36 bg-dark-700 border-white/10"
                />
                <span className="text-white/30 text-xs">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="input py-1 px-2 text-xs w-36 bg-dark-700 border-white/10"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Statutory Exclusion Notice */}
      <div className="bg-dark-800/80 border border-white/10 p-3.5 rounded-2xl flex items-start gap-3 text-xs text-white/70">
        <FiInfo className="text-acid shrink-0 mt-0.5" size={16} />
        <div>
          <span className="font-semibold text-white">Managerial Reporting Notice: </span>
          This dashboard provides internal management economics and operational P&L. It excludes depreciation, financing costs, and statutory tax filings (GSTR-1, GSTR-3B, e-Invoicing). Tax collected is tracked in trust and excluded from business revenue.
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-white/10 gap-2 sm:gap-6 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: "overview", label: "Finance Overview", icon: FiActivity },
          { id: "pnl", label: "Management P&L", icon: FiDollarSign },
          { id: "reconciliation", label: "Reconciliation", icon: FiShield },
          { id: "reports", label: "Report Builder", icon: FiSliders },
          { id: "saved_reports", label: "Saved Templates", icon: FiBookmark },
          { id: "exports", label: "Export Center", icon: FiDownload },
          { id: "expenses", label: "Expenses", icon: FiFileText },
          { id: "inward", label: "Stock Inward", icon: FiPackage },
          { id: "settlements", label: "Gateway Settlements", icon: FiCreditCard },
          { id: "invoices", label: "Courier Invoices", icon: FiTruck }
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-all ${
                isActive
                  ? "border-acid text-acid font-semibold"
                  : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: FINANCE OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <>
          {loadingOverview ? (
            <div className="py-20"><Loading /></div>
          ) : (
            <div className="space-y-6">
              {/* Primary KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 1. Net Revenue */}
                <div className="card p-5 space-y-2 border-acid/30">
                  <div className="flex items-center justify-between text-xs text-white/40">
                    <span className="text-acid font-medium">Net Revenue</span>
                    <ProvenanceTag type={kpis?.revenue?.provenance || "ACTUAL"} />
                  </div>
                  <div className="text-2xl font-bold font-display text-acid">
                    ₹{(kpis?.revenue?.netRevenue || 0).toLocaleString()}
                  </div>
                  <p className="text-[11px] text-white/40">
                    Net Merchandise + Shipping - Refunds
                  </p>
                </div>

                {/* 2. COGS */}
                <div className="card p-5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-white/40">
                    <span>COGS (Goods Sold)</span>
                    <ProvenanceTag type={kpis?.profitability?.cogsProvenance || "DERIVED"} />
                  </div>
                  <div className="text-2xl font-bold font-display text-white">
                    ₹{(kpis?.profitability?.totalCogs || 0).toLocaleString()}
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/40">Coverage:</span>
                    <span className={`font-semibold ${isCogsIncomplete ? "text-amber-400" : "text-emerald-400"}`}>
                      {kpis?.profitability?.cogsCoveragePercent || 100}%
                    </span>
                  </div>
                </div>

                {/* 3. Gross Profit */}
                <div className="card p-5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-white/40">
                    <span>Gross Profit</span>
                    <ProvenanceTag type={kpis?.profitability?.grossProfitProvenance || "DERIVED"} />
                  </div>
                  <div className="text-2xl font-bold font-display">
                    {kpis?.profitability?.grossProfit !== null ? (
                      <span className={kpis.profitability.grossProfit >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        ₹{kpis.profitability.grossProfit.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-rose-400 text-lg">Incomplete COGS</span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/40">
                    {kpis?.profitability?.grossMarginPercent !== null
                      ? `Margin: ${kpis?.profitability?.grossMarginPercent}%`
                      : "Cannot derive without complete COGS"}
                  </p>
                </div>

                {/* 4. Operating Expenses */}
                <div className="card p-5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-white/40">
                    <span>Operating Expenses</span>
                    <ProvenanceTag type="ACTUAL" />
                  </div>
                  <div className="text-2xl font-bold font-display text-white/90">
                    ₹{(kpis?.profitability?.operatingExpenses || 0).toLocaleString()}
                  </div>
                  <p className="text-[11px] text-white/40">Recorded administrative & marketing spend</p>
                </div>

                {/* 5. Operating Result */}
                <div className="card p-5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-white/40">
                    <span>Operating Result</span>
                    <ProvenanceTag type={kpis?.profitability?.operatingProfitProvenance || "DERIVED"} />
                  </div>
                  <div className="text-2xl font-bold font-display">
                    {kpis?.profitability?.operatingProfit !== null ? (
                      <span className={kpis.profitability.operatingProfit >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        ₹{kpis.profitability.operatingProfit.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-rose-400 text-lg">Incomplete</span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/40">
                    {kpis?.profitability?.operatingMarginPercent !== null
                      ? `Operating Margin: ${kpis?.profitability?.operatingMarginPercent}%`
                      : "Awaiting complete COGS"}
                  </p>
                </div>
              </div>

              {/* Incomplete COGS Alert */}
              {isCogsIncomplete && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-start gap-3">
                  <FiAlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
                  <div className="text-xs text-amber-200/90">
                    <p className="font-semibold text-amber-300">Incomplete COGS Coverage Notice</p>
                    <p className="mt-1 leading-relaxed">
                      {kpis?.profitability?.unknownCostUnits} units sold in this period lack historical purchase cost price records ({kpis?.profitability?.cogsCoveragePercent}% cost coverage). In accordance with LYVO financial integrity principles, missing costs are NEVER assumed as ₹0. Gross profit and operating results are flagged as partial/incomplete.
                    </p>
                  </div>
                </div>
              )}

              {/* Middle Section: Revenue Waterfall & Operating Expenses Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Breakdown Card */}
                <div className="card p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <FiActivity className="text-acid" />
                      <h2 className="font-semibold text-base">Revenue Mechanics (Top-Line)</h2>
                    </div>
                    <span className="text-xs text-white/40">Excludes statutory GST</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                      <span className="text-white/70">Gross Merchandise Sales (GMS)</span>
                      <span className="font-semibold text-white">₹{(kpis?.revenue?.grossMerchandiseSales || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                      <span className="text-white/70">Less: Product Markdowns/Discounts</span>
                      <span className="font-semibold text-rose-400">-₹{(kpis?.revenue?.productDiscounts || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                      <span className="text-white/70">Less: Coupon Discounts Allocated</span>
                      <span className="font-semibold text-rose-400">-₹{(kpis?.revenue?.couponDiscounts || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-white/5 bg-white/[0.02] px-2 rounded-lg">
                      <span className="font-medium text-white/90">Net Merchandise Sales</span>
                      <span className="font-semibold text-acid">₹{(kpis?.revenue?.netMerchandiseSales || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                      <span className="text-white/70">Add: Shipping Revenue Collected</span>
                      <span className="font-semibold text-blue-400">+₹{(kpis?.revenue?.shippingRevenue || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                      <span className="text-white/70">Less: Actual Refunds Processed</span>
                      <span className="font-semibold text-rose-400">-₹{(kpis?.revenue?.refundsValue || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 bg-acid/10 px-3 rounded-xl border border-acid/20 text-sm">
                      <span className="font-bold text-acid">Net Business Revenue</span>
                      <span className="font-bold text-acid">₹{(kpis?.revenue?.netRevenue || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Operating Expenses Breakdown Card */}
                <div className="card p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <FiPieChart className="text-purple-400" />
                      <h2 className="font-semibold text-base">Operating Expenses by Category</h2>
                    </div>
                    <span className="text-xs text-white/40">
                      Total: ₹{(kpis?.profitability?.operatingExpenses || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {(overviewData?.expensesByCategory || []).map((c, i) => (
                      <div key={c.category || i} className="flex items-center justify-between p-2 rounded-xl bg-dark-700/40 text-xs">
                        <div>
                          <p className="font-medium text-white capitalize">{c.category?.replace("_", " ")}</p>
                          <p className="text-[11px] text-white/40">{c.count} transactions (GST: ₹{(c.gst || 0).toLocaleString()})</p>
                        </div>
                        <span className="font-bold text-white/90">₹{(c.spend || 0).toLocaleString()}</span>
                      </div>
                    ))}
                    {(!overviewData?.expensesByCategory || overviewData.expensesByCategory.length === 0) && (
                      <p className="text-center text-white/30 py-8 text-xs">No operating expenses recorded in this period</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Grid: Gateway Economics, Logistics Economics & Tax Tracking */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Payment Gateway Economics */}
                <div className="card p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                    <div className="flex items-center gap-2">
                      <FiCreditCard className="text-acid" />
                      <h3 className="font-semibold text-sm">Gateway Economics</h3>
                    </div>
                    <ProvenanceTag type={kpis?.gatewayEconomics?.provenance || "ACTUAL"} />
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/50">Gross Settled:</span>
                      <span className="font-semibold text-white">₹{(kpis?.gatewayEconomics?.grossSettled || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Actual Gateway Fees:</span>
                      <span className="font-semibold text-rose-400">₹{(kpis?.gatewayEconomics?.actualGatewayFeesPaid || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Gateway GST on Fees:</span>
                      <span className="font-semibold text-rose-400">₹{(kpis?.gatewayEconomics?.actualGatewayTaxPaid || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-white/5">
                      <span className="text-white/70 font-medium">Net Bank Deposit:</span>
                      <span className="font-bold text-acid">₹{(kpis?.gatewayEconomics?.netBankSettlement || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Logistics & Freight Economics */}
                <div className="card p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                    <div className="flex items-center gap-2">
                      <FiTruck className="text-blue-400" />
                      <h3 className="font-semibold text-sm">Logistics Economics</h3>
                    </div>
                    <ProvenanceTag type={kpis?.logisticsEconomics?.provenance || "ACTUAL"} />
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/50">Customer Shipping:</span>
                      <span className="font-semibold text-white">₹{(kpis?.logisticsEconomics?.customerShippingCollected || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Total Freight Billed:</span>
                      <span className="font-semibold text-rose-400">₹{(kpis?.logisticsEconomics?.actualFreightBilled || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Matched Invoices:</span>
                      <span className="font-semibold text-white/80">{kpis?.logisticsEconomics?.invoicesCount || 0} invoices</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-white/5">
                      <span className="text-white/70 font-medium">Net Freight Balance:</span>
                      <span className="font-bold text-white">
                        ₹{((kpis?.logisticsEconomics?.customerShippingCollected || 0) - (kpis?.logisticsEconomics?.actualFreightBilled || 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Tax Tracking & ITC */}
                <div className="card p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                    <div className="flex items-center gap-2">
                      <FiShield className="text-amber-400" />
                      <h3 className="font-semibold text-sm">Tax Tracking & ITC</h3>
                    </div>
                    <ProvenanceTag type="ACTUAL" />
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/50">Sales Tax (Held in trust):</span>
                      <span className="font-semibold text-amber-300">₹{(kpis?.taxTracking?.taxCollectedOnSales || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Expense GST Paid:</span>
                      <span className="font-semibold text-white">₹{(kpis?.taxTracking?.taxPaidOnExpenses || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">ITC Eligible:</span>
                      <span className="font-semibold text-emerald-400">₹{(kpis?.taxTracking?.itcEligible || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">ITC Pending Verification:</span>
                      <span className="font-semibold text-amber-400">₹{(kpis?.taxTracking?.itcPendingVerification || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MANAGEMENT P&L STATEMENT */}
      {/* ========================================================================= */}
      {activeTab === "pnl" && (
        <>
          {loadingPnl ? (
            <div className="py-20"><Loading /></div>
          ) : (
            <div className="space-y-6">
              <div className="card overflow-hidden">
                <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-xl tracking-wide">Managerial Income Statement (P&L)</h2>
                    <p className="text-xs text-white/40 mt-0.5">
                      Period: {pnlData?.dateRange?.start ? new Date(pnlData.dateRange.start).toLocaleDateString() : ""} to {pnlData?.dateRange?.end ? new Date(pnlData.dateRange.end).toLocaleDateString() : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/40">Status:</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      pnlData?.operatingResult?.isComplete
                        ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
                        : "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                    }`}>
                      {pnlData?.operatingResult?.isComplete ? "Complete COGS Coverage" : "Partial / Incomplete COGS"}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-dark-700/60 text-white/40 uppercase tracking-wider font-mono text-[10px] border-b border-white/5">
                      <tr>
                        <th className="py-3.5 px-6">Line Item</th>
                        <th className="py-3.5 px-4">Formula / Source</th>
                        <th className="py-3.5 px-4 text-center">Provenance</th>
                        <th className="py-3.5 px-6 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {/* SECTION 1: REVENUE */}
                      <tr className="bg-dark-800/80 font-bold text-white/90">
                        <td colSpan="4" className="py-3 px-6 text-acid uppercase font-mono tracking-wider text-[11px]">
                          1. Operating Revenue
                        </td>
                      </tr>
                      <tr className="hover:bg-white/[0.01]">
                        <td className="py-2.5 px-6 pl-10 text-white/80">Gross Merchandise Sales (GMS)</td>
                        <td className="py-2.5 px-4 text-white/40">sum(item.price × quantity) for non-cancelled orders</td>
                        <td className="py-2.5 px-4 text-center"><ProvenanceTag type="ACTUAL" /></td>
                        <td className="py-2.5 px-6 text-right font-medium text-white">
                          ₹{(pnlData?.revenue?.grossMerchandiseSales?.amount || 0).toLocaleString()}
                        </td>
                      </tr>
                      <tr className="hover:bg-white/[0.01]">
                        <td className="py-2.5 px-6 pl-10 text-white/80">Less: Product Markdowns / Discounts</td>
                        <td className="py-2.5 px-4 text-white/40">sum((mrp - price) × quantity)</td>
                        <td className="py-2.5 px-4 text-center"><ProvenanceTag type="ACTUAL" /></td>
                        <td className="py-2.5 px-6 text-right font-medium text-rose-400">
                          -₹{(pnlData?.revenue?.productDiscounts?.amount || 0).toLocaleString()}
                        </td>
                      </tr>
                      <tr className="hover:bg-white/[0.01]">
                        <td className="py-2.5 px-6 pl-10 text-white/80">Less: Coupon Discounts Allocated</td>
                        <td className="py-2.5 px-4 text-white/40">order coupon discounts / line item allocation</td>
                        <td className="py-2.5 px-4 text-center"><ProvenanceTag type="ACTUAL" /></td>
                        <td className="py-2.5 px-6 text-right font-medium text-rose-400">
                          -₹{(pnlData?.revenue?.couponDiscounts?.amount || 0).toLocaleString()}
                        </td>
                      </tr>
                      <tr className="bg-dark-700/30 font-semibold">
                        <td className="py-2.5 px-6 pl-10 text-white">Net Merchandise Sales</td>
                        <td className="py-2.5 px-4 text-white/40">GMS - Product Discounts - Coupon Discounts</td>
                        <td className="py-2.5 px-4 text-center"><ProvenanceTag type="DERIVED" /></td>
                        <td className="py-2.5 px-6 text-right text-acid">
                          ₹{(pnlData?.revenue?.netMerchandiseSales?.amount || 0).toLocaleString()}
                        </td>
                      </tr>
                      <tr className="hover:bg-white/[0.01]">
                        <td className="py-2.5 px-6 pl-10 text-white/80">Add: Customer Shipping Revenue</td>
                        <td className="py-2.5 px-4 text-white/40">order.pricing.shippingCost</td>
                        <td className="py-2.5 px-4 text-center"><ProvenanceTag type="ACTUAL" /></td>
                        <td className="py-2.5 px-6 text-right font-medium text-blue-400">
                          +₹{(pnlData?.revenue?.shippingRevenue?.amount || 0).toLocaleString()}
                        </td>
                      </tr>
                      <tr className="hover:bg-white/[0.01]">
                        <td className="py-2.5 px-6 pl-10 text-white/80">Less: Actual Processed Refunds</td>
                        <td className="py-2.5 px-4 text-white/40">order.totalRefundedAmount ledger</td>
                        <td className="py-2.5 px-4 text-center"><ProvenanceTag type="ACTUAL" /></td>
                        <td className="py-2.5 px-6 text-right font-medium text-rose-400">
                          -₹{(pnlData?.revenue?.refunds?.amount || 0).toLocaleString()}
                        </td>
                      </tr>
                      <tr className="bg-acid/10 font-bold text-sm">
                        <td className="py-3 px-6 text-acid">Net Business Revenue</td>
                        <td className="py-3 px-4 text-white/50 text-xs">Net Merchandise + Shipping - Refunds</td>
                        <td className="py-3 px-4 text-center"><ProvenanceTag type="DERIVED" /></td>
                        <td className="py-3 px-6 text-right text-acid">
                          ₹{(pnlData?.revenue?.netRevenue?.amount || 0).toLocaleString()}
                        </td>
                      </tr>

                      {/* SECTION 2: COGS */}
                      <tr className="bg-dark-800/80 font-bold text-white/90">
                        <td colSpan="4" className="py-3 px-6 text-purple-400 uppercase font-mono tracking-wider text-[11px]">
                          2. Cost of Goods Sold (COGS)
                        </td>
                      </tr>
                      <tr className="hover:bg-white/[0.01]">
                        <td className="py-2.5 px-6 pl-10 text-white/80">Actual Recorded Cost (Immutable Snapshots)</td>
                        <td className="py-2.5 px-4 text-white/40">items.costPrice (source: actual)</td>
                        <td className="py-2.5 px-4 text-center"><ProvenanceTag type="ACTUAL" /></td>
                        <td className="py-2.5 px-6 text-right font-medium text-white/80">
                          ₹{(pnlData?.cogs?.knownCogs?.amount || 0).toLocaleString()}
                        </td>
                      </tr>
                      <tr className="hover:bg-white/[0.01]">
                        <td className="py-2.5 px-6 pl-10 text-white/80">Estimated Cost (Unverified Snapshots)</td>
                        <td className="py-2.5 px-4 text-white/40">items.costPrice (source: estimated)</td>
                        <td className="py-2.5 px-4 text-center"><ProvenanceTag type="ESTIMATED" /></td>
                        <td className="py-2.5 px-6 text-right font-medium text-blue-400">
                          ₹{(pnlData?.cogs?.estimatedCogs?.amount || 0).toLocaleString()}
                        </td>
                      </tr>
                      <tr className="bg-dark-700/30 font-semibold">
                        <td className="py-2.5 px-6 pl-10 text-white">Total COGS</td>
                        <td className="py-2.5 px-4 text-white/40">Known COGS + Estimated COGS ({pnlData?.cogs?.cogsCoveragePercent || 100}% coverage)</td>
                        <td className="py-2.5 px-4 text-center"><ProvenanceTag type="DERIVED" /></td>
                        <td className="py-2.5 px-6 text-right text-white">
                          ₹{(pnlData?.cogs?.totalCogs?.amount || 0).toLocaleString()}
                        </td>
                      </tr>
                      <tr className="bg-purple-500/10 font-bold text-sm">
                        <td className="py-3 px-6 text-purple-300">
                          Gross Profit (Margin: {pnlData?.cogs?.grossMarginPercent !== null && pnlData?.cogs?.grossMarginPercent !== undefined ? `${pnlData?.cogs?.grossMarginPercent}%` : "Incomplete"})
                        </td>
                        <td className="py-3 px-4 text-white/50 text-xs">Net Revenue - Total COGS</td>
                        <td className="py-3 px-4 text-center">
                          <ProvenanceTag type={pnlData?.cogs?.grossProfit?.provenance || "DERIVED"} />
                        </td>
                        <td className="py-3 px-6 text-right text-purple-300">
                          {pnlData?.cogs?.grossProfit?.amount !== null && pnlData?.cogs?.grossProfit?.amount !== undefined
                            ? `₹${pnlData.cogs.grossProfit.amount.toLocaleString()}`
                            : "Incomplete COGS"}
                        </td>
                      </tr>

                      {/* SECTION 3: OPERATING EXPENSES */}
                      <tr className="bg-dark-800/80 font-bold text-white/90">
                        <td colSpan="4" className="py-3 px-6 text-amber-400 uppercase font-mono tracking-wider text-[11px]">
                          3. Operating Expenses (OPEX)
                        </td>
                      </tr>
                      {[
                        { key: "marketing", label: "Marketing & Performance Ads" },
                        { key: "logistics_freight", label: "Logistics & Carrier Freight" },
                        { key: "packaging", label: "Packaging Materials" },
                        { key: "software_it", label: "Software, Cloud & IT Infrastructure" },
                        { key: "rent_utilities", label: "Warehouse Rent & Utilities" },
                        { key: "salaries", label: "Salaries & Contractor Fees" },
                        { key: "legal_accounting", label: "Legal & Accounting Professional Fees" },
                        { key: "bank_charges", label: "Bank Charges & Gateway Commissions" },
                        { key: "procurement", label: "Procurement & Quality Inspection" },
                        { key: "other", label: "Other Administrative Expenses" }
                      ].map(item => (
                        <tr key={item.key} className="hover:bg-white/[0.01]">
                          <td className="py-2 px-6 pl-10 text-white/80">{item.label}</td>
                          <td className="py-2 px-4 text-white/40">Expense model: {item.key}</td>
                          <td className="py-2 px-4 text-center"><ProvenanceTag type="ACTUAL" /></td>
                          <td className="py-2 px-6 text-right font-medium text-white/80">
                            ₹{(pnlData?.operatingExpenses?.[item.key]?.amount || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-dark-700/30 font-semibold">
                        <td className="py-2.5 px-6 pl-10 text-white">Total Operating Expenses</td>
                        <td className="py-2.5 px-4 text-white/40">Sum of all non-cancelled operational expense vouchers</td>
                        <td className="py-2.5 px-4 text-center"><ProvenanceTag type="DERIVED" /></td>
                        <td className="py-2.5 px-6 text-right text-amber-400">
                          ₹{(pnlData?.operatingExpenses?.totalOperatingExpenses?.amount || 0).toLocaleString()}
                        </td>
                      </tr>

                      {/* SECTION 4: OPERATING RESULT */}
                      <tr className="bg-dark-800/80 font-bold text-white/90">
                        <td colSpan="4" className="py-3 px-6 text-emerald-400 uppercase font-mono tracking-wider text-[11px]">
                          4. Operating Result (EBITDA Approximation)
                        </td>
                      </tr>
                      <tr className="bg-emerald-500/10 font-bold text-base">
                        <td className="py-4 px-6 text-white">
                          Operating Profit / (Loss)
                          {pnlData?.operatingResult?.operatingMarginPercent !== null && pnlData?.operatingResult?.operatingMarginPercent !== undefined && (
                            <span className="text-xs text-white/60 font-normal ml-2">
                              (Operating Margin: {pnlData?.operatingResult?.operatingMarginPercent}%)
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-white/50 text-xs font-normal">Gross Profit - Total Operating Expenses</td>
                        <td className="py-4 px-4 text-center">
                          <ProvenanceTag type={pnlData?.operatingResult?.operatingProfit?.provenance || "DERIVED"} />
                        </td>
                        <td className="py-4 px-6 text-right text-emerald-400">
                          {pnlData?.operatingResult?.operatingProfit?.amount !== null && pnlData?.operatingResult?.operatingProfit?.amount !== undefined ? (
                            <span className={(pnlData?.operatingResult?.operatingProfit?.amount || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}>
                              ₹{pnlData?.operatingResult?.operatingProfit?.amount?.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-rose-400 text-sm">Incomplete (Missing COGS)</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Disclosures Footer */}
                <div className="p-4 bg-dark-900/60 border-t border-white/5 text-xs text-white/50 space-y-1">
                  <p className="font-semibold text-white/70">Disclosures & Methodology Notes:</p>
                  {(pnlData?.disclosures || []).map((d, i) => (
                    <p key={i} className="leading-relaxed">• {d}</p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RECONCILIATION */}
      {/* ========================================================================= */}
      {activeTab === "reconciliation" && (
        <ReconciliationCenter onNavigateTab={setActiveTab} />
      )}

      {/* ========================================================================= */}
      {/* TAB 4: EXPENSE MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === "expenses" && (
        <ExpenseManager dateParams={getDateParams()} />
      )}

      {/* ========================================================================= */}
      {/* TAB 5: STOCK INWARD / PROCUREMENT */}
      {/* ========================================================================= */}
      {activeTab === "inward" && (
        <StockInwardManager />
      )}

      {/* ========================================================================= */}
      {/* TAB 6: RAZORPAY GATEWAY SETTLEMENTS */}
      {/* ========================================================================= */}
      {activeTab === "settlements" && (
        <SettlementManager />
      )}

      {/* ========================================================================= */}
      {/* TAB 7: DELHIVERY COURIER FREIGHT INVOICES */}
      {/* ========================================================================= */}
      {activeTab === "invoices" && (
        <CourierInvoiceManager />
      )}

      {/* ========================================================================= */}
      {/* TAB 8: REPORT BUILDER (PHASE 3D-5) */}
      {/* ========================================================================= */}
      {activeTab === "reports" && (
        <ReportBuilder
          initialTemplate={selectedSavedTemplate}
          onOpenSavedReports={() => setActiveTab("saved_reports")}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 9: SAVED REPORT TEMPLATES (PHASE 3D-5) */}
      {/* ========================================================================= */}
      {activeTab === "saved_reports" && (
        <SavedReportsManager
          onSelectTemplate={(tmpl) => {
            setSelectedSavedTemplate(tmpl)
            setActiveTab("reports")
          }}
          onNewReport={() => {
            setSelectedSavedTemplate(null)
            setActiveTab("reports")
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 10: EXPORT CENTER (PHASE 3D-5) */}
      {/* ========================================================================= */}
      {activeTab === "exports" && (
        <ExportCenter />
      )}
    </div>
  )
}
