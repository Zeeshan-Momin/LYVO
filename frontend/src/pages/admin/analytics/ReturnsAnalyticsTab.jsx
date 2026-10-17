import { useState, useEffect } from "react"
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"
import {
  FiRotateCcw, FiDollarSign, FiAlertTriangle, FiCheckCircle, FiInfo, FiTag
} from "react-icons/fi"
import { adminAPI } from "../../../api"
import Loading from "../../../components/common/Loading"

const COLORS = ["#FF3A1A", "#FFD166", "#60a5fa", "#a78bfa", "#22d3ee", "#f472b6", "#34d399"]

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
              {p.name.toLowerCase().includes("value") || p.name.toLowerCase().includes("refund")
                ? `₹${Number(p.value).toLocaleString()}`
                : Number(p.value).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ReturnsAnalyticsTab({ dateParams }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await adminAPI.getReturnsAnalytics(dateParams)
      if (res.data?.success) {
        setData(res.data)
      }
    } catch (err) {
      console.error("Failed to load returns analytics:", err)
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
      {/* Return Policy & Separation Banner */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-300">
        <FiInfo className="shrink-0 mt-0.5 text-amber-400" size={16} />
        <div>
          <span className="font-semibold block text-white">Customer Return vs Pre-Dispatch Cancellation Separation</span>
          <span>
            Analytics separates post-delivery genuine returns ({kpis.approvedReturnsCount || 0} approved) from pre-dispatch customer cancellations ({kpis.cancellationsCount || 0} cancelled). Return rate is calculated against delivered orders.
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Return Requests */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs">
            <span>Return Requests</span>
            <FiRotateCcw className="text-amber-400" size={16} />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-display tracking-wide text-amber-400">
              {kpis.returnRequestsCount || 0}
            </span>
            <span className="text-xs text-emerald-400 font-mono">
              {kpis.approvedReturnsCount || 0} approved
            </span>
          </div>
          <p className="text-[11px] text-white/30">Total customer return tickets</p>
        </div>

        {/* 2. Order Return Rate */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs">
            <span>Order Return Rate (Delivered)</span>
            <FiAlertTriangle className="text-rose-400" size={16} />
          </div>
          <span className="text-2xl font-bold font-display tracking-wide text-rose-400">
            {kpis.orderReturnRate !== undefined ? kpis.orderReturnRate : kpis.overallReturnRate || 0}%
          </span>
          <p className="text-[11px] text-white/30">Approved returns relative to delivered orders</p>
        </div>

        {/* 3. Refunded Orders Count */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs">
            <span>Refunded Orders</span>
            <FiCheckCircle className="text-purple-400" size={16} />
          </div>
          <span className="text-2xl font-bold font-display tracking-wide text-white">
            {kpis.refundedOrdersCount || 0}
          </span>
          <p className="text-[11px] text-white/30">Orders with issued refunds</p>
        </div>

        {/* 4. Total Refunded Value */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs">
            <span>Total Refunded Value</span>
            <FiDollarSign className="text-rose-400" size={16} />
          </div>
          <span className="text-2xl font-bold font-display tracking-wide text-rose-400">
            ₹{(kpis.totalRefundedValue || 0).toLocaleString()}
          </span>
          <p className="text-[11px] text-white/30">Gross refunded funds returned to buyers</p>
        </div>
      </div>

      {loading ? (
        <div className="py-20"><Loading /></div>
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Return Reasons Breakdown */}
            <div className="card p-5 space-y-4">
              <h3 className="font-bold text-sm">Customer Return Reasons</h3>
              <p className="text-xs text-white/40">Primary causes cited by buyers during return initiation</p>
              <div className="h-56 w-full flex items-center justify-center">
                {(data?.returnReasons || []).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.returnReasons}
                        dataKey="count"
                        nameKey="_id"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={50}
                        paddingAngle={3}
                      >
                        {data.returnReasons.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <span className="text-white/30 text-xs">No return reason telemetry recorded</span>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-3 text-xs pt-2">
                {(data?.returnReasons || []).map((rr, i) => (
                  <div key={rr._id} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-white/60">{rr._id || "Other / Unspecified"}:</span>
                    <span className="font-semibold text-white">{rr.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Return Rates Bar Chart */}
            <div className="card p-5 space-y-4">
              <h3 className="font-bold text-sm">Category Unit Return Rates</h3>
              <p className="text-xs text-white/40">Unit return percentage (Returned Units / Units Sold) across categories</p>
              <div className="h-56 w-full">
                {(data?.categoryReturns || []).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.categoryReturns} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis dataKey="category" stroke="#ffffff40" fontSize={11} />
                      <YAxis stroke="#ffffff40" fontSize={11} tickFormatter={v => `${v}%`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="unitReturnRate" name="Unit Return Rate (%)" fill="#FF3A1A" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-white/30 text-xs">
                    No category return data available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Category Returns Detailed Table */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h3 className="font-bold text-sm">Category-Wise Return & Refund Value</h3>
              <p className="text-xs text-white/40">Units returned and financial refund totals by category</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/5 text-white/40 font-mono">
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-3 text-right">Units Sold</th>
                    <th className="py-3 px-3 text-right text-rose-400">Returned Units</th>
                    <th className="py-3 px-3 text-right text-rose-400 font-bold" title="Returned Units / Units Sold × 100">Unit Return Rate</th>
                    <th className="py-3 px-3 text-right">Refund Value (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {(data?.categoryReturns || []).length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-12 text-center text-white/30 font-sans">
                        No return records in this date window.
                      </td>
                    </tr>
                  ) : (
                    data.categoryReturns.map(cr => {
                      const rate = cr.unitReturnRate !== undefined ? cr.unitReturnRate : cr.returnRate;
                      return (
                        <tr key={cr.category} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 font-bold text-white font-sans">{cr.category}</td>
                          <td className="py-3 px-3 text-right">{cr.unitsSold}</td>
                          <td className="py-3 px-3 text-right text-rose-400">{cr.returnedUnits}</td>
                          <td className="py-3 px-3 text-right text-rose-400 font-bold">{rate}%</td>
                          <td className="py-3 px-3 text-right text-white/80">₹{cr.refundValue.toLocaleString()}</td>
                        </tr>
                      );
                    })
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
