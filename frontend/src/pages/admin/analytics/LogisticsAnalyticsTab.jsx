import { useState, useEffect } from "react"
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"
import {
  FiTruck, FiCheckCircle, FiClock, FiAlertTriangle, FiRotateCcw, FiInfo, FiMapPin
} from "react-icons/fi"
import { adminAPI } from "../../../api"
import Loading from "../../../components/common/Loading"

const COLORS = ["#34d399", "#60a5fa", "#FFD166", "#FF3A1A", "#a78bfa", "#22d3ee", "#f472b6"]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-800/95 border border-white/10 backdrop-blur-md rounded-xl px-4 py-3 text-xs shadow-2xl min-w-[160px]">
      <p className="text-white/40 mb-2 font-mono text-[11px]">{label || payload[0]?.name}</p>
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
              <span className="text-white/70">{p.name}:</span>
            </div>
            <span className="font-semibold text-white">
              {Number(p.value).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LogisticsAnalyticsTab({ dateParams }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await adminAPI.getShippingAnalytics(dateParams)
      if (res.data?.success) {
        setData(res.data)
      }
    } catch (err) {
      console.error("Failed to load logistics analytics:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [dateParams.startDate, dateParams.endDate])

  const kpis = data?.summary || {}

  return (
    <div className="space-y-6">
      {/* Delhivery Invoice Reconciliation Disclaimer Banner */}
      <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 flex items-start gap-3 text-xs text-purple-300">
        <FiInfo className="shrink-0 mt-0.5 text-purple-400" size={16} />
        <div>
          <span className="font-semibold block text-white">Courier Logistics & Reconciliation Separation</span>
          <span>
            Telemetry tracks operational fulfillment states and Delhivery tracking waybills. Customer shipping fees are recorded as order line items. Actual freight bill invoices from Delhivery will be reconciled in Phase 3.
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Shipped / Dispatched */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs">
            <span>Orders Dispatched</span>
            <FiTruck className="text-blue-400" size={16} />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-display tracking-wide text-white">
              {kpis.totalShipped || 0}
            </span>
            <span className="text-xs text-emerald-400 font-mono">
              {kpis.totalDelivered || 0} delivered
            </span>
          </div>
          <p className="text-[11px] text-white/30">Total parcels handed over to courier</p>
        </div>

        {/* 2. Delivery Success Rate */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs">
            <span>Delivery Success Rate</span>
            <FiCheckCircle className="text-emerald-400" size={16} />
          </div>
          <span className="text-2xl font-bold font-display tracking-wide text-emerald-400">
            {kpis.deliverySuccessRate || 0}%
          </span>
          <p className="text-[11px] text-white/30">Delivered vs dispatched parcels</p>
        </div>

        {/* 3. In Transit / Pending */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs">
            <span>In Transit / Pending</span>
            <FiClock className="text-amber-400" size={16} />
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold font-display tracking-wide text-amber-400">
              {kpis.inTransit || 0}
            </span>
            <span className="text-xs text-white/40 font-mono">
              ({kpis.pendingDispatches || 0} unfulfilled)
            </span>
          </div>
          <p className="text-[11px] text-white/30">Currently on the road with carrier</p>
        </div>

        {/* 4. Courier RTO Rate */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs">
            <span>Courier RTO Rate (Dispatched)</span>
            <FiRotateCcw className="text-rose-400" size={16} />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-display tracking-wide text-rose-400">
              {kpis.rtoRate || 0}%
            </span>
            <span className="text-xs text-white/40 font-mono">
              {kpis.rto || 0} returned
            </span>
          </div>
          <p className="text-[11px] text-white/30">RTO shipments / Dispatched parcels</p>
        </div>
      </div>

      {loading ? (
        <div className="py-20"><Loading /></div>
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fulfillment Status Distribution */}
            <div className="card p-5 space-y-4">
              <h3 className="font-bold text-sm">Fulfillment Status Breakdown</h3>
              <div className="h-56 w-full flex items-center justify-center">
                {(data?.statusDistribution || []).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.statusDistribution}
                        dataKey="count"
                        nameKey="_id"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={50}
                        paddingAngle={3}
                      >
                        {data.statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <span className="text-white/30 text-xs">No fulfillment data</span>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-3 text-xs pt-2">
                {(data?.statusDistribution || []).map((st, i) => (
                  <div key={st._id} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-white/60 capitalize">{st._id}:</span>
                    <span className="font-semibold text-white">{st.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Delhivery Live Courier Statuses */}
            <div className="card p-5 space-y-4">
              <h3 className="font-bold text-sm">Delhivery Courier Status Telemetry</h3>
              <p className="text-xs text-white/40">Status returned by Delhivery AWB webhooks</p>
              <div className="space-y-3 pt-2">
                {(data?.delhiveryStatusBreakdown || []).length === 0 ? (
                  <div className="py-8 text-center text-white/30 text-xs">
                    No active Delhivery shipment waybills found for this period.
                  </div>
                ) : (
                  data.delhiveryStatusBreakdown.map((ds, i) => (
                    <div key={i} className="flex items-center justify-between bg-dark-700/40 p-3 rounded-xl text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        <span className="font-medium text-white capitalize">{ds._id || "Dispatched / Manifested"}</span>
                      </div>
                      <span className="font-mono font-bold text-white/80">{ds.count} parcels</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* State-Level Shipping Performance Table */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <FiMapPin className="text-acid" /> State-Wise Shipping & Delivery Performance
              </h3>
              <p className="text-xs text-white/40">Transit volume, delivery completions, and RTO rates by destination state</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/5 text-white/40 font-mono">
                    <th className="py-3 px-4">Destination State</th>
                    <th className="py-3 px-3 text-right">Orders Shipped</th>
                    <th className="py-3 px-3 text-right">Delivered</th>
                    <th className="py-3 px-3 text-right text-emerald-400">Success Rate</th>
                    <th className="py-3 px-3 text-right text-rose-400">RTO Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {(data?.statePerformance || []).length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-12 text-center text-white/30 font-sans">
                        No state shipping records found for this period.
                      </td>
                    </tr>
                  ) : (
                    data.statePerformance.map(sp => (
                      <tr key={sp.state} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-bold text-white font-sans">{sp.state}</td>
                        <td className="py-3 px-3 text-right">{sp.totalOrders}</td>
                        <td className="py-3 px-3 text-right text-emerald-400">{sp.delivered}</td>
                        <td className="py-3 px-3 text-right text-emerald-400 font-bold">{sp.deliverySuccessRate}%</td>
                        <td className="py-3 px-3 text-right text-rose-400">{sp.rtoCount}</td>
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
  )
}
