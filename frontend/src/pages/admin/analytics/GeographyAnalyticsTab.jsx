import { useState, useEffect } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"
import { FiMapPin, FiTrendingUp, FiUsers, FiDollarSign, FiPackage, FiInfo } from "react-icons/fi"
import { adminAPI } from "../../../api"
import Loading from "../../../components/common/Loading"

const formatNumber = (value) =>
  value == null ? "—" : Number(value).toLocaleString();

const formatCurrency = (value) =>
  value == null ? "—" : `₹${Number(value).toLocaleString()}`;

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
              {p.value == null
                ? "—"
                : p.name?.toLowerCase().includes("revenue") || p.name?.toLowerCase().includes("sales")
                ? `₹${Number(p.value).toLocaleString()}`
                : Number(p.value).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function GeographyAnalyticsTab({ dateParams = {} }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeGeoView, setActiveGeoView] = useState("states") // "states" | "cities"

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await adminAPI.getGeographyAnalytics(dateParams)
      if (res.data?.success) {
        setData(res.data)
      }
    } catch (err) {
      console.error("Failed to load geography analytics:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [dateParams?.startDate, dateParams?.endDate])

  const topStatesChart = (data?.states || []).slice(0, 7).map(s => ({
    name: s.state || "Unknown",
    NetSales: s.netSales ?? s.grossRevenue ?? s.grossSales ?? 0,
    Orders: s.orders ?? s.ordersCount ?? 0
  }))

  const totalStatesCovered = data?.states?.length || 0
  const topState = data?.states?.[0] || null

  return (
    <div className="space-y-6">
      {/* Privacy Note Banner */}
      <div className="bg-dark-800/60 border border-white/5 rounded-2xl p-4 flex items-start gap-3 text-xs text-white/50">
        <FiInfo className="shrink-0 mt-0.5 text-acid" size={16} />
        <div>
          <span className="font-semibold block text-white">Geographic Aggregation & Privacy Guard</span>
          <span>
            Regional sales distributions are aggregated from delivery shipping addresses without exposing personal identifiable information (PII) or unaggregated customer data.
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Regional Reach */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs">
            <span>States & UTs Covered</span>
            <FiMapPin className="text-acid" size={16} />
          </div>
          <span className="text-2xl font-bold font-display tracking-wide text-white">
            {formatNumber(totalStatesCovered)}
          </span>
          <p className="text-[11px] text-white/30">Active shipping destinations</p>
        </div>

        {/* 2. Top Performing State */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs">
            <span>Top State by Net Sales</span>
            <FiTrendingUp className="text-emerald-400" size={16} />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-display tracking-wide text-acid truncate max-w-[140px]">
              {topState?.state || "—"}
            </span>
            <span className="text-xs text-emerald-400 font-mono">
              {topState?.netSales != null
                ? formatCurrency(topState.netSales)
                : topState?.grossRevenue != null
                ? formatCurrency(topState.grossRevenue)
                : "—"}
            </span>
          </div>
          <p className="text-[11px] text-white/30">
            {formatNumber(topState?.orders ?? topState?.ordersCount ?? 0)} orders delivered
          </p>
        </div>

        {/* 3. Unique Metro Cities */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs">
            <span>Cities & Towns Reached</span>
            <FiPackage className="text-blue-400" size={16} />
          </div>
          <span className="text-2xl font-bold font-display tracking-wide text-blue-400">
            {formatNumber(data?.cities?.length || 0)}
          </span>
          <p className="text-[11px] text-white/30">Across India</p>
        </div>

        {/* 4. Top State Customer Share */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs">
            <span>Top State Buyers</span>
            <FiUsers className="text-purple-400" size={16} />
          </div>
          <span className="text-2xl font-bold font-display tracking-wide text-purple-400">
            {formatNumber(topState?.uniqueCustomers ?? 0)}
          </span>
          <p className="text-[11px] text-white/30">Unique customers in {topState?.state || "top market"}</p>
        </div>
      </div>

      {loading ? (
        <div className="py-20"><Loading /></div>
      ) : (
        <>
          {/* Top States Revenue Chart */}
          {topStatesChart.length > 0 && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">State-Wise Net Revenue Distribution</h3>
                  <p className="text-xs text-white/40">Top revenue generating states and union territories</p>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topStatesChart} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="name" stroke="#ffffff40" fontSize={11} angle={-15} textAnchor="end" />
                    <YAxis stroke="#ffffff40" fontSize={11} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="NetSales" name="Net Sales (₹)" fill="var(--color-acid)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Subview Selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveGeoView("states")}
              className={`btn py-1.5 px-3 text-xs ${activeGeoView === "states" ? "btn-primary" : "btn-secondary"}`}
            >
              State-Wise Performance ({data?.states?.length || 0})
            </button>
            <button
              onClick={() => setActiveGeoView("cities")}
              className={`btn py-1.5 px-3 text-xs ${activeGeoView === "cities" ? "btn-primary" : "btn-secondary"}`}
            >
              City-Wise Performance ({data?.cities?.length || 0})
            </button>
          </div>

          {/* Table: States */}
          {activeGeoView === "states" && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/5 text-white/40 font-mono">
                      <th className="py-3 px-4">State / Region</th>
                      <th className="py-3 px-3 text-right">Orders</th>
                      <th className="py-3 px-3 text-right">Units</th>
                      <th className="py-3 px-3 text-right">Gross Revenue</th>
                      <th className="py-3 px-3 text-right text-acid font-bold">Net Sales</th>
                      <th className="py-3 px-3 text-right">Unique Customers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {(data?.states || []).length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-12 text-center text-white/30 font-sans">
                          No state records found.
                        </td>
                      </tr>
                    ) : (
                      data.states.map((s, i) => (
                        <tr key={s.state || i} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 font-bold text-white font-sans">{s.state || "Unknown"}</td>
                          <td className="py-3 px-3 text-right">{formatNumber(s.orders ?? s.ordersCount)}</td>
                          <td className="py-3 px-3 text-right text-white/80">{formatNumber(s.unitsSold ?? s.totalUnits)}</td>
                          <td className="py-3 px-3 text-right text-white/80">{formatCurrency(s.grossRevenue ?? s.grossSales)}</td>
                          <td className="py-3 px-3 text-right text-acid font-bold">{formatCurrency(s.netSales)}</td>
                          <td className="py-3 px-3 text-right text-purple-400">{formatNumber(s.uniqueCustomers)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table: Cities */}
          {activeGeoView === "cities" && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/5 text-white/40 font-mono">
                      <th className="py-3 px-4">City</th>
                      <th className="py-3 px-3">State</th>
                      <th className="py-3 px-3 text-right">Orders</th>
                      <th className="py-3 px-3 text-right text-acid font-bold">Revenue</th>
                      <th className="py-3 px-3 text-right">Units Sold</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {(data?.cities || []).length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-white/30 font-sans">
                          No city records found.
                        </td>
                      </tr>
                    ) : (
                      data.cities.map((c, i) => (
                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 font-bold text-white font-sans">{c.city || "Unknown"}</td>
                          <td className="py-3 px-3 text-white/60 font-sans">{c.state || "—"}</td>
                          <td className="py-3 px-3 text-right">{formatNumber(c.orders ?? c.ordersCount)}</td>
                          <td className="py-3 px-3 text-right text-acid font-bold">{formatCurrency(c.revenue ?? c.netSales)}</td>
                          <td className="py-3 px-3 text-right text-purple-400">{formatNumber(c.unitsSold ?? c.uniqueCustomers)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
