import { useState, useEffect, useMemo } from "react"
import {
  FiPercent, FiTrendingUp, FiActivity, FiLayers, FiShield,
  FiAlertTriangle, FiCheckCircle, FiInfo, FiFileText, FiMapPin,
  FiPieChart, FiArrowUpRight, FiArrowDownRight, FiHelpCircle,
  FiCalendar, FiRefreshCw, FiSearch, FiSliders, FiAlertCircle, FiXCircle
} from "react-icons/fi"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts"
import { taxAPI } from "../../api"
import Loading from "../../components/common/Loading"

// Provenance Badge Configurations
const PROVENANCE_BADGES = {
  ACTUAL: { bg: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20", label: "ACTUAL" },
  ESTIMATED: { bg: "bg-blue-400/10 text-blue-400 border-blue-400/20", label: "ESTIMATED" },
  DERIVED: { bg: "bg-purple-400/10 text-purple-400 border-purple-400/20", label: "DERIVED" },
  UNRECONCILED: { bg: "bg-amber-400/10 text-amber-400 border-amber-400/20", label: "UNRECONCILED" },
  UNKNOWN: { bg: "bg-rose-400/10 text-rose-400 border-rose-400/20", label: "UNKNOWN" },
  NOT_AVAILABLE: { bg: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20", label: "NOT AVAILABLE" }
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

function StatusBadge({ status }) {
  const s = (status || "UNKNOWN").toUpperCase()
  if (s === "RECONCILED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
        <FiCheckCircle size={12} /> RECONCILED
      </span>
    )
  }
  if (s === "MISMATCH") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20">
        <FiAlertTriangle size={12} /> MISMATCH
      </span>
    )
  }
  if (s === "NOT_AVAILABLE") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
        <FiHelpCircle size={12} /> NOT AVAILABLE
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-rose-400/10 text-rose-400 border border-rose-400/20">
      <FiXCircle size={12} /> {s}
    </span>
  )
}

const ANOMALY_LABELS = {
  ERR_MISSING_HSN: "Missing HSN",
  ERR_MISSING_TAXABLE_VAL: "Missing Taxable Value",
  ERR_TAX_SUM_MISMATCH: "Tax Sum Mismatch",
  ERR_NEGATIVE_TAX: "Negative Tax",
  ERR_INVALID_GEO_SPLIT: "Invalid Geo Split",
  ERR_MISSING_POS: "Missing Place of Supply",
  ERR_UNVERIFIED_RULE: "Unverified Tax Rule",
  ERR_EXPENSE_GST_MISMATCH: "Expense GST Mismatch",
  ERR_INVALID_ITC_AMOUNT: "Invalid ITC Amount",
  ERR_EXCESS_REFUND_TAX: "Excess Refund Tax",
  ERR_MISSING_EXPENSE_GST: "Missing Expense GST",
  ERR_INVALID_ITC_CLASSIFICATION: "Invalid ITC Classification"
}

const SEVERITY_BADGES = {
  CRITICAL: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  HIGH: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  MEDIUM: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  LOW: "bg-blue-500/15 text-blue-400 border-blue-500/30"
}

const CHART_COLORS = ["#10b981", "#60a5fa", "#a78bfa", "#f59e0b", "#f43f5e", "#22d3ee"]

const CustomChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-800/95 border border-white/10 backdrop-blur-md rounded-xl px-4 py-3 text-xs shadow-2xl min-w-[160px]">
      <p className="text-white/40 mb-2 font-mono text-[11px]">{label}</p>
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
              <span className="text-white/70">{p.name}:</span>
            </div>
            <span className="font-semibold text-white">
              {typeof p.value === "number" && (p.name.toLowerCase().includes("tax") || p.name.toLowerCase().includes("sales") || p.name.toLowerCase().includes("value") || p.name.toLowerCase().includes("amount") || p.name.toLowerCase().includes("cgst") || p.name.toLowerCase().includes("sgst") || p.name.toLowerCase().includes("igst"))
                ? `₹${Number(p.value).toLocaleString()}`
                : Number(p.value).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminTax() {
  const [activeTab, setActiveTab] = useState("overview")
  const [dateRangeOption, setDateRangeOption] = useState("30d")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")

  // Tab Data States
  const [overviewData, setOverviewData] = useState(null)
  const [loadingOverview, setLoadingOverview] = useState(true)
  const [errorOverview, setErrorOverview] = useState(null)

  const [hsnData, setHsnData] = useState(null)
  const [loadingHsn, setLoadingHsn] = useState(false)
  const [errorHsn, setErrorHsn] = useState(null)
  const [hsnSearch, setHsnSearch] = useState("")

  const [statesData, setStatesData] = useState(null)
  const [loadingStates, setLoadingStates] = useState(false)
  const [errorStates, setErrorStates] = useState(null)

  const [ratesData, setRatesData] = useState(null)
  const [loadingRates, setLoadingRates] = useState(false)
  const [errorRates, setErrorRates] = useState(null)

  const [inputTaxData, setInputTaxData] = useState(null)
  const [loadingInputTax, setLoadingInputTax] = useState(false)
  const [errorInputTax, setErrorInputTax] = useState(null)

  const [qualityData, setQualityData] = useState(null)
  const [loadingQuality, setLoadingQuality] = useState(false)
  const [errorQuality, setErrorQuality] = useState(null)
  const [severityFilter, setSeverityFilter] = useState("ALL")

  const [reconData, setReconData] = useState(null)
  const [loadingRecon, setLoadingRecon] = useState(false)
  const [errorRecon, setErrorRecon] = useState(null)

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

  // Fetch Overview
  const fetchOverview = () => {
    setLoadingOverview(true)
    setErrorOverview(null)
    const params = getDateParams()
    taxAPI.getOverview(params)
      .then(res => setOverviewData(res.data?.data || null))
      .catch(err => {
        console.error("Error fetching tax overview:", err)
        setErrorOverview(err.response?.status === 401 || err.response?.status === 403 ? "Unauthorized to view Tax Analytics" : "Unable to load tax overview.")
      })
      .finally(() => setLoadingOverview(false))
  }

  // Fetch HSN
  const fetchHsn = () => {
    setLoadingHsn(true)
    setErrorHsn(null)
    const params = getDateParams()
    taxAPI.getHsn(params)
      .then(res => setHsnData(res.data?.data || null))
      .catch(err => {
        console.error("Error fetching HSN analytics:", err)
        setErrorHsn("Unable to load HSN analysis.")
      })
      .finally(() => setLoadingHsn(false))
  }

  // Fetch States
  const fetchStates = () => {
    setLoadingStates(true)
    setErrorStates(null)
    const params = getDateParams()
    taxAPI.getStates(params)
      .then(res => setStatesData(res.data?.data || null))
      .catch(err => {
        console.error("Error fetching state analytics:", err)
        setErrorStates("Unable to load State/POS analytics.")
      })
      .finally(() => setLoadingStates(false))
  }

  // Fetch Rates
  const fetchRates = () => {
    setLoadingRates(true)
    setErrorRates(null)
    const params = getDateParams()
    taxAPI.getRates(params)
      .then(res => setRatesData(res.data?.data || null))
      .catch(err => {
        console.error("Error fetching rate analytics:", err)
        setErrorRates("Unable to load Tax Rate analysis.")
      })
      .finally(() => setLoadingRates(false))
  }

  // Fetch Input Tax
  const fetchInputTax = () => {
    setLoadingInputTax(true)
    setErrorInputTax(null)
    const params = getDateParams()
    taxAPI.getInputTax(params)
      .then(res => setInputTaxData(res.data?.data || null))
      .catch(err => {
        console.error("Error fetching input tax analytics:", err)
        setErrorInputTax("Unable to load Input GST / ITC analytics.")
      })
      .finally(() => setLoadingInputTax(false))
  }

  // Fetch Data Quality
  const fetchQuality = () => {
    setLoadingQuality(true)
    setErrorQuality(null)
    const params = getDateParams()
    taxAPI.getDataQuality(params)
      .then(res => setQualityData(res.data?.data || null))
      .catch(err => {
        console.error("Error fetching tax data quality:", err)
        setErrorQuality("Unable to load Tax Data Quality.")
      })
      .finally(() => setLoadingQuality(false))
  }

  // Fetch Reconciliation
  const fetchReconciliation = () => {
    setLoadingRecon(true)
    setErrorRecon(null)
    const params = getDateParams()
    taxAPI.getReconciliation(params)
      .then(res => setReconData(res.data?.data || null))
      .catch(err => {
        console.error("Error fetching tax reconciliation:", err)
        setErrorRecon("Unable to load Tax Reconciliation.")
      })
      .finally(() => setLoadingRecon(false))
  }

  useEffect(() => {
    if (activeTab === "overview") fetchOverview()
    else if (activeTab === "hsn") fetchHsn()
    else if (activeTab === "states") fetchStates()
    else if (activeTab === "rates") fetchRates()
    else if (activeTab === "input-tax") fetchInputTax()
    else if (activeTab === "data-quality") fetchQuality()
    else if (activeTab === "reconciliation") fetchReconciliation()
  }, [activeTab, dateRangeOption, customStart, customEnd])

  // Filtered HSN Items
  const filteredHsnItems = useMemo(() => {
    if (!hsnData?.items) return []
    if (!hsnSearch.trim()) return hsnData.items
    const q = hsnSearch.toLowerCase().trim()
    return hsnData.items.filter(item => item.hsn?.toLowerCase().includes(q))
  }, [hsnData, hsnSearch])

  // Filtered Anomalies
  const filteredAnomalies = useMemo(() => {
    if (!qualityData?.anomalies) return []
    if (severityFilter === "ALL") return qualityData.anomalies
    return qualityData.anomalies.filter(a => a.severity === severityFilter)
  }, [qualityData, severityFilter])

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-3xl tracking-wider">Tax & GST Analytics</h1>
            <span className="bg-acid/10 text-acid border border-acid/20 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full">
              Phase 3C Managerial
            </span>
          </div>
          <p className="text-white/40 text-sm mt-0.5">
            Output tax attribution, HSN & POS distributions, management ITC tracking, and data quality audits
          </p>
        </div>

        {/* Global Date Range Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-dark-700 p-1 rounded-xl border border-white/10 text-xs">
            {[
              { id: "7d", label: "7D" },
              { id: "30d", label: "30D" },
              { id: "90d", label: "90D" },
              { id: "year", label: "This Year" },
              { id: "custom", label: "Custom" }
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setDateRangeOption(opt.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  dateRangeOption === opt.id
                    ? "bg-acid text-dark-900 font-semibold shadow-sm"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {dateRangeOption === "custom" && (
            <div className="flex items-center gap-1.5 bg-dark-700 px-3 py-1 rounded-xl border border-white/10 text-xs">
              <FiCalendar className="text-white/40" />
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="bg-transparent border-none text-white text-xs focus:ring-0 p-0"
              />
              <span className="text-white/30">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="bg-transparent border-none text-white text-xs focus:ring-0 p-0"
              />
            </div>
          )}
        </div>
      </div>

      {/* Managerial & Legacy Data Disclosure Notice */}
      <div className="bg-dark-800 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-white/60">
        <div className="flex items-start gap-2.5">
          <FiInfo className="text-acid mt-0.5 shrink-0" size={16} />
          <div>
            <span className="text-white font-medium">Managerial Tax Reporting Notice: </span>
            <span>
              This module provides managerial tax analytics and data quality auditing based on recorded order and expense snapshots.
              It is not a statutory GST filing determination. Historical orders with incomplete HSN, POS, or rate data are marked as
              UNKNOWN/UNCLASSIFIED and are not retroactively modified.
            </span>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 font-mono text-[11px] text-white/50">
          <FiShield size={12} className="text-acid" /> Immutable Snapshots
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-white/5 overflow-x-auto gap-1">
        {[
          { id: "overview", label: "Tax Overview", icon: FiPieChart },
          { id: "hsn", label: "HSN Analysis", icon: FiLayers },
          { id: "states", label: "State / POS", icon: FiMapPin },
          { id: "rates", label: "Tax Rates", icon: FiPercent },
          { id: "input-tax", label: "Input GST / ITC", icon: FiArrowDownRight },
          { id: "data-quality", label: "Data Quality", icon: FiAlertTriangle },
          { id: "reconciliation", label: "Reconciliation", icon: FiActivity }
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? "border-acid text-acid bg-acid/5"
                  : "border-transparent text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* TAB CONTENT */}

      {/* 1. TAX OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {loadingOverview ? (
            <div className="py-20 flex justify-center"><Loading /></div>
          ) : errorOverview ? (
            <div className="bg-dark-800 border border-fire/20 rounded-2xl p-8 text-center space-y-4">
              <FiAlertCircle className="mx-auto text-fire" size={36} />
              <p className="text-white/70 text-sm">{errorOverview}</p>
              <button
                onClick={fetchOverview}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
              >
                <FiRefreshCw size={14} /> Retry
              </button>
            </div>
          ) : !overviewData ? (
            <div className="bg-dark-800 border border-white/5 rounded-2xl p-12 text-center text-white/40 text-sm">
              No tax records available for the selected period.
            </div>
          ) : (
            <>
              {/* Top KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Gross Sales */}
                <div className="bg-dark-800 border border-white/5 rounded-2xl p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white/50">Gross Sales</span>
                    <ProvenanceTag type="ACTUAL" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-white">
                    ₹{Number(overviewData.summary?.grossSales || 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-white/40">
                    Paid orders ({overviewData.summary?.paidOrderCount || 0}) in selected range
                  </div>
                </div>

                {/* Taxable Sales */}
                <div className="bg-dark-800 border border-white/5 rounded-2xl p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white/50">Taxable Sales</span>
                    <ProvenanceTag type="ACTUAL" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-white">
                    ₹{Number(overviewData.summary?.taxableSales || 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-white/40">
                    Net taxable base excluding tax
                  </div>
                </div>

                {/* Total Output Tax */}
                <div className="bg-dark-800 border border-white/5 rounded-2xl p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white/50">Total Output Tax</span>
                    <ProvenanceTag type={overviewData.provenance?.outputTaxProvenance || "ACTUAL"} />
                  </div>
                  <div className="text-2xl font-bold font-mono text-amber-400">
                    ₹{Number(overviewData.summary?.totalOutputTax || 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-amber-400/60 font-medium">
                    Tax liability collected on orders
                  </div>
                </div>

                {/* Net Output Tax */}
                <div className="bg-dark-800 border border-white/5 rounded-2xl p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white/50">Net Output Tax</span>
                    <ProvenanceTag type={overviewData.provenance?.netOutputTaxProvenance || "DERIVED"} />
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-400">
                    ₹{Number(overviewData.summary?.netOutputTax || 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-white/40">
                    Output tax less ₹{Number(overviewData.summary?.refundedOutputTax || 0).toLocaleString()} refunded
                  </div>
                </div>
              </div>

              {/* Component Tax Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-dark-800/80 border border-white/5 rounded-xl p-4">
                  <span className="text-xs text-white/40 font-mono">CGST (Central)</span>
                  <div className="text-lg font-bold font-mono text-white mt-1">
                    ₹{Number(overviewData.summary?.cgst || 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-dark-800/80 border border-white/5 rounded-xl p-4">
                  <span className="text-xs text-white/40 font-mono">SGST (State)</span>
                  <div className="text-lg font-bold font-mono text-white mt-1">
                    ₹{Number(overviewData.summary?.sgst || 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-dark-800/80 border border-white/5 rounded-xl p-4">
                  <span className="text-xs text-white/40 font-mono">IGST (Interstate)</span>
                  <div className="text-lg font-bold font-mono text-white mt-1">
                    ₹{Number(overviewData.summary?.igst || 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-dark-800/80 border border-white/5 rounded-xl p-4">
                  <span className="text-xs text-white/40 font-mono">Cess / Other</span>
                  <div className="text-lg font-bold font-mono text-white mt-1">
                    ₹{Number(overviewData.summary?.cess || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Visualizations Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tax Component Breakdown */}
                <div className="bg-dark-800 border border-white/5 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Output Tax Components</h3>
                    <ProvenanceTag type="DERIVED" />
                  </div>
                  {overviewData.summary?.totalOutputTax > 0 ? (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { name: "CGST", amount: overviewData.summary?.cgst || 0, fill: "#10b981" },
                            { name: "SGST", amount: overviewData.summary?.sgst || 0, fill: "#60a5fa" },
                            { name: "IGST", amount: overviewData.summary?.igst || 0, fill: "#a78bfa" },
                            { name: "Cess", amount: overviewData.summary?.cess || 0, fill: "#f59e0b" }
                          ]}
                          margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                          <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickFormatter={v => `₹${v}`} />
                          <Tooltip content={<CustomChartTooltip />} />
                          <Bar dataKey="amount" name="Tax Amount" radius={[6, 6, 0, 0]}>
                            {[0, 1, 2, 3].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-white/30 text-xs">
                      No tax component data available for this range
                    </div>
                  )}
                </div>

                {/* Monthly Tax Trend */}
                <div className="bg-dark-800 border border-white/5 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Monthly Tax Trend</h3>
                    <ProvenanceTag type="DERIVED" />
                  </div>
                  {overviewData.monthlyTrend && overviewData.monthlyTrend.length > 0 ? (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={overviewData.monthlyTrend} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                          <defs>
                            <linearGradient id="taxGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                          <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickFormatter={v => `₹${v}`} />
                          <Tooltip content={<CustomChartTooltip />} />
                          <Area type="monotone" dataKey="totalOutputTax" name="Output Tax" stroke="#10b981" fillOpacity={1} fill="url(#taxGrad)" />
                          <Area type="monotone" dataKey="netOutputTax" name="Net Output Tax" stroke="#60a5fa" fillOpacity={0} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-white/30 text-xs">
                      No monthly trend data available for this range
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 2. HSN ANALYSIS TAB */}
      {activeTab === "hsn" && (
        <div className="space-y-6">
          {loadingHsn ? (
            <div className="py-20 flex justify-center"><Loading /></div>
          ) : errorHsn ? (
            <div className="bg-dark-800 border border-fire/20 rounded-2xl p-8 text-center space-y-4">
              <FiAlertCircle className="mx-auto text-fire" size={36} />
              <p className="text-white/70 text-sm">{errorHsn}</p>
              <button onClick={fetchHsn} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold">
                <FiRefreshCw size={14} /> Retry
              </button>
            </div>
          ) : !hsnData ? (
            <div className="bg-dark-800 border border-white/5 rounded-2xl p-12 text-center text-white/40 text-sm">
              No HSN data available for the selected period.
            </div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
                  <span className="text-xs text-white/40 font-mono">HSN Codes</span>
                  <div className="text-xl font-bold font-mono text-white mt-1">{hsnData.summary?.totalHsnCodes || 0}</div>
                </div>
                <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
                  <span className="text-xs text-white/40 font-mono">Total Taxable Value</span>
                  <div className="text-xl font-bold font-mono text-white mt-1">₹{Number(hsnData.summary?.totalTaxableValue || 0).toLocaleString()}</div>
                </div>
                <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
                  <span className="text-xs text-white/40 font-mono">Total Tax</span>
                  <div className="text-xl font-bold font-mono text-amber-400 mt-1">₹{Number(hsnData.summary?.totalTax || 0).toLocaleString()}</div>
                </div>
                <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
                  <span className="text-xs text-white/40 font-mono">Unclassified HSN Lines</span>
                  <div className="text-xl font-bold font-mono text-rose-400 mt-1">{hsnData.summary?.unclassifiedCount || 0}</div>
                </div>
              </div>

              {/* Search Bar */}
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                  <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={14} />
                  <input
                    type="text"
                    placeholder="Search by HSN code..."
                    value={hsnSearch}
                    onChange={e => setHsnSearch(e.target.value)}
                    className="w-full bg-dark-800 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-acid"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="bg-dark-800 border border-white/5 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02] text-white/50 font-mono">
                        <th className="p-3.5">HSN Code</th>
                        <th className="p-3.5">Products</th>
                        <th className="p-3.5 text-right">Units Sold</th>
                        <th className="p-3.5 text-right">Taxable Value</th>
                        <th className="p-3.5 text-right">CGST</th>
                        <th className="p-3.5 text-right">SGST</th>
                        <th className="p-3.5 text-right">IGST</th>
                        <th className="p-3.5 text-right">Total Tax</th>
                        <th className="p-3.5 text-right">Refunded Tax</th>
                        <th className="p-3.5 text-right">Net Tax</th>
                        <th className="p-3.5 text-center">Provenance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredHsnItems.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="p-8 text-center text-white/40">
                            No HSN records match the filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredHsnItems.map((item, idx) => {
                          const isUnclassified = item.hsn === "UNCLASSIFIED_HSN"
                          return (
                            <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-3.5 font-mono font-medium">
                                {isUnclassified ? (
                                  <span className="inline-flex items-center gap-1 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                    <FiAlertTriangle size={11} /> UNCLASSIFIED_HSN
                                  </span>
                                ) : (
                                  <span className="text-white">{item.hsn}</span>
                                )}
                              </td>
                              <td className="p-3.5 text-white/70">{item.productCount || 0}</td>
                              <td className="p-3.5 text-right font-mono text-white/70">{item.unitsSold || 0}</td>
                              <td className="p-3.5 text-right font-mono text-white">₹{Number(item.taxableValue || 0).toLocaleString()}</td>
                              <td className="p-3.5 text-right font-mono text-white/60">₹{Number(item.cgst || 0).toLocaleString()}</td>
                              <td className="p-3.5 text-right font-mono text-white/60">₹{Number(item.sgst || 0).toLocaleString()}</td>
                              <td className="p-3.5 text-right font-mono text-white/60">₹{Number(item.igst || 0).toLocaleString()}</td>
                              <td className="p-3.5 text-right font-mono font-semibold text-amber-400">₹{Number(item.totalTax || 0).toLocaleString()}</td>
                              <td className="p-3.5 text-right font-mono text-white/50">₹{Number(item.refundedTax || 0).toLocaleString()}</td>
                              <td className="p-3.5 text-right font-mono font-semibold text-emerald-400">₹{Number(item.netTax || 0).toLocaleString()}</td>
                              <td className="p-3.5 text-center">
                                <ProvenanceTag type={item.provenance} />
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. STATE / POS TAB */}
      {activeTab === "states" && (
        <div className="space-y-6">
          {loadingStates ? (
            <div className="py-20 flex justify-center"><Loading /></div>
          ) : errorStates ? (
            <div className="bg-dark-800 border border-fire/20 rounded-2xl p-8 text-center space-y-4">
              <FiAlertCircle className="mx-auto text-fire" size={36} />
              <p className="text-white/70 text-sm">{errorStates}</p>
              <button onClick={fetchStates} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold">
                <FiRefreshCw size={14} /> Retry
              </button>
            </div>
          ) : !statesData ? (
            <div className="bg-dark-800 border border-white/5 rounded-2xl p-12 text-center text-white/40 text-sm">
              No state distribution records available.
            </div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
                  <span className="text-xs text-white/40 font-mono">States / Territories</span>
                  <div className="text-xl font-bold font-mono text-white mt-1">{statesData.summary?.totalStates || 0}</div>
                </div>
                <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
                  <span className="text-xs text-white/40 font-mono">Intrastate Tax (CGST+SGST)</span>
                  <div className="text-xl font-bold font-mono text-emerald-400 mt-1">₹{Number(statesData.summary?.intraStateTax || 0).toLocaleString()}</div>
                </div>
                <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
                  <span className="text-xs text-white/40 font-mono">Interstate Tax (IGST)</span>
                  <div className="text-xl font-bold font-mono text-purple-400 mt-1">₹{Number(statesData.summary?.interStateTax || 0).toLocaleString()}</div>
                </div>
                <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
                  <span className="text-xs text-white/40 font-mono">Unknown State Orders</span>
                  <div className="text-xl font-bold font-mono text-rose-400 mt-1">{statesData.summary?.unknownStateOrders || 0}</div>
                </div>
              </div>

              {/* States Table */}
              <div className="bg-dark-800 border border-white/5 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02] text-white/50 font-mono">
                        <th className="p-3.5">State / Place of Supply</th>
                        <th className="p-3.5 text-right">Orders</th>
                        <th className="p-3.5 text-right">Taxable Sales</th>
                        <th className="p-3.5 text-right">CGST</th>
                        <th className="p-3.5 text-right">SGST</th>
                        <th className="p-3.5 text-right">IGST</th>
                        <th className="p-3.5 text-right">Total Tax</th>
                        <th className="p-3.5 text-right">Refunded Tax</th>
                        <th className="p-3.5 text-right">Net Tax</th>
                        <th className="p-3.5 text-center">Type</th>
                        <th className="p-3.5 text-center">Provenance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {(!statesData.states || statesData.states.length === 0) ? (
                        <tr>
                          <td colSpan={11} className="p-8 text-center text-white/40">
                            No state records available.
                          </td>
                        </tr>
                      ) : (
                        statesData.states.map((st, idx) => {
                          const isUnknown = st.state === "UNKNOWN_STATE"
                          return (
                            <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-3.5 font-medium">
                                {isUnknown ? (
                                  <span className="inline-flex items-center gap-1 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 font-mono">
                                    <FiAlertTriangle size={11} /> UNKNOWN_STATE
                                  </span>
                                ) : (
                                  <span className="text-white">{st.state}</span>
                                )}
                              </td>
                              <td className="p-3.5 text-right font-mono text-white/70">{st.orderCount || 0}</td>
                              <td className="p-3.5 text-right font-mono text-white">₹{Number(st.taxableSales || 0).toLocaleString()}</td>
                              <td className="p-3.5 text-right font-mono text-white/60">₹{Number(st.cgst || 0).toLocaleString()}</td>
                              <td className="p-3.5 text-right font-mono text-white/60">₹{Number(st.sgst || 0).toLocaleString()}</td>
                              <td className="p-3.5 text-right font-mono text-white/60">₹{Number(st.igst || 0).toLocaleString()}</td>
                              <td className="p-3.5 text-right font-mono font-semibold text-amber-400">₹{Number(st.totalTax || 0).toLocaleString()}</td>
                              <td className="p-3.5 text-right font-mono text-white/50">₹{Number(st.refundedTax || 0).toLocaleString()}</td>
                              <td className="p-3.5 text-right font-mono font-semibold text-emerald-400">₹{Number(st.netTax || 0).toLocaleString()}</td>
                              <td className="p-3.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                                  st.classification === "INTRASTATE"
                                    ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
                                    : st.classification === "INTERSTATE"
                                    ? "bg-purple-400/10 text-purple-400 border border-purple-400/20"
                                    : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                                }`}>
                                  {st.classification || "UNKNOWN"}
                                </span>
                              </td>
                              <td className="p-3.5 text-center">
                                <ProvenanceTag type={st.provenance} />
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 4. TAX RATES TAB */}
      {activeTab === "rates" && (
        <div className="space-y-6">
          {loadingRates ? (
            <div className="py-20 flex justify-center"><Loading /></div>
          ) : errorRates ? (
            <div className="bg-dark-800 border border-fire/20 rounded-2xl p-8 text-center space-y-4">
              <FiAlertCircle className="mx-auto text-fire" size={36} />
              <p className="text-white/70 text-sm">{errorRates}</p>
              <button onClick={fetchRates} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold">
                <FiRefreshCw size={14} /> Retry
              </button>
            </div>
          ) : !ratesData ? (
            <div className="bg-dark-800 border border-white/5 rounded-2xl p-12 text-center text-white/40 text-sm">
              No tax rate records available.
            </div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
                  <span className="text-xs text-white/40 font-mono">Rate Buckets</span>
                  <div className="text-xl font-bold font-mono text-white mt-1">{ratesData.summary?.totalRates || 0}</div>
                </div>
                <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
                  <span className="text-xs text-white/40 font-mono">Taxable Sales</span>
                  <div className="text-xl font-bold font-mono text-white mt-1">₹{Number(ratesData.summary?.totalTaxableValue || 0).toLocaleString()}</div>
                </div>
                <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
                  <span className="text-xs text-white/40 font-mono">Total Tax</span>
                  <div className="text-xl font-bold font-mono text-amber-400 mt-1">₹{Number(ratesData.summary?.totalTax || 0).toLocaleString()}</div>
                </div>
                <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
                  <span className="text-xs text-white/40 font-mono">Unknown Rate Items</span>
                  <div className="text-xl font-bold font-mono text-rose-400 mt-1">{ratesData.summary?.unknownRateItems || 0}</div>
                </div>
              </div>

              {/* Rates Table */}
              <div className="bg-dark-800 border border-white/5 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02] text-white/50 font-mono">
                        <th className="p-3.5">Tax Rate Slab</th>
                        <th className="p-3.5 text-right">Taxable Sales</th>
                        <th className="p-3.5 text-right">Output Tax</th>
                        <th className="p-3.5 text-right">Units Sold</th>
                        <th className="p-3.5 text-right">Orders</th>
                        <th className="p-3.5 text-center">Provenance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {(!ratesData.rates || ratesData.rates.length === 0) ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-white/40">
                            No tax rate records available.
                          </td>
                        </tr>
                      ) : (
                        ratesData.rates.map((r, idx) => {
                          const isUnknown = r.rate === "UNKNOWN_RATE" || r.formattedRate === "UNKNOWN_RATE"
                          return (
                            <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-3.5 font-medium">
                                {isUnknown ? (
                                  <span className="inline-flex items-center gap-1 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 font-mono">
                                    <FiAlertTriangle size={11} /> UNKNOWN_RATE
                                  </span>
                                ) : (
                                  <span className="font-mono text-white font-semibold">{r.formattedRate || `${r.rate}%`}</span>
                                )}
                              </td>
                              <td className="p-3.5 text-right font-mono text-white">₹{Number(r.taxableSales || 0).toLocaleString()}</td>
                              <td className="p-3.5 text-right font-mono font-semibold text-amber-400">₹{Number(r.tax || 0).toLocaleString()}</td>
                              <td className="p-3.5 text-right font-mono text-white/70">{r.unitsSold || 0}</td>
                              <td className="p-3.5 text-right font-mono text-white/70">{r.orderCount || 0}</td>
                              <td className="p-3.5 text-center">
                                <ProvenanceTag type={r.provenance} />
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 5. INPUT GST / ITC TAB */}
      {activeTab === "input-tax" && (
        <div className="space-y-6">
          {loadingInputTax ? (
            <div className="py-20 flex justify-center"><Loading /></div>
          ) : errorInputTax ? (
            <div className="bg-dark-800 border border-fire/20 rounded-2xl p-8 text-center space-y-4">
              <FiAlertCircle className="mx-auto text-fire" size={36} />
              <p className="text-white/70 text-sm">{errorInputTax}</p>
              <button onClick={fetchInputTax} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold">
                <FiRefreshCw size={14} /> Retry
              </button>
            </div>
          ) : !inputTaxData ? (
            <div className="bg-dark-800 border border-white/5 rounded-2xl p-12 text-center text-white/40 text-sm">
              No input GST or ITC records available.
            </div>
          ) : (
            <>
              {/* Critical ITC Notice Banner */}
              <div className="bg-dark-800/90 border border-amber-400/20 rounded-xl p-4 flex items-start gap-3 text-xs">
                <FiInfo className="text-amber-400 mt-0.5 shrink-0" size={16} />
                <div className="space-y-1">
                  <div className="text-white font-medium">Internal Management ITC Classification</div>
                  <div className="text-white/60">
                    Amounts indicated below represent expense records classified internally as eligible for ITC.
                    This is a management-level tracking classification, NOT a statutory determination of claimable ITC.
                    Items marked Pending Verification are strictly excluded from the eligible total.
                  </div>
                </div>
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-dark-800 border border-white/5 rounded-xl p-4 space-y-1">
                  <span className="text-xs text-white/40 font-mono">Total Expense GST</span>
                  <div className="text-xl font-bold font-mono text-white">₹{Number(inputTaxData.summary?.totalExpenseGst || 0).toLocaleString()}</div>
                  <span className="text-[10px] text-white/30">Total input tax recorded</span>
                </div>

                <div className="bg-dark-800 border border-emerald-400/20 rounded-xl p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-emerald-400 font-mono">Recorded Eligible ITC</span>
                    <ProvenanceTag type="DERIVED" />
                  </div>
                  <div className="text-xl font-bold font-mono text-emerald-400">₹{Number(inputTaxData.summary?.eligibleItc || 0).toLocaleString()}</div>
                  <span className="text-[10px] text-emerald-400/60">Classified as eligible</span>
                </div>

                <div className="bg-dark-800 border border-white/5 rounded-xl p-4 space-y-1">
                  <span className="text-xs text-white/40 font-mono">Blocked GST</span>
                  <div className="text-xl font-bold font-mono text-rose-400">₹{Number(inputTaxData.summary?.blockedItc || 0).toLocaleString()}</div>
                  <span className="text-[10px] text-white/30">Blocked under Sec 17(5)</span>
                </div>

                <div className="bg-dark-800 border border-white/5 rounded-xl p-4 space-y-1">
                  <span className="text-xs text-white/40 font-mono">Ineligible GST</span>
                  <div className="text-xl font-bold font-mono text-white/70">₹{Number(inputTaxData.summary?.ineligibleItc || 0).toLocaleString()}</div>
                  <span className="text-[10px] text-white/30">Non-business / Ineligible</span>
                </div>

                <div className="bg-dark-800 border border-amber-400/20 rounded-xl p-4 space-y-1">
                  <span className="text-xs text-amber-400 font-mono">Pending Verification</span>
                  <div className="text-xl font-bold font-mono text-amber-400">₹{Number(inputTaxData.summary?.pendingVerificationGst || 0).toLocaleString()}</div>
                  <span className="text-[10px] text-amber-400/60">Awaiting documentation</span>
                </div>
              </div>

              {/* Component breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-dark-800/60 border border-white/5 rounded-xl p-3.5">
                  <span className="text-[11px] text-white/40 font-mono">Input CGST</span>
                  <div className="text-base font-bold font-mono text-white mt-1">₹{Number(inputTaxData.summary?.cgst || 0).toLocaleString()}</div>
                </div>
                <div className="bg-dark-800/60 border border-white/5 rounded-xl p-3.5">
                  <span className="text-[11px] text-white/40 font-mono">Input SGST</span>
                  <div className="text-base font-bold font-mono text-white mt-1">₹{Number(inputTaxData.summary?.sgst || 0).toLocaleString()}</div>
                </div>
                <div className="bg-dark-800/60 border border-white/5 rounded-xl p-3.5">
                  <span className="text-[11px] text-white/40 font-mono">Input IGST</span>
                  <div className="text-base font-bold font-mono text-white mt-1">₹{Number(inputTaxData.summary?.igst || 0).toLocaleString()}</div>
                </div>
                <div className="bg-dark-800/60 border border-white/5 rounded-xl p-3.5">
                  <span className="text-[11px] text-white/40 font-mono">Input Cess</span>
                  <div className="text-base font-bold font-mono text-white mt-1">₹{Number(inputTaxData.summary?.cess || 0).toLocaleString()}</div>
                </div>
              </div>

              {/* By Category Breakdown Table */}
              <div className="bg-dark-800 border border-white/5 rounded-2xl overflow-hidden space-y-3 p-4">
                <h3 className="text-sm font-semibold text-white">Input GST by Expense Category</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02] text-white/50 font-mono">
                        <th className="p-3">Category</th>
                        <th className="p-3 text-right">Total GST</th>
                        <th className="p-3 text-right text-emerald-400">Eligible ITC</th>
                        <th className="p-3 text-right text-rose-400">Blocked GST</th>
                        <th className="p-3 text-right text-white/60">Ineligible</th>
                        <th className="p-3 text-right text-amber-400">Pending Verification</th>
                        <th className="p-3 text-right">Expenses</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {(!inputTaxData.byCategory || inputTaxData.byCategory.length === 0) ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-white/40">No category breakdown records available.</td>
                        </tr>
                      ) : (
                        inputTaxData.byCategory.map((cat, idx) => (
                          <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                            <td className="p-3 font-medium text-white capitalize">{cat.category}</td>
                            <td className="p-3 text-right font-mono font-semibold text-white">₹{Number(cat.totalGst || 0).toLocaleString()}</td>
                            <td className="p-3 text-right font-mono text-emerald-400 font-medium">₹{Number(cat.eligibleItc || 0).toLocaleString()}</td>
                            <td className="p-3 text-right font-mono text-rose-400">₹{Number(cat.blockedItc || 0).toLocaleString()}</td>
                            <td className="p-3 text-right font-mono text-white/60">₹{Number(cat.ineligibleItc || 0).toLocaleString()}</td>
                            <td className="p-3 text-right font-mono text-amber-400">₹{Number(cat.pendingVerificationGst || 0).toLocaleString()}</td>
                            <td className="p-3 text-right font-mono text-white/50">{cat.count || 0}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 6. DATA QUALITY TAB */}
      {activeTab === "data-quality" && (
        <div className="space-y-6">
          {loadingQuality ? (
            <div className="py-20 flex justify-center"><Loading /></div>
          ) : errorQuality ? (
            <div className="bg-dark-800 border border-fire/20 rounded-2xl p-8 text-center space-y-4">
              <FiAlertCircle className="mx-auto text-fire" size={36} />
              <p className="text-white/70 text-sm">{errorQuality}</p>
              <button onClick={fetchQuality} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold">
                <FiRefreshCw size={14} /> Retry
              </button>
            </div>
          ) : !qualityData ? (
            <div className="bg-dark-800 border border-white/5 rounded-2xl p-12 text-center text-white/40 text-sm">
              No data quality audit records available.
            </div>
          ) : (
            <>
              {/* Anomaly Severity Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div
                  onClick={() => setSeverityFilter("ALL")}
                  className={`bg-dark-800 border cursor-pointer rounded-xl p-4 transition-all ${
                    severityFilter === "ALL" ? "border-acid bg-acid/5" : "border-white/5 hover:border-white/20"
                  }`}
                >
                  <span className="text-xs text-white/40 font-mono">Total Anomalies</span>
                  <div className="text-2xl font-bold font-mono text-white mt-1">{qualityData.summary?.totalAnomalies || 0}</div>
                </div>

                <div
                  onClick={() => setSeverityFilter("CRITICAL")}
                  className={`bg-dark-800 border cursor-pointer rounded-xl p-4 transition-all ${
                    severityFilter === "CRITICAL" ? "border-rose-500 bg-rose-500/10" : "border-white/5 hover:border-white/20"
                  }`}
                >
                  <span className="text-xs text-rose-400 font-mono">Critical</span>
                  <div className="text-2xl font-bold font-mono text-rose-400 mt-1">{qualityData.summary?.critical || 0}</div>
                </div>

                <div
                  onClick={() => setSeverityFilter("HIGH")}
                  className={`bg-dark-800 border cursor-pointer rounded-xl p-4 transition-all ${
                    severityFilter === "HIGH" ? "border-orange-500 bg-orange-500/10" : "border-white/5 hover:border-white/20"
                  }`}
                >
                  <span className="text-xs text-orange-400 font-mono">High</span>
                  <div className="text-2xl font-bold font-mono text-orange-400 mt-1">{qualityData.summary?.high || 0}</div>
                </div>

                <div
                  onClick={() => setSeverityFilter("MEDIUM")}
                  className={`bg-dark-800 border cursor-pointer rounded-xl p-4 transition-all ${
                    severityFilter === "MEDIUM" ? "border-amber-500 bg-amber-500/10" : "border-white/5 hover:border-white/20"
                  }`}
                >
                  <span className="text-xs text-amber-400 font-mono">Medium</span>
                  <div className="text-2xl font-bold font-mono text-amber-400 mt-1">{qualityData.summary?.medium || 0}</div>
                </div>

                <div
                  onClick={() => setSeverityFilter("LOW")}
                  className={`bg-dark-800 border cursor-pointer rounded-xl p-4 transition-all ${
                    severityFilter === "LOW" ? "border-blue-500 bg-blue-500/10" : "border-white/5 hover:border-white/20"
                  }`}
                >
                  <span className="text-xs text-blue-400 font-mono">Low</span>
                  <div className="text-2xl font-bold font-mono text-blue-400 mt-1">{qualityData.summary?.low || 0}</div>
                </div>
              </div>

              {/* Anomalies Table */}
              <div className="bg-dark-800 border border-white/5 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Tax Anomaly Audit Log</h3>
                  <span className="text-xs text-white/40">Showing {filteredAnomalies.length} issues</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02] text-white/50 font-mono">
                        <th className="p-3.5">Severity</th>
                        <th className="p-3.5">Anomaly Type & Code</th>
                        <th className="p-3.5">Reference</th>
                        <th className="p-3.5 text-right">Expected</th>
                        <th className="p-3.5 text-right">Actual</th>
                        <th className="p-3.5 text-right">Diff</th>
                        <th className="p-3.5">Explanation</th>
                        <th className="p-3.5 text-center">Provenance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredAnomalies.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-white/40">
                            No tax data quality issues found for this severity filter.
                          </td>
                        </tr>
                      ) : (
                        filteredAnomalies.map((a, idx) => {
                          const humanLabel = ANOMALY_LABELS[a.code] || a.code
                          const sevClass = SEVERITY_BADGES[a.severity] || "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                          return (
                            <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-3.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${sevClass}`}>
                                  {a.severity}
                                </span>
                              </td>
                              <td className="p-3.5 space-y-0.5">
                                <div className="font-semibold text-white">{humanLabel}</div>
                                <div className="font-mono text-[10px] text-white/40">{a.code}</div>
                              </td>
                              <td className="p-3.5 font-mono text-white/70">
                                {a.orderNumber ? `Order #${a.orderNumber}` : a.referenceId ? `${a.referenceType || "Ref"}: ${String(a.referenceId).substring(0, 10)}...` : "—"}
                              </td>
                              <td className="p-3.5 text-right font-mono text-white/60">
                                {a.expected !== undefined && a.expected !== null ? `₹${Number(a.expected).toLocaleString()}` : "—"}
                              </td>
                              <td className="p-3.5 text-right font-mono text-white/60">
                                {a.actual !== undefined && a.actual !== null ? `₹${Number(a.actual).toLocaleString()}` : "—"}
                              </td>
                              <td className="p-3.5 text-right font-mono font-medium text-amber-400">
                                {a.difference !== undefined && a.difference !== null && a.difference !== 0 ? `₹${Number(a.difference).toLocaleString()}` : "—"}
                              </td>
                              <td className="p-3.5 text-white/60 max-w-xs">{a.explanation || "—"}</td>
                              <td className="p-3.5 text-center">
                                <ProvenanceTag type={a.provenance} />
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 7. RECONCILIATION TAB */}
      {activeTab === "reconciliation" && (
        <div className="space-y-6">
          {loadingRecon ? (
            <div className="py-20 flex justify-center"><Loading /></div>
          ) : errorRecon ? (
            <div className="bg-dark-800 border border-fire/20 rounded-2xl p-8 text-center space-y-4">
              <FiAlertCircle className="mx-auto text-fire" size={36} />
              <p className="text-white/70 text-sm">{errorRecon}</p>
              <button onClick={fetchReconciliation} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold">
                <FiRefreshCw size={14} /> Retry
              </button>
            </div>
          ) : !reconData ? (
            <div className="bg-dark-800 border border-white/5 rounded-2xl p-12 text-center text-white/40 text-sm">
              No reconciliation records available.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card A: Order Tax Reconciliation */}
              <div className="bg-dark-800 border border-white/5 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiLayers className="text-acid" size={18} />
                    <h3 className="text-sm font-semibold text-white">Order Line vs Header Tax</h3>
                  </div>
                  <StatusBadge status={reconData.orderTax?.status} />
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Orders Checked:</span>
                    <span className="font-mono text-white font-medium">{reconData.orderTax?.ordersChecked || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Reconciled Orders:</span>
                    <span className="font-mono text-emerald-400 font-medium">{reconData.orderTax?.reconciled || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Mismatch Orders:</span>
                    <span className="font-mono text-rose-400 font-medium">{reconData.orderTax?.mismatch || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Item Line Tax Sum:</span>
                    <span className="font-mono text-white">₹{Number(reconData.orderTax?.itemTaxSum || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Header Tax Sum:</span>
                    <span className="font-mono text-white">₹{Number(reconData.orderTax?.headerTaxSum || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-white/50">Absolute Discrepancy:</span>
                    <span className="font-mono font-bold text-amber-400">₹{Number(reconData.orderTax?.difference || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Card B: Refund Tax Reconciliation */}
              <div className="bg-dark-800 border border-white/5 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiTrendingUp className="text-blue-400" size={18} />
                    <h3 className="text-sm font-semibold text-white">Refund Tax Attribution</h3>
                  </div>
                  <StatusBadge status={reconData.refundTax?.status} />
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Refunds Checked:</span>
                    <span className="font-mono text-white font-medium">{reconData.refundTax?.refundsChecked || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Attributed Tax:</span>
                    <span className="font-mono text-emerald-400 font-medium">{reconData.refundTax?.attributed || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Unknown Tax Lines:</span>
                    <span className="font-mono text-rose-400 font-medium">{reconData.refundTax?.unknown || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Expected Refund Tax:</span>
                    <span className="font-mono text-white">₹{Number(reconData.refundTax?.expectedRefundTax || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Recorded Refund Tax:</span>
                    <span className="font-mono text-white">₹{Number(reconData.refundTax?.recordedRefundTax || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-white/50">Discrepancy:</span>
                    <span className="font-mono font-bold text-amber-400">₹{Number(reconData.refundTax?.difference || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Card C: Expense GST Reconciliation */}
              <div className="bg-dark-800 border border-white/5 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiFileText className="text-purple-400" size={18} />
                    <h3 className="text-sm font-semibold text-white">Expense GST vs Components</h3>
                  </div>
                  <StatusBadge status={reconData.expenseGst?.status} />
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Expenses Checked:</span>
                    <span className="font-mono text-white font-medium">{reconData.expenseGst?.expensesChecked || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Reconciled Records:</span>
                    <span className="font-mono text-emerald-400 font-medium">{reconData.expenseGst?.reconciled || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Mismatch Records:</span>
                    <span className="font-mono text-rose-400 font-medium">{reconData.expenseGst?.mismatch || 0}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Component GST Sum (CGST+SGST+IGST):</span>
                    <span className="font-mono text-white">₹{Number(reconData.expenseGst?.componentGstSum || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Recorded GST Sum:</span>
                    <span className="font-mono text-white">₹{Number(reconData.expenseGst?.recordedGstSum || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-white/50">Discrepancy:</span>
                    <span className="font-mono font-bold text-amber-400">₹{Number(reconData.expenseGst?.difference || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Card D: ITC Classification Distribution */}
              <div className="bg-dark-800 border border-white/5 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiShield className="text-emerald-400" size={18} />
                    <h3 className="text-sm font-semibold text-white">ITC Classification Status</h3>
                  </div>
                  <StatusBadge status={reconData.itcClassification?.status} />
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Recorded Eligible ITC:</span>
                    <span className="font-mono text-emerald-400 font-medium">₹{Number(reconData.itcClassification?.eligible || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Blocked GST (Sec 17(5)):</span>
                    <span className="font-mono text-rose-400 font-medium">₹{Number(reconData.itcClassification?.blocked || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Ineligible GST:</span>
                    <span className="font-mono text-white/70 font-medium">₹{Number(reconData.itcClassification?.ineligible || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Pending Verification:</span>
                    <span className="font-mono text-amber-400 font-medium">₹{Number(reconData.itcClassification?.pendingVerification || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-white/50">Invalid Classification Records:</span>
                    <span className="font-mono font-bold text-rose-400">{reconData.itcClassification?.invalidClassification || 0}</span>
                  </div>
                </div>
              </div>

              {/* Card E: Shipping GST Disclosure Card */}
              <div className="md:col-span-2 bg-dark-800 border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <FiInfo className="text-white/40 mt-1 shrink-0" size={20} />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-white">Shipping GST Snapshot Disclosure</h4>
                      <StatusBadge status={reconData.shippingGstNotice?.status || "NOT_AVAILABLE"} />
                      <ProvenanceTag type={reconData.shippingGstNotice?.provenance || "UNKNOWN"} />
                    </div>
                    <p className="text-xs text-white/50">
                      {reconData.shippingGstNotice?.message ||
                        "Shipping GST is not separately captured in historical order snapshots. In accordance with LYVO financial integrity guidelines, no estimated tax rate is fabricated."}
                    </p>
                  </div>
                </div>
                <div className="text-[11px] text-white/40 font-mono shrink-0 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                  Statutory Rule: No Synthetic Estimation
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
