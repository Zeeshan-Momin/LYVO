import { useState, useEffect } from "react"
import {
  FiPlay, FiDownload, FiBookmark, FiRefreshCw, FiCalendar, FiFilter,
  FiLayers, FiPieChart, FiDollarSign, FiInfo, FiCheckCircle, FiAlertTriangle,
  FiFileText, FiArrowUpRight, FiArrowDownRight, FiX, FiCheck, FiChevronRight,
  FiChevronLeft, FiSliders, FiList, FiTrendingUp
} from "react-icons/fi"
import { financeAPI } from "../../../api"
import Loading from "../../common/Loading"
import toast from "react-hot-toast"

const REPORT_TYPES = [
  { id: "financial_pnl", label: "Management P&L Statement", desc: "Top-line revenue, COGS, gross margin, and operating results" },
  { id: "product_profitability", label: "Product Profitability & Unit Economics", desc: "Item-level GMS, coupon allocation, immutable COGS & contribution profit" },
  { id: "category_profitability", label: "Category & Gender Profitability", desc: "Aggregated margins and performance by footwear category & gender" },
  { id: "channel_profitability", label: "Channel & Gateway Profitability", desc: "Economics by sales channel and payment methods (Razorpay, COD)" },
  { id: "order_profitability", label: "Order Unit Economics Ledger", desc: "Individual order revenue flow, refunds, fees, and contribution profit" },
  { id: "expenses", label: "Operational Expense Ledger", desc: "Itemized expense vouchers, vendor GSTIN, and ITC claims" },
  { id: "tax_liability", label: "Tax & GST Liability Summary", desc: "Sales tax output vs expense input tax credit breakdown" },
  { id: "settlement_reconciliation", label: "Payment Gateway Reconciliation", desc: "Razorpay gross settlements, fee deductions, and net deposits" },
  { id: "logistics_reconciliation", label: "Courier Freight Reconciliation", desc: "Delhivery billed freight vs customer shipping collected" },
  { id: "sales_deep", label: "Sales & Revenue Deep-Dive", desc: "Multi-dimensional breakdown of merchandise sales and discounts" },
  { id: "custom", label: "Custom Multi-Dimension Report", desc: "Flexible ad-hoc report combining custom dimensions and metrics" }
]

const ALL_DIMENSIONS = [
  { id: "product", label: "Product Name" },
  { id: "sku", label: "SKU Code" },
  { id: "category", label: "Category" },
  { id: "gender", label: "Gender" },
  { id: "channel", label: "Sales Channel" },
  { id: "paymentMethod", label: "Payment Method" },
  { id: "orderNumber", label: "Order Number" },
  { id: "date", label: "Date" },
  { id: "month", label: "Month" }
]

const ALL_METRICS = [
  { id: "grossMerchandiseSales", label: "Gross Merchandise Sales (GMS)" },
  { id: "productDiscounts", label: "Product Markdowns" },
  { id: "couponDiscounts", label: "Coupon Discounts" },
  { id: "netMerchandiseSales", label: "Net Merchandise Sales" },
  { id: "shippingRevenue", label: "Shipping Revenue" },
  { id: "refunds", label: "Actual Refunds" },
  { id: "netRevenue", label: "Net Revenue" },
  { id: "knownCogs", label: "Known Purchase COGS" },
  { id: "estimatedCogs", label: "Estimated COGS" },
  { id: "totalCogs", label: "Total COGS" },
  { id: "cogsCoveragePercent", label: "COGS Coverage %" },
  { id: "grossProfit", label: "Gross Profit" },
  { id: "grossMarginPercent", label: "Gross Margin %" },
  { id: "gatewayFee", label: "Gateway Fee" },
  { id: "freightCost", label: "Logistics Freight Cost" },
  { id: "contributionProfit", label: "Contribution Profit" },
  { id: "contributionMarginPercent", label: "Contribution Margin %" },
  { id: "taxCollected", label: "Tax Collected" },
  { id: "unitsSold", label: "Units Sold" },
  { id: "orderCount", label: "Order Count" }
]

const PROVENANCE_BADGES = {
  ACTUAL: { bg: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20", label: "ACTUAL" },
  ESTIMATED: { bg: "bg-blue-400/10 text-blue-400 border-blue-400/20", label: "ESTIMATED" },
  DERIVED: { bg: "bg-purple-400/10 text-purple-400 border-purple-400/20", label: "DERIVED" },
  UNRECONCILED: { bg: "bg-amber-400/10 text-amber-400 border-amber-400/20", label: "UNRECONCILED" },
  UNKNOWN: { bg: "bg-rose-400/10 text-rose-400 border-rose-400/20", label: "UNKNOWN" },
  NOT_APPLICABLE: { bg: "bg-white/10 text-white/60 border-white/20", label: "N/A" }
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

export default function ReportBuilder({ initialTemplate = null, onOpenSavedReports = null }) {
  const [reportType, setReportType] = useState(initialTemplate?.reportType || "product_profitability")
  const [dateRangePreset, setDateRangePreset] = useState("30d")
  const [startDate, setStartDate] = useState(
    initialTemplate?.filters?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  )
  const [endDate, setEndDate] = useState(
    initialTemplate?.filters?.endDate || new Date().toISOString().split("T")[0]
  )

  const [selectedDimensions, setSelectedDimensions] = useState(initialTemplate?.dimensions || ["product", "category"])
  const [selectedMetrics, setSelectedMetrics] = useState(
    initialTemplate?.metrics || ["grossMerchandiseSales", "netRevenue", "totalCogs", "grossProfit", "contributionProfit"]
  )

  // Filters
  const [filterCategory, setFilterCategory] = useState(initialTemplate?.filters?.category || "")
  const [filterPaymentMethod, setFilterPaymentMethod] = useState(initialTemplate?.filters?.paymentMethod || "")
  const [filterStatus, setFilterStatus] = useState(initialTemplate?.filters?.status || "")
  const [filterPaymentStatus, setFilterPaymentStatus] = useState(initialTemplate?.filters?.paymentStatus || "")
  const [filterItc, setFilterItc] = useState(initialTemplate?.filters?.itcEligibility || "")
  const [filterSearch, setFilterSearch] = useState(initialTemplate?.filters?.search || "")

  // Sorting and Pagination
  const [sortBy, setSortBy] = useState(initialTemplate?.sortBy || "grossMerchandiseSales")
  const [sortDir, setSortDir] = useState(initialTemplate?.sortDir || "desc")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)

  // Execution State
  const [executing, setExecuting] = useState(false)
  const [exportingXlsx, setExportingXlsx] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [reportResult, setReportResult] = useState(null)
  const [executionError, setExecutionError] = useState(null)

  // Save Template Modal State
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templateDesc, setTemplateDesc] = useState("")
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Preset Date Handlers
  const applyDatePreset = (preset) => {
    setDateRangePreset(preset)
    const now = new Date()
    let start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    if (preset === "7d") {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    } else if (preset === "30d") {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    } else if (preset === "90d") {
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    } else if (preset === "year") {
      start = new Date(now.getFullYear(), 0, 1)
    }

    if (preset !== "custom") {
      setStartDate(start.toISOString().split("T")[0])
      setEndDate(now.toISOString().split("T")[0])
    }
  }

  const toggleDimension = (dim) => {
    if (selectedDimensions.includes(dim)) {
      setSelectedDimensions(selectedDimensions.filter(d => d !== dim))
    } else {
      setSelectedDimensions([...selectedDimensions, dim])
    }
  }

  const toggleMetric = (metric) => {
    if (selectedMetrics.includes(metric)) {
      setSelectedMetrics(selectedMetrics.filter(m => m !== metric))
    } else {
      setSelectedMetrics([...selectedMetrics, metric])
    }
  }

  // Build Payload
  const buildReportPayload = () => {
    const filters = {}
    if (startDate) filters.startDate = startDate
    if (endDate) filters.endDate = endDate
    if (filterCategory) filters.category = filterCategory
    if (filterPaymentMethod) filters.paymentMethod = filterPaymentMethod
    if (filterStatus) filters.status = filterStatus
    if (filterPaymentStatus) filters.paymentStatus = filterPaymentStatus
    if (filterItc) filters.itcEligibility = filterItc
    if (filterSearch) filters.search = filterSearch

    return {
      reportType,
      dimensions: selectedDimensions,
      metrics: selectedMetrics,
      selectedColumns: selectedMetrics,
      filters,
      sortBy,
      sortDir,
      page,
      limit
    }
  }

  // Execute Report
  const handleRunReport = async () => {
    if (executing) return
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      toast.error("Start date cannot be after end date")
      return
    }

    setExecuting(true)
    setExecutionError(null)

    try {
      const payload = buildReportPayload()
      const res = await financeAPI.executeReport(payload)
      if (res.data?.success) {
        setReportResult(res.data)
        toast.success(`Report executed: ${res.data.results?.length || 0} records returned`)
      } else {
        setExecutionError("Server returned an unsuccessful response")
      }
    } catch (err) {
      console.error("Report execution failed:", err)
      const msg = err.response?.data?.message || err.message || "Failed to execute report"
      setExecutionError(msg)
      toast.error(msg)
    } finally {
      setExecuting(false)
    }
  }

  // Export Handlers with Authenticated Download
  const handleExportXlsx = async () => {
    if (exportingXlsx || executing) return
    setExportingXlsx(true)
    try {
      const payload = buildReportPayload()
      const res = await financeAPI.exportReportXlsx(payload)
      if (res.data?.success && res.data?.exportId) {
        toast.success("Excel generated! Initiating download...")
        await triggerAuthenticatedDownload(res.data.exportId, res.data.fileName || "LYVO_Report.xlsx")
      } else {
        toast.error("Failed to generate Excel file")
      }
    } catch (err) {
      console.error("XLSX export failed:", err)
      toast.error(err.response?.data?.message || "Excel generation failed")
    } finally {
      setExportingXlsx(false)
    }
  }

  const handleExportPdf = async () => {
    if (exportingPdf || executing) return
    setExportingPdf(true)
    try {
      const payload = buildReportPayload()
      const res = await financeAPI.exportReportPdf(payload)
      if (res.data?.success && res.data?.exportId) {
        toast.success("PDF generated! Initiating download...")
        await triggerAuthenticatedDownload(res.data.exportId, res.data.fileName || "LYVO_Report.pdf")
      } else {
        toast.error("Failed to generate PDF file")
      }
    } catch (err) {
      console.error("PDF export failed:", err)
      toast.error(err.response?.data?.message || "PDF generation failed")
    } finally {
      setExportingPdf(false)
    }
  }

  const triggerAuthenticatedDownload = async (exportId, fallbackFileName) => {
    try {
      const response = await financeAPI.downloadExport(exportId)
      const blob = new Blob([response.data], {
        type: response.headers["content-type"] || "application/octet-stream"
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fallbackFileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Download failed:", err)
      toast.error("Authenticated download failed")
    }
  }

  // Save Template
  const handleSaveTemplate = async (e) => {
    e.preventDefault()
    if (!templateName.trim()) {
      toast.error("Template name is required")
      return
    }

    setSavingTemplate(true)
    try {
      const payload = {
        name: templateName.trim(),
        description: templateDesc.trim(),
        reportType,
        filters: buildReportPayload().filters,
        selectedColumns: selectedMetrics,
        sortBy,
        sortDir
      }
      const res = await financeAPI.createSavedReport(payload)
      if (res.data?.success) {
        toast.success("Report template saved successfully!")
        setShowSaveModal(false)
        setTemplateName("")
        setTemplateDesc("")
      }
    } catch (err) {
      console.error("Failed to save template:", err)
      toast.error(err.response?.data?.message || "Failed to save template")
    } finally {
      setSavingTemplate(false)
    }
  }

  const results = reportResult?.results || []
  const metadata = reportResult?.reportMetadata || {}
  const disclosures = reportResult?.disclosures || []
  const summary = reportResult?.summary || {}

  return (
    <div className="space-y-6">
      {/* Builder Configuration Card */}
      <div className="card p-5 sm:p-6 space-y-6 border-acid/20">
        {/* Header with Title & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FiSliders className="text-acid text-xl" />
              <h2 className="text-lg font-semibold text-white">Interactive Report Builder</h2>
            </div>
            <p className="text-xs text-white/40 mt-0.5">
              Configure parameters, select dimensions & metrics, execute authoritative queries, and export audit files
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenSavedReports && (
              <button
                type="button"
                onClick={onOpenSavedReports}
                className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5"
              >
                <FiList size={14} /> Saved Templates
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSaveModal(true)}
              className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 text-acid border-acid/30 hover:bg-acid/10"
            >
              <FiBookmark size={14} /> Save Configuration
            </button>
          </div>
        </div>

        {/* 1. Report Type Selection */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-white/70">
            Report Type <span className="text-acid">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {REPORT_TYPES.map(rt => {
              const isSelected = reportType === rt.id
              return (
                <button
                  key={rt.id}
                  type="button"
                  onClick={() => setReportType(rt.id)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-acid/15 border-acid text-white shadow-lg shadow-acid/5"
                      : "bg-dark-700/50 border-white/5 text-white/60 hover:text-white hover:bg-dark-700 hover:border-white/10"
                  }`}
                >
                  <p className={`text-xs font-semibold ${isSelected ? "text-acid" : "text-white"}`}>
                    {rt.label}
                  </p>
                  <p className="text-[11px] text-white/40 mt-1 line-clamp-2 leading-relaxed">
                    {rt.desc}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* 2. Date Range & Presets */}
        <div className="border-t border-white/5 pt-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-xs font-medium text-white/70 flex items-center gap-1.5">
              <FiCalendar className="text-acid" /> Audit Date Period
            </label>
            <div className="flex bg-dark-700 p-1 rounded-xl border border-white/10 text-xs">
              {[
                { id: "7d", label: "7D" },
                { id: "30d", label: "30D" },
                { id: "90d", label: "90D" },
                { id: "year", label: "This Year" },
                { id: "custom", label: "Custom" }
              ].map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyDatePreset(preset.id)}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    dateRangePreset === preset.id
                      ? "bg-acid text-dark-900 font-semibold shadow"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-white/40 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setDateRangePreset("custom")
                  setStartDate(e.target.value)
                }}
                className="input w-full bg-dark-700 border-white/10 text-xs py-2"
              />
            </div>
            <div>
              <label className="block text-[11px] text-white/40 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setDateRangePreset("custom")
                  setEndDate(e.target.value)
                }}
                className="input w-full bg-dark-700 border-white/10 text-xs py-2"
              />
            </div>
          </div>
        </div>

        {/* 3. Dimensions & Metrics Tag Selection */}
        {["product_profitability", "category_profitability", "channel_profitability", "sales_deep", "custom"].includes(reportType) && (
          <div className="border-t border-white/5 pt-4 space-y-4">
            {/* Dimensions */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-white/70">
                Grouping Dimensions
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_DIMENSIONS.map(dim => {
                  const active = selectedDimensions.includes(dim.id)
                  return (
                    <button
                      key={dim.id}
                      type="button"
                      onClick={() => toggleDimension(dim.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                        active
                          ? "bg-acid/20 border-acid text-acid font-semibold"
                          : "bg-dark-700/40 border-white/5 text-white/50 hover:text-white hover:bg-dark-700"
                      }`}
                    >
                      {active && <FiCheck size={12} />}
                      {dim.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Metrics */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-white/70">
                Selected Financial & Quantitative Metrics
              </label>
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                {ALL_METRICS.map(m => {
                  const active = selectedMetrics.includes(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMetric(m.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                        active
                          ? "bg-purple-500/20 border-purple-400 text-purple-300 font-semibold"
                          : "bg-dark-700/40 border-white/5 text-white/50 hover:text-white hover:bg-dark-700"
                      }`}
                    >
                      {active && <FiCheck size={12} />}
                      {m.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* 4. Filter Parameters */}
        <div className="border-t border-white/5 pt-4 space-y-3">
          <label className="block text-xs font-medium text-white/70 flex items-center gap-1.5">
            <FiFilter className="text-acid" /> Specific Scope Filters
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-white/40 mb-1">Category</label>
              <input
                type="text"
                placeholder="e.g. Oxford, Boots, Loafers"
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="input w-full bg-dark-700 border-white/10 text-xs py-2"
              />
            </div>
            <div>
              <label className="block text-[11px] text-white/40 mb-1">Payment Method</label>
              <select
                value={filterPaymentMethod}
                onChange={e => setFilterPaymentMethod(e.target.value)}
                className="input w-full bg-dark-700 border-white/10 text-xs py-2"
              >
                <option value="">All Payment Methods</option>
                <option value="razorpay">Razorpay / Online UPI / Card</option>
                <option value="cod">Cash on Delivery (COD)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-white/40 mb-1">Search Keyword / Order #</label>
              <input
                type="text"
                placeholder="Search products or orders..."
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                className="input w-full bg-dark-700 border-white/10 text-xs py-2"
              />
            </div>
          </div>
        </div>

        {/* Execution Action Footer */}
        <div className="border-t border-white/5 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-white/40">
            <span>Row Limit:</span>
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="bg-dark-700 border border-white/10 rounded-lg px-2 py-1 text-white text-xs"
            >
              <option value="25">25 rows</option>
              <option value="50">50 rows</option>
              <option value="100">100 rows</option>
              <option value="250">250 rows</option>
              <option value="500">500 rows</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRunReport}
              disabled={executing}
              className="btn-primary py-2.5 px-5 text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              {executing ? (
                <>
                  <FiRefreshCw className="animate-spin" /> Executing Engine...
                </>
              ) : (
                <>
                  <FiPlay /> Run Authoritative Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Execution Error Banner */}
      {executionError && (
        <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl flex items-start gap-3 text-xs text-rose-200">
          <FiAlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={16} />
          <div>
            <p className="font-semibold text-rose-300">Report Execution Failed</p>
            <p className="mt-0.5">{executionError}</p>
          </div>
        </div>
      )}

      {/* Report Results Section */}
      {reportResult && (
        <div className="card p-5 sm:p-6 space-y-6">
          {/* Results Header with Metadata & Export Buttons */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-base font-semibold text-white">
                  {metadata.name || `${reportType.replace(/_/g, " ").toUpperCase()} Statement`}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-acid/10 text-acid border border-acid/20 uppercase font-semibold">
                  {metadata.reportType}
                </span>
                <span className="text-xs text-white/40">
                  {metadata.dateRange?.start} to {metadata.dateRange?.end}
                </span>
              </div>
              <p className="text-xs text-white/40 mt-1">
                Generated at: {new Date(metadata.generatedAt).toLocaleString()} • {metadata.rowCount || results.length} records returned
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleExportXlsx}
                disabled={exportingXlsx || executing}
                className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 text-emerald-400 border-emerald-400/30 hover:bg-emerald-400/10 disabled:opacity-50"
              >
                {exportingXlsx ? <FiRefreshCw className="animate-spin" /> : <FiDownload />}
                Export XLSX
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf || executing}
                className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 text-rose-400 border-rose-400/30 hover:bg-rose-400/10 disabled:opacity-50"
              >
                {exportingPdf ? <FiRefreshCw className="animate-spin" /> : <FiDownload />}
                Export PDF
              </button>
            </div>
          </div>

          {/* Disclosures Section */}
          {disclosures.length > 0 && (
            <div className="bg-dark-800/80 border border-white/10 p-3.5 rounded-xl text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-white/80 font-semibold">
                <FiInfo className="text-acid" /> Authoritative Accounting Disclosures
              </div>
              <ul className="list-disc list-inside text-white/50 text-[11px] space-y-0.5">
                {disclosures.map((disc, idx) => (
                  <li key={idx}>{disc}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Dynamic Summary Cards (if summary values exist) */}
          {summary && Object.keys(summary).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {summary.netRevenue !== undefined && (
                <div className="p-3 bg-dark-700/40 border border-white/5 rounded-xl">
                  <p className="text-[11px] text-white/40">Net Revenue</p>
                  <p className="text-lg font-bold text-acid font-display mt-0.5">
                    ₹{Number(summary.netRevenue || 0).toLocaleString()}
                  </p>
                </div>
              )}
              {summary.totalCogs !== undefined && (
                <div className="p-3 bg-dark-700/40 border border-white/5 rounded-xl">
                  <p className="text-[11px] text-white/40">Total COGS</p>
                  <p className="text-lg font-bold text-white font-display mt-0.5">
                    ₹{Number(summary.totalCogs || 0).toLocaleString()}
                  </p>
                </div>
              )}
              {summary.grossProfit !== undefined && (
                <div className="p-3 bg-dark-700/40 border border-white/5 rounded-xl">
                  <p className="text-[11px] text-white/40">Gross Profit</p>
                  <p className={`text-lg font-bold font-display mt-0.5 ${summary.grossProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    ₹{Number(summary.grossProfit || 0).toLocaleString()}
                  </p>
                </div>
              )}
              {summary.operatingProfit !== undefined && (
                <div className="p-3 bg-dark-700/40 border border-white/5 rounded-xl">
                  <p className="text-[11px] text-white/40">Operating Result</p>
                  <p className={`text-lg font-bold font-display mt-0.5 ${summary.operatingProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    ₹{Number(summary.operatingProfit || 0).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Results Table */}
          {results.length === 0 ? (
            <div className="text-center py-12 text-white/40 text-xs border border-dashed border-white/10 rounded-2xl">
              No matching analytical records found for the selected parameters.
            </div>
          ) : (
            <div className="overflow-x-auto border border-white/5 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-dark-700/60 text-white/60 uppercase tracking-wider text-[10px] border-b border-white/5">
                  <tr>
                    {/* Identifier columns */}
                    {results[0].orderNumber && <th className="py-3 px-3">Order #</th>}
                    {results[0].sku && <th className="py-3 px-3">SKU</th>}
                    {results[0].name && <th className="py-3 px-3">Product Name</th>}
                    {results[0].category && <th className="py-3 px-3">Category</th>}
                    {results[0].gender && <th className="py-3 px-3">Gender</th>}
                    {results[0].channel && <th className="py-3 px-3">Channel</th>}
                    {results[0].paymentMethod && <th className="py-3 px-3">Method</th>}
                    {results[0].date && <th className="py-3 px-3">Date</th>}
                    {results[0].status && <th className="py-3 px-3">Status</th>}

                    {/* Financial Metrics */}
                    {results[0].grossMerchandiseSales !== undefined && <th className="py-3 px-3 text-right">GMS</th>}
                    {results[0].couponDiscounts !== undefined && <th className="py-3 px-3 text-right">Coupons</th>}
                    {results[0].netMerchandiseSales !== undefined && <th className="py-3 px-3 text-right">Net Merch</th>}
                    {results[0].shippingRevenue !== undefined && <th className="py-3 px-3 text-right">Shipping</th>}
                    {results[0].refunds !== undefined && <th className="py-3 px-3 text-right">Refunds</th>}
                    {results[0].netRevenue !== undefined && <th className="py-3 px-3 text-right text-acid font-bold">Net Revenue</th>}
                    {results[0].totalCogs !== undefined && <th className="py-3 px-3 text-right">Total COGS</th>}
                    {results[0].grossProfit !== undefined && <th className="py-3 px-3 text-right">Gross Profit</th>}
                    {results[0].gatewayFee !== undefined && <th className="py-3 px-3 text-right">GW Fee</th>}
                    {results[0].freightCost !== undefined && <th className="py-3 px-3 text-right">Freight</th>}
                    {results[0].contributionProfit !== undefined && <th className="py-3 px-3 text-right text-emerald-400 font-bold">Contribution</th>}
                    <th className="py-3 px-3 text-center">Provenance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-sans">
                  {results.map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition">
                      {row.orderNumber && <td className="py-2.5 px-3 font-mono font-medium text-white">{row.orderNumber}</td>}
                      {row.sku && <td className="py-2.5 px-3 font-mono text-white/70">{row.sku}</td>}
                      {row.name && <td className="py-2.5 px-3 font-medium text-white max-w-xs truncate">{row.name}</td>}
                      {row.category && <td className="py-2.5 px-3 text-white/70 capitalize">{row.category}</td>}
                      {row.gender && <td className="py-2.5 px-3 text-white/70 capitalize">{row.gender}</td>}
                      {row.channel && <td className="py-2.5 px-3 text-white/70">{row.channelLabel || row.channel}</td>}
                      {row.paymentMethod && <td className="py-2.5 px-3 text-white/70 uppercase">{row.paymentMethod}</td>}
                      {row.date && <td className="py-2.5 px-3 text-white/60">{new Date(row.date).toLocaleDateString()}</td>}
                      {row.status && <td className="py-2.5 px-3 capitalize text-white/70">{row.status}</td>}

                      {row.grossMerchandiseSales !== undefined && (
                        <td className="py-2.5 px-3 text-right">₹{Number(row.grossMerchandiseSales).toLocaleString()}</td>
                      )}
                      {row.couponDiscounts !== undefined && (
                        <td className="py-2.5 px-3 text-right text-rose-400">
                          {row.couponDiscounts > 0 ? `-₹${Number(row.couponDiscounts).toLocaleString()}` : "₹0"}
                        </td>
                      )}
                      {row.netMerchandiseSales !== undefined && (
                        <td className="py-2.5 px-3 text-right text-white/90">₹{Number(row.netMerchandiseSales).toLocaleString()}</td>
                      )}
                      {row.shippingRevenue !== undefined && (
                        <td className="py-2.5 px-3 text-right text-blue-400">₹{Number(row.shippingRevenue).toLocaleString()}</td>
                      )}
                      {row.refunds !== undefined && (
                        <td className="py-2.5 px-3 text-right text-rose-400">
                          {row.refunds > 0 ? `-₹${Number(row.refunds).toLocaleString()}` : "₹0"}
                        </td>
                      )}
                      {row.netRevenue !== undefined && (
                        <td className="py-2.5 px-3 text-right font-bold text-acid">
                          ₹{Number(row.netRevenue).toLocaleString()}
                        </td>
                      )}
                      {row.totalCogs !== undefined && (
                        <td className="py-2.5 px-3 text-right">
                          {row.totalCogs !== null ? `₹${Number(row.totalCogs).toLocaleString()}` : <span className="text-rose-400">Incomplete</span>}
                        </td>
                      )}
                      {row.grossProfit !== undefined && (
                        <td className="py-2.5 px-3 text-right">
                          {row.grossProfit !== null ? (
                            <span className={row.grossProfit >= 0 ? "text-emerald-400" : "text-rose-400"}>
                              ₹{Number(row.grossProfit).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>
                      )}
                      {row.gatewayFee !== undefined && (
                        <td className="py-2.5 px-3 text-right text-rose-400">
                          {row.gatewayFee !== null ? `₹${Number(row.gatewayFee).toLocaleString()}` : <span className="text-white/30">—</span>}
                        </td>
                      )}
                      {row.freightCost !== undefined && (
                        <td className="py-2.5 px-3 text-right text-rose-400">
                          {row.freightCost !== null ? `₹${Number(row.freightCost).toLocaleString()}` : <span className="text-white/30">—</span>}
                        </td>
                      )}
                      {row.contributionProfit !== undefined && (
                        <td className="py-2.5 px-3 text-right font-bold">
                          {row.contributionProfit !== null ? (
                            <span className={row.contributionProfit >= 0 ? "text-emerald-400" : "text-rose-400"}>
                              ₹{Number(row.contributionProfit).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-white/30">Unknown</span>
                          )}
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-center">
                        <ProvenanceTag type={row.provenance || "DERIVED"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Save Template Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <FiBookmark className="text-acid" />
                <h3 className="font-semibold text-white">Save Report Configuration</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="text-white/40 hover:text-white"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4 text-xs">
              <div>
                <label className="block text-white/70 mb-1">Template Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Monthly Footwear Unit Economics"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  className="input w-full bg-dark-700 border-white/10 py-2"
                />
              </div>

              <div>
                <label className="block text-white/70 mb-1">Description (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="Internal notes on report scope and target metrics..."
                  value={templateDesc}
                  onChange={e => setTemplateDesc(e.target.value)}
                  className="input w-full bg-dark-700 border-white/10 py-2"
                />
              </div>

              <div className="p-3 bg-dark-700/40 rounded-xl space-y-1 text-white/60">
                <p><strong>Report Type:</strong> {reportType}</p>
                <p><strong>Date Scope:</strong> {startDate} to {endDate}</p>
                <p><strong>Metrics Count:</strong> {selectedMetrics.length} selected</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="btn-secondary py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTemplate}
                  className="btn-primary py-2 px-4 flex items-center gap-1.5 disabled:opacity-50 font-semibold"
                >
                  {savingTemplate ? <FiRefreshCw className="animate-spin" /> : <FiCheck />}
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
