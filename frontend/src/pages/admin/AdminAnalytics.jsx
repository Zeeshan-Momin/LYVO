import { useState, useEffect } from "react"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts"
import {
  FiTrendingUp, FiShoppingBag, FiDollarSign, FiUsers, FiPackage,
  FiRotateCcw, FiTag, FiCalendar, FiAlertTriangle, FiCheckCircle,
  FiInfo, FiSearch, FiArrowUpRight, FiArrowDownRight, FiEye, FiX,
  FiActivity, FiLayers, FiMapPin, FiCreditCard, FiTruck
} from "react-icons/fi"
import { adminAPI } from "../../api"
import Loading from "../../components/common/Loading"
import ProductsAnalyticsTab from "./analytics/ProductsAnalyticsTab"
import SizeColorAnalyticsTab from "./analytics/SizeColorAnalyticsTab"
import InventoryAnalyticsTab from "./analytics/InventoryAnalyticsTab"
import LogisticsAnalyticsTab from "./analytics/LogisticsAnalyticsTab"
import ReturnsAnalyticsTab from "./analytics/ReturnsAnalyticsTab"
import GeographyAnalyticsTab from "./analytics/GeographyAnalyticsTab"
import PaymentsAnalyticsTab from "./analytics/PaymentsAnalyticsTab"

const COLORS = ["var(--color-acid)", "#60a5fa", "#FFD166", "#FF3A1A", "#a78bfa", "#22d3ee", "#f472b6", "#34d399"]

const CustomTooltip = ({ active, payload, label }) => {
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
              {p.name.toLowerCase().includes("revenue") || p.name.toLowerCase().includes("sales") || p.name.toLowerCase().includes("spend") || p.name.toLowerCase().includes("discount") || p.name.toLowerCase().includes("refund") || p.name.toLowerCase().includes("aov")
                ? `₹${Number(p.value).toLocaleString()}`
                : Number(p.value).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminAnalytics() {
  const [activeTab, setActiveTab] = useState("overview") // "overview" | "sales" | "customers" | "data-quality"
  const [dateRangeOption, setDateRangeOption] = useState("30d") // "7d" | "30d" | "90d" | "year" | "custom"
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")

  // Overview Data
  const [overviewData, setOverviewData] = useState(null)
  const [loadingOverview, setLoadingOverview] = useState(true)

  // Sales Deep-Dive Data
  const [salesData, setSalesData] = useState(null)
  const [salesInterval, setSalesInterval] = useState("day")
  const [loadingSales, setLoadingSales] = useState(false)

  // Customer 360 Data
  const [customersData, setCustomersData] = useState([])
  const [customerPagination, setCustomerPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 })
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerSegment, setCustomerSegment] = useState("")
  const [customerSortBy, setCustomerSortBy] = useState("netSpend")
  const [loadingCustomers, setLoadingCustomers] = useState(false)

  // Customer Profile Modal
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [customerProfile, setCustomerProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)

  // Data Quality Data
  const [qualityData, setQualityData] = useState(null)
  const [loadingQuality, setLoadingQuality] = useState(false)

  // Resolve Date Range Query Parameters
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

  // Load Overview Data
  useEffect(() => {
    if (activeTab !== "overview") return
    setLoadingOverview(true)
    const params = getDateParams()
    adminAPI.getOverview(params)
      .then(res => setOverviewData(res.data))
      .catch(err => console.error("Error fetching overview analytics:", err))
      .finally(() => setLoadingOverview(false))
  }, [activeTab, dateRangeOption, customStart, customEnd])

  // Load Sales Data
  useEffect(() => {
    if (activeTab !== "sales") return
    setLoadingSales(true)
    const params = { ...getDateParams(), interval: salesInterval }
    adminAPI.getDetailedSales(params)
      .then(res => setSalesData(res.data))
      .catch(err => console.error("Error fetching sales analytics:", err))
      .finally(() => setLoadingSales(false))
  }, [activeTab, dateRangeOption, salesInterval, customStart, customEnd])

  // Load Customer 360 Data
  useEffect(() => {
    if (activeTab !== "customers") return
    setLoadingCustomers(true)
    const delayDebounce = setTimeout(() => {
      adminAPI.getCustomersAnalytics({
        page: customerPagination.page,
        limit: customerPagination.limit,
        search: customerSearch,
        segment: customerSegment,
        sortBy: customerSortBy
      })
        .then(res => {
          setCustomersData(res.data.customers || [])
          setCustomerPagination(res.data.pagination || { page: 1, limit: 15, total: 0, pages: 1 })
        })
        .catch(err => console.error("Error fetching customer analytics:", err))
        .finally(() => setLoadingCustomers(false))
    }, 300)

    return () => clearTimeout(delayDebounce)
  }, [activeTab, customerPagination.page, customerSearch, customerSegment, customerSortBy])

  // Load Individual Customer Profile
  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerProfile(null)
      return
    }
    setLoadingProfile(true)
    adminAPI.getCustomerProfile(selectedCustomerId)
      .then(res => setCustomerProfile(res.data))
      .catch(err => console.error("Error fetching customer profile:", err))
      .finally(() => setLoadingProfile(false))
  }, [selectedCustomerId])

  // Load Data Quality Metrics
  useEffect(() => {
    if (activeTab !== "data-quality") return
    setLoadingQuality(true)
    adminAPI.getDataQuality()
      .then(res => setQualityData(res.data))
      .catch(err => console.error("Error fetching data quality metrics:", err))
      .finally(() => setLoadingQuality(false))
  }, [activeTab])

  // Change indicator helper
  const renderChange = (val) => {
    if (val === undefined || val === null) return null
    const isPositive = val >= 0
    return (
      <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md ${
        isPositive ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10"
      }`}>
        {isPositive ? <FiArrowUpRight className="mr-0.5" /> : <FiArrowDownRight className="mr-0.5" />}
        {Math.abs(val)}%
      </span>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header & Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="font-display text-3xl tracking-wider">Analytics & Business Intelligence</h1>
          <p className="text-white/40 text-sm mt-0.5">Phase 1 Audited Managerial Reporting Engine</p>
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
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setDateRangeOption(tab.id)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  dateRangeOption === tab.id ? "bg-acid text-dark-900 font-semibold shadow" : "text-white/60 hover:text-white"
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
      </div>

      {/* Primary Analytics Tab Switcher */}
      <div className="flex border-b border-white/10 gap-2 sm:gap-6 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: "overview", label: "Overview", icon: FiActivity },
          { id: "sales", label: "Sales & Revenue", icon: FiTrendingUp },
          { id: "products", label: "Products", icon: FiShoppingBag },
          { id: "sizes-colors", label: "Sizes & Colors", icon: FiLayers },
          { id: "inventory", label: "Inventory", icon: FiPackage },
          { id: "logistics", label: "Logistics", icon: FiTruck },
          { id: "returns", label: "Returns", icon: FiRotateCcw },
          { id: "geography", label: "Geography", icon: FiMapPin },
          { id: "payments", label: "Payments", icon: FiCreditCard },
          { id: "customers", label: "Customer 360", icon: FiUsers },
          { id: "data-quality", label: "Data Quality", icon: FiCheckCircle }
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 pb-3 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-all ${
                isActive
                  ? "border-acid text-acid font-semibold"
                  : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW DASHBOARD */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <>
          {loadingOverview ? (
            <div className="py-20"><Loading /></div>
          ) : (
            <div className="space-y-6">
              {/* Financial KPI Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Gross Merchandise Sales */}
                <div className="card p-5 space-y-2 relative overflow-hidden">
                  <div className="flex items-center justify-between text-white/40 text-xs">
                    <span>Gross Merchandise Sales</span>
                    <FiShoppingBag className="text-acid" size={16} />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold font-display tracking-wide">
                      ₹{(overviewData?.kpis?.grossMerchandiseSales || 0).toLocaleString()}
                    </span>
                    {renderChange(overviewData?.comparison?.grossSalesChange)}
                  </div>
                  <p className="text-[11px] text-white/30">Catalog selling value before discounts</p>
                </div>

                {/* 2. Net Sales / Net Revenue */}
                <div className="card p-5 space-y-2 relative overflow-hidden border-acid/30">
                  <div className="flex items-center justify-between text-white/40 text-xs">
                    <span className="text-acid font-medium">Net Sales (Top Line)</span>
                    <FiDollarSign className="text-acid" size={16} />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold font-display tracking-wide text-acid">
                      ₹{(overviewData?.kpis?.netSales || 0).toLocaleString()}
                    </span>
                    {renderChange(overviewData?.comparison?.netSalesChange)}
                  </div>
                  <p className="text-[11px] text-white/30">GMS - Discounts + Shipping - Refunds</p>
                </div>

                {/* 3. Total Orders & Units */}
                <div className="card p-5 space-y-2 relative overflow-hidden">
                  <div className="flex items-center justify-between text-white/40 text-xs">
                    <span>Orders & Volume</span>
                    <FiPackage className="text-blue-400" size={16} />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-bold font-display tracking-wide">
                        {overviewData?.kpis?.orderCount || 0}
                      </span>
                      <span className="text-xs text-white/40 ml-2">
                        ({overviewData?.kpis?.totalUnits || 0} units)
                      </span>
                    </div>
                    {renderChange(overviewData?.comparison?.ordersChange)}
                  </div>
                  <p className="text-[11px] text-white/30">Non-cancelled completed orders</p>
                </div>

                {/* 4. Average Order Value (AOV) */}
                <div className="card p-5 space-y-2 relative overflow-hidden">
                  <div className="flex items-center justify-between text-white/40 text-xs">
                    <span>Average Order Value (AOV)</span>
                    <FiTrendingUp className="text-amber-400" size={16} />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold font-display tracking-wide">
                      ₹{(overviewData?.kpis?.aov || 0).toLocaleString()}
                    </span>
                    {renderChange(overviewData?.comparison?.aovChange)}
                  </div>
                  <p className="text-[11px] text-white/30">Net revenue per fulfilled order</p>
                </div>
              </div>

              {/* Secondary Metric Bar: Discounts, Tax, Shipping, Refunds */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-dark-800/60 p-4 rounded-2xl border border-white/5 text-xs">
                <div>
                  <span className="text-white/40 block">Coupon Discounts:</span>
                  <span className="font-semibold text-rose-400 text-sm">
                    -₹{(overviewData?.kpis?.couponDiscounts || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-white/40 block">Shipping Revenue:</span>
                  <span className="font-semibold text-blue-400 text-sm">
                    +₹{(overviewData?.kpis?.shippingRevenue || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-white/40 block">Tax Collected (GST):</span>
                  <span className="font-semibold text-white/80 text-sm">
                    ₹{(overviewData?.kpis?.taxCollected || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-white/40 block">Actual Refunds:</span>
                  <span className="font-semibold text-rose-400 text-sm">
                    -₹{(overviewData?.kpis?.totalRefunds || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Primary Sales Velocity Chart */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-semibold text-base">Revenue & Sales Velocity</h2>
                    <p className="text-xs text-white/40">Daily Gross vs Net Sales trajectory</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-acid" />
                      <span className="text-white/60">Net Sales</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                      <span className="text-white/60">Gross Sales</span>
                    </div>
                  </div>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={overviewData?.timeSeries || []}>
                      <defs>
                        <linearGradient id="netSalesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-acid)" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="var(--color-acid)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="grossSalesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="netSales" name="Net Sales" stroke="var(--color-acid)" strokeWidth={2} fillOpacity={1} fill="url(#netSalesGrad)" />
                      <Area type="monotone" dataKey="grossSales" name="Gross Sales" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="3 3" fillOpacity={1} fill="url(#grossSalesGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Two Column Grid: Top Products & Order Status Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Products */}
                <div className="card p-6">
                  <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
                    <FiShoppingBag className="text-acid" /> Top Performing Footwear
                  </h2>
                  <div className="space-y-3">
                    {(overviewData?.topProducts || []).map((p, i) => (
                      <div key={p._id || i} className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            i === 0 ? "bg-gold text-dark-900" : i === 1 ? "bg-white/20 text-white" : "bg-dark-700 text-white/40"
                          }`}>
                            {i + 1}
                          </span>
                          <div className="w-10 h-10 rounded-lg bg-dark-700 overflow-hidden shrink-0">
                            {p.image ? (
                              <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/20"><FiPackage /></div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-white line-clamp-1">{p.name || "Product"}</p>
                            <p className="text-xs text-white/40">{p.category || "Footwear"}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-sm text-acid">{p.unitsSold} units</p>
                          <p className="text-xs text-white/40">₹{(p.revenue || 0).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                    {(!overviewData?.topProducts || overviewData.topProducts.length === 0) && (
                      <p className="text-center text-white/20 py-8 text-sm">No sales in selected period</p>
                    )}
                  </div>
                </div>

                {/* Orders by Status */}
                <div className="card p-6">
                  <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
                    <FiLayers className="text-blue-400" /> Fulfillment & Status Distribution
                  </h2>
                  <div className="space-y-3">
                    {(overviewData?.statusBreakdown || []).map(st => (
                      <div key={st._id} className="flex items-center justify-between p-2 rounded-xl bg-dark-700/40">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${
                            st._id === "delivered" ? "bg-emerald-400" :
                            st._id === "shipped" || st._id === "processing" ? "bg-blue-400" :
                            st._id === "pending" || st._id === "confirmed" ? "bg-amber-400" :
                            st._id === "cancelled" || st._id === "refunded" ? "bg-rose-400" : "bg-purple-400"
                          }`} />
                          <span className="text-sm capitalize text-white/80">{st._id.replace("_", " ")}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-sm">{st.count} orders</span>
                          <span className="text-xs text-white/40 ml-2">₹{(st.revenue || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SALES & REVENUE DEEP DIVE */}
      {/* ========================================================================= */}
      {activeTab === "sales" && (
        <>
          {loadingSales ? (
            <div className="py-20"><Loading /></div>
          ) : (
            <div className="space-y-6">
              {/* Interval Switcher */}
              <div className="flex items-center justify-between bg-dark-800/40 p-3 rounded-2xl border border-white/5">
                <span className="text-xs text-white/60">Time-Series Aggregation Interval:</span>
                <div className="flex bg-dark-700 p-1 rounded-xl text-xs">
                  {["day", "week", "month"].map(int => (
                    <button
                      key={int}
                      onClick={() => setSalesInterval(int)}
                      className={`px-3 py-1 rounded-lg capitalize ${
                        salesInterval === int ? "bg-acid text-dark-900 font-semibold" : "text-white/60 hover:text-white"
                      }`}
                    >
                      {int}ly
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Series Bar Chart */}
              <div className="card p-6">
                <h2 className="font-semibold text-base mb-4">Detailed Revenue & Net Merchandise Sales</h2>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesData?.timeSeries || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "12px" }} />
                      <Bar dataKey="grossMerchandiseSales" name="Gross Merchandise Sales" fill="#60a5fa" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
                      <Bar dataKey="netSales" name="Net Sales" fill="var(--color-acid)" radius={[4, 4, 0, 0]} fillOpacity={0.9} />
                      <Bar dataKey="couponDiscounts" name="Coupon Discounts" fill="#f43f5e" radius={[4, 4, 0, 0]} fillOpacity={0.7} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Multi-Dimensional Breakdowns Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 1. Category Breakdown */}
                <div className="card p-5">
                  <h3 className="font-semibold text-sm mb-4">Sales by Category</h3>
                  <div className="space-y-3">
                    {(salesData?.categories || []).map((cat, idx) => (
                      <div key={cat.category || idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-white/80 font-medium">{cat.category}</span>
                          <span className="text-acid font-semibold">₹{(cat.revenue || 0).toLocaleString()} ({cat.units} units)</span>
                        </div>
                        <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-acid rounded-full"
                            style={{ width: `${Math.min(100, (cat.revenue / (salesData?.categories[0]?.revenue || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {(!salesData?.categories || salesData.categories.length === 0) && (
                      <p className="text-center text-white/20 py-6 text-xs">No category data</p>
                    )}
                  </div>
                </div>

                {/* 2. Gender Split */}
                <div className="card p-5">
                  <h3 className="font-semibold text-sm mb-4">Sales by Gender Classification</h3>
                  <div className="h-44 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={salesData?.genders || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={68}
                          paddingAngle={4}
                          dataKey="revenue"
                          nameKey="gender"
                        >
                          {(salesData?.genders || []).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {(salesData?.genders || []).map((g, i) => (
                      <div key={g.gender} className="flex items-center gap-2 text-xs">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="capitalize text-white/70">{g.gender}:</span>
                        <span className="font-semibold text-white">₹{(g.revenue || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Payment Methods */}
                <div className="card p-5">
                  <h3 className="font-semibold text-sm mb-4">Payment Methods Distribution</h3>
                  <div className="space-y-3">
                    {(salesData?.paymentMethods || []).map(pm => (
                      <div key={pm.paymentMethod} className="flex items-center justify-between p-2 rounded-lg bg-dark-700/40 text-xs">
                        <div className="flex items-center gap-2">
                          <FiCreditCard className="text-acid" />
                          <span className="uppercase font-semibold text-white/80">{pm.paymentMethod}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold">{pm.count} orders</span>
                          <span className="text-white/40 block text-[11px]">₹{(pm.totalAmount || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Top Footwear Sizes */}
                <div className="card p-5">
                  <h3 className="font-semibold text-sm mb-4">Top Footwear Sizes Sold</h3>
                  <div className="flex flex-wrap gap-2">
                    {(salesData?.sizes || []).map(sz => (
                      <div key={sz._id} className="bg-dark-700 border border-white/10 px-3 py-2 rounded-xl text-center flex-1 min-w-[70px]">
                        <span className="text-xs text-white/40 block">UK/Size</span>
                        <span className="text-sm font-bold text-acid">{sz._id}</span>
                        <span className="text-[11px] text-white/60 block">{sz.units} sold</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Top Colors */}
                <div className="card p-5">
                  <h3 className="font-semibold text-sm mb-4">Top Colors Sold</h3>
                  <div className="space-y-2">
                    {(salesData?.colors || []).map(cl => (
                      <div key={cl._id} className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-white/5">
                        <span className="capitalize text-white/80 font-medium">{cl._id}</span>
                        <span className="text-acid font-semibold">{cl.units} units (₹{(cl.revenue || 0).toLocaleString()})</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 6. Top Delivery States */}
                <div className="card p-5">
                  <h3 className="font-semibold text-sm mb-4">Top Destination States</h3>
                  <div className="space-y-2">
                    {(salesData?.states || []).map(st => (
                      <div key={st.state} className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-white/5">
                        <div className="flex items-center gap-1.5">
                          <FiMapPin className="text-acid/70" />
                          <span className="text-white/80 font-medium">{st.state}</span>
                        </div>
                        <span className="font-semibold text-white/90">{st.orders} orders (₹{(st.revenue || 0).toLocaleString()})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CUSTOMER 360 */}
      {/* ========================================================================= */}
      {activeTab === "customers" && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-dark-800/60 p-4 rounded-2xl border border-white/5">
            <div className="relative flex-1 w-full">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search customers by name, email, or phone..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                className="input pl-10 py-2 text-xs w-full bg-dark-700 border-white/10"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={customerSegment}
                onChange={e => setCustomerSegment(e.target.value)}
                className="input py-2 text-xs bg-dark-700 border-white/10"
              >
                <option value="">All Segments</option>
                <option value="New">New (1 Order)</option>
                <option value="Active Repeat">Active Repeat (2+ Orders)</option>
                <option value="At-Risk">At-Risk (90-180D Inactive)</option>
                <option value="Dormant">Dormant (&gt;180D)</option>
                <option value="Prospect">Prospect (0 Orders)</option>
              </select>

              <select
                value={customerSortBy}
                onChange={e => setCustomerSortBy(e.target.value)}
                className="input py-2 text-xs bg-dark-700 border-white/10"
              >
                <option value="netSpend">Sort by Lifetime Net Spend</option>
                <option value="totalOrders">Sort by Total Orders</option>
                <option value="aov">Sort by AOV</option>
                <option value="lastOrderDate">Sort by Last Order Date</option>
              </select>
            </div>
          </div>

          {/* Customers Table */}
          {loadingCustomers ? (
            <div className="py-20"><Loading /></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-dark-700/60 text-white/40 uppercase tracking-wider font-mono text-[10px] border-b border-white/5">
                    <tr>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Segment</th>
                      <th className="py-3.5 px-4 text-right">Orders</th>
                      <th className="py-3.5 px-4 text-right">Gross Spend</th>
                      <th className="py-3.5 px-4 text-right">Discounts</th>
                      <th className="py-3.5 px-4 text-right">Net Spend</th>
                      <th className="py-3.5 px-4 text-right">AOV</th>
                      <th className="py-3.5 px-4">Last Order</th>
                      <th className="py-3.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {customersData.map(c => (
                      <tr key={c._id} className="hover:bg-white/[0.02] transition-all">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center font-bold text-acid shrink-0">
                              {c.name ? c.name[0].toUpperCase() : "U"}
                            </div>
                            <div>
                              <p className="font-semibold text-white">{c.name}</p>
                              <p className="text-white/40 text-[11px]">{c.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                            c.segment === "Active Repeat" ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20" :
                            c.segment === "New" ? "bg-blue-400/10 text-blue-400 border border-blue-400/20" :
                            c.segment === "At-Risk" ? "bg-amber-400/10 text-amber-400 border border-amber-400/20" :
                            c.segment === "Dormant" ? "bg-rose-400/10 text-rose-400 border border-rose-400/20" :
                            "bg-white/5 text-white/50"
                          }`}>
                            {c.segment}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium">{c.totalOrders}</td>
                        <td className="py-3.5 px-4 text-right text-white/60">₹{(c.grossSpend || 0).toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right text-rose-400/80">₹{(c.totalDiscounts || 0).toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-acid">₹{(c.netSpend || 0).toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right text-white/80">₹{(c.aov || 0).toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-white/40">
                          {c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString() : "Never"}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => setSelectedCustomerId(c._id)}
                            className="btn btn-sm py-1 px-2.5 bg-dark-700 hover:bg-dark-600 text-acid rounded-lg inline-flex items-center gap-1.5"
                          >
                            <FiEye size={13} /> View 360
                          </button>
                        </td>
                      </tr>
                    ))}
                    {customersData.length === 0 && (
                      <tr>
                        <td colSpan="9" className="text-center py-12 text-white/20">
                          No customers match the current filter
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {customerPagination.pages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-white/5 text-xs">
                  <span className="text-white/40">
                    Showing page {customerPagination.page} of {customerPagination.pages} ({customerPagination.total} customers)
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={customerPagination.page <= 1}
                      onClick={() => setCustomerPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      className="btn btn-sm py-1 px-3 bg-dark-700 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      disabled={customerPagination.page >= customerPagination.pages}
                      onClick={() => setCustomerPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      className="btn btn-sm py-1 px-3 bg-dark-700 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CUSTOMER 360 PROFILE MODAL */}
      {/* ========================================================================= */}
      {selectedCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-800 border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
            <button
              onClick={() => setSelectedCustomerId(null)}
              className="absolute top-5 right-5 text-white/40 hover:text-white bg-dark-700 p-2 rounded-full"
            >
              <FiX size={18} />
            </button>

            {loadingProfile ? (
              <div className="py-20"><Loading /></div>
            ) : customerProfile ? (
              <div className="space-y-6">
                {/* Customer Profile Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-dark-700 border border-acid/30 flex items-center justify-center font-bold text-2xl text-acid">
                      {customerProfile.customer?.name?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold font-display">{customerProfile.customer?.name}</h2>
                      <p className="text-xs text-white/40">{customerProfile.customer?.email} • {customerProfile.customer?.phone || "No phone"}</p>
                      <p className="text-[11px] text-white/30 mt-0.5">Member since: {new Date(customerProfile.customer?.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-white/40 block">Lifetime Net Spend</span>
                    <span className="text-2xl font-bold text-acid">₹{(customerProfile.customer?.netSpend || 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* Deterministic Preferences Section */}
                <div className="card p-5 bg-dark-700/40 border-acid/20">
                  <h3 className="font-semibold text-xs uppercase tracking-wider text-acid mb-3 flex items-center gap-1.5">
                    <FiTag size={13} /> Frequency-Based Purchase Preferences (Deterministic Mode)
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-dark-800 p-3 rounded-xl border border-white/5">
                      <span className="text-[11px] text-white/40 block">Preferred Category</span>
                      <span className="font-semibold text-sm text-white">{customerProfile.preferences?.preferredCategory || "N/A"}</span>
                    </div>
                    <div className="bg-dark-800 p-3 rounded-xl border border-white/5">
                      <span className="text-[11px] text-white/40 block">Preferred Shoe Size</span>
                      <span className="font-semibold text-sm text-acid">{customerProfile.preferences?.preferredSize || "N/A"}</span>
                    </div>
                    <div className="bg-dark-800 p-3 rounded-xl border border-white/5">
                      <span className="text-[11px] text-white/40 block">Preferred Color</span>
                      <span className="font-semibold text-sm text-white capitalize">{customerProfile.preferences?.preferredColor || "N/A"}</span>
                    </div>
                    <div className="bg-dark-800 p-3 rounded-xl border border-white/5">
                      <span className="text-[11px] text-white/40 block">Preferred City</span>
                      <span className="font-semibold text-sm text-white">{customerProfile.preferences?.preferredCity || "N/A"}</span>
                    </div>
                    <div className="bg-dark-800 p-3 rounded-xl border border-white/5">
                      <span className="text-[11px] text-white/40 block">Preferred State</span>
                      <span className="font-semibold text-sm text-white">{customerProfile.preferences?.preferredState || "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* Lifetime Order Summary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-dark-700/20 p-4 rounded-xl border border-white/5">
                  <div>
                    <span className="text-white/40 block">Total Completed Orders:</span>
                    <span className="font-bold text-sm text-white">{customerProfile.customer?.totalOrders || 0}</span>
                  </div>
                  <div>
                    <span className="text-white/40 block">Total Units Bought:</span>
                    <span className="font-bold text-sm text-white">{customerProfile.customer?.totalUnits || 0} pairs</span>
                  </div>
                  <div>
                    <span className="text-white/40 block">Total Discounts Given:</span>
                    <span className="font-bold text-sm text-rose-400">₹{(customerProfile.customer?.totalDiscounts || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-white/40 block">Average Order Value:</span>
                    <span className="font-bold text-sm text-amber-400">₹{(customerProfile.customer?.aov || 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* Chronological Order History */}
                <div>
                  <h3 className="font-semibold text-sm mb-3">Complete Chronological Order History</h3>
                  <div className="space-y-3">
                    {(customerProfile.orderHistory || []).map(o => (
                      <div key={o._id} className="card p-4 bg-dark-700/30 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2 text-xs">
                          <div>
                            <span className="font-mono font-bold text-acid">{o.orderNumber}</span>
                            <span className="text-white/40 ml-3">{new Date(o.createdAt).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              o.status === "delivered" ? "bg-emerald-400/10 text-emerald-400" :
                              o.status === "cancelled" ? "bg-rose-400/10 text-rose-400" : "bg-blue-400/10 text-blue-400"
                            }`}>
                              {o.status}
                            </span>
                            <span className="font-bold text-sm text-white">₹{(o.pricing?.total || 0).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Items in Order */}
                        <div className="space-y-2">
                          {(o.items || []).map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded bg-dark-600 overflow-hidden shrink-0">
                                  {it.image && <img src={it.image} alt="" className="w-full h-full object-cover" />}
                                </div>
                                <div>
                                  <span className="font-medium text-white">{it.name}</span>
                                  <span className="text-white/40 text-[11px] ml-2">Size: {it.size} • Color: {it.color || "Std"} • Qty: {it.quantity}</span>
                                </div>
                              </div>
                              <span className="font-semibold text-white/80">₹{(it.price * it.quantity).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center py-10 text-white/30">Failed to load customer profile</p>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 2 TABS */}
      {/* ========================================================================= */}
      {activeTab === "products" && (
        <ProductsAnalyticsTab dateParams={getDateParams()} />
      )}

      {activeTab === "sizes-colors" && (
        <SizeColorAnalyticsTab dateParams={getDateParams()} />
      )}

      {activeTab === "inventory" && (
        <InventoryAnalyticsTab />
      )}

      {activeTab === "logistics" && (
        <LogisticsAnalyticsTab dateParams={getDateParams()} />
      )}

      {activeTab === "returns" && (
        <ReturnsAnalyticsTab dateParams={getDateParams()} />
      )}

      {activeTab === "geography" && (
        <GeographyAnalyticsTab dateParams={getDateParams()} />
      )}

      {activeTab === "payments" && (
        <PaymentsAnalyticsTab dateParams={getDateParams()} />
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DATA QUALITY INSPECTOR (EXTENDED) */}
      {/* ========================================================================= */}
      {activeTab === "data-quality" && (
        <>
          {loadingQuality ? (
            <div className="py-20"><Loading /></div>
          ) : (
            <div className="space-y-6">
              {/* Overall Score Banner */}
              <div className="card p-6 bg-gradient-to-r from-dark-800 to-dark-700 border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FiActivity className="text-acid" />
                    <h2 className="text-lg font-bold">Analytics Data Quality & Audit Readiness Score</h2>
                  </div>
                  <p className="text-xs text-white/50 max-w-xl">
                    {qualityData?.status === "initialized_empty" || qualityData?.totalOrders === 0
                      ? "Database initialized — awaiting first order transactions to populate data quality telemetry."
                      : "Monitors missing COGS, unverified HSN codes, missing SKU barcodes, unlinked shipments, and reconciliation gaps across catalog and transaction records."}
                  </p>
                </div>
                <div className="text-center sm:text-right shrink-0 bg-dark-900/60 px-6 py-4 rounded-2xl border border-white/5">
                  <span className="text-3xl font-extrabold font-display text-acid">
                    {qualityData?.status === "initialized_empty" || qualityData?.totalOrders === 0 ? "—" : `${qualityData?.overallReadinessScore || 0}%`}
                  </span>
                  <span className="block text-[11px] text-white/40 uppercase tracking-wider font-mono mt-0.5">
                    {qualityData?.status === "initialized_empty" || qualityData?.totalOrders === 0 ? "Initialized" : "Data Integrity Score"}
                  </span>
                </div>
              </div>

              {/* Diagnostic Indicators Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. COGS Quality */}
                <div className="card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm flex items-center gap-2">
                      <FiDollarSign className="text-amber-400" /> COGS Cost Price
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      qualityData?.indicators?.cogs?.status === "healthy" ? "bg-emerald-400/10 text-emerald-400" : "bg-amber-400/10 text-amber-400"
                    }`}>
                      {qualityData?.indicators?.cogs?.completenessPercent}% Complete
                    </span>
                  </div>
                  <p className="text-xs text-white/60">{qualityData?.indicators?.cogs?.message}</p>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                    <div className="bg-dark-700/50 p-2 rounded-lg">
                      <span className="text-white/40 block text-[10px]">Actual</span>
                      <span className="font-bold text-emerald-400">{qualityData?.indicators?.cogs?.actualCount || 0}</span>
                    </div>
                    <div className="bg-dark-700/50 p-2 rounded-lg">
                      <span className="text-white/40 block text-[10px]">Estimated</span>
                      <span className="font-bold text-blue-400">{qualityData?.indicators?.cogs?.estimatedCount || 0}</span>
                    </div>
                    <div className="bg-dark-700/50 p-2 rounded-lg">
                      <span className="text-white/40 block text-[10px]">Unknown</span>
                      <span className="font-bold text-rose-400">{qualityData?.indicators?.cogs?.unknownCount || 0}</span>
                    </div>
                  </div>
                </div>

                {/* 2. HSN Classification */}
                <div className="card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm flex items-center gap-2">
                      <FiTag className="text-blue-400" /> HSN Classification
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      qualityData?.indicators?.hsn?.status === "healthy" ? "bg-emerald-400/10 text-emerald-400" : "bg-amber-400/10 text-amber-400"
                    }`}>
                      {qualityData?.indicators?.hsn?.missingCount === 0 ? "Verified" : `${qualityData?.indicators?.hsn?.missingCount} Missing`}
                    </span>
                  </div>
                  <p className="text-xs text-white/60">{qualityData?.indicators?.hsn?.message}</p>
                </div>

                {/* 3. SKU Code Completeness */}
                <div className="card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm flex items-center gap-2">
                      <FiPackage className="text-emerald-400" /> Product SKU Barcodes
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      qualityData?.indicators?.sku?.status === "healthy" ? "bg-emerald-400/10 text-emerald-400" : "bg-amber-400/10 text-amber-400"
                    }`}>
                      {qualityData?.indicators?.sku?.missingCount === 0 ? "100% SKU Stamped" : `${qualityData?.indicators?.sku?.missingCount} Missing`}
                    </span>
                  </div>
                  <p className="text-xs text-white/60">{qualityData?.indicators?.sku?.message}</p>
                </div>

                {/* 4. Tax Snapshot Completeness */}
                <div className="card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm flex items-center gap-2">
                      <FiInfo className="text-purple-400" /> Immutable Tax Snapshots
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      qualityData?.indicators?.taxSnapshot?.status === "healthy" ? "bg-emerald-400/10 text-emerald-400" : "bg-white/10 text-white/50"
                    }`}>
                      {qualityData?.indicators?.taxSnapshot?.missingCount === 0 ? "100% Stamped" : `${qualityData?.indicators?.taxSnapshot?.missingCount} Legacy`}
                    </span>
                  </div>
                  <p className="text-xs text-white/60">{qualityData?.indicators?.taxSnapshot?.message}</p>
                </div>

                {/* 5. Courier Waybill Tracking */}
                <div className="card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm flex items-center gap-2">
                      <FiTruck className="text-cyan-400" /> Delhivery AWB Linkage
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      qualityData?.indicators?.shippingWaybill?.status === "healthy" ? "bg-emerald-400/10 text-emerald-400" : "bg-amber-400/10 text-amber-400"
                    }`}>
                      {qualityData?.indicators?.shippingWaybill?.missingCount === 0 ? "100% Linked" : `${qualityData?.indicators?.shippingWaybill?.missingCount} Missing AWB`}
                    </span>
                  </div>
                  <p className="text-xs text-white/60">{qualityData?.indicators?.shippingWaybill?.message}</p>
                </div>

                {/* 6. Customer Account Integrity */}
                <div className="card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm flex items-center gap-2">
                      <FiUsers className="text-emerald-400" /> Customer Integrity
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-400/10 text-emerald-400">
                      {qualityData?.indicators?.customerLinkage?.missingCount === 0 ? "100% Linked" : `${qualityData?.indicators?.customerLinkage?.missingCount} Orphaned`}
                    </span>
                  </div>
                  <p className="text-xs text-white/60">{qualityData?.indicators?.customerLinkage?.message}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default AdminAnalytics
