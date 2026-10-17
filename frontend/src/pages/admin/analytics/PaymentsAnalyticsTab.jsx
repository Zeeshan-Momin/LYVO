import { useState, useEffect } from "react"
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"
import {
  FiCreditCard, FiDollarSign, FiCheckCircle, FiAlertCircle, FiInfo, FiRotateCcw
} from "react-icons/fi"
import { adminAPI } from "../../../api"
import Loading from "../../../components/common/Loading"

const COLORS = ["var(--color-acid)", "#60a5fa", "#FFD166", "#FF3A1A", "#a78bfa"]

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
              {p.name.toLowerCase().includes("revenue") || p.name.toLowerCase().includes("value") || p.name.toLowerCase().includes("sales")
                ? `₹${Number(p.value).toLocaleString()}`
                : Number(p.value).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PaymentsAnalyticsTab({ dateParams }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await adminAPI.getPaymentAnalytics(dateParams)
      if (res.data?.success) {
        setData(res.data)
      }
    } catch (err) {
      console.error("Failed to load payment analytics:", err)
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
      {/* Gateway Settlement Disclaimer Banner */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-300">
        <FiInfo className="shrink-0 mt-0.5 text-amber-400" size={16} />
        <div>
          <span className="font-semibold block text-white">Payment Reconciliation Status: Not Reconciled</span>
          <span>
            Payment metrics reflect checkout orders and gateway transaction records. Gateway processing MDR fees, GST on transaction fees, and bank account settlement dates are not fabricated and will be ingested via Razorpay Settlement APIs in Phase 3.
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Paid Orders Volume */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs">
            <span>Paid Orders</span>
            <FiCheckCircle className="text-emerald-400" size={16} />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-display tracking-wide text-emerald-400">
              {kpis.paidOrdersCount || 0}
            </span>
            <span className="text-xs text-white/40 font-mono">
              of {kpis.totalOrders || 0} total
            </span>
          </div>
          <p className="text-[11px] text-white/30">Successfully captured payments</p>
        </div>

        {/* 2. Paid Realized Value */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs">
            <span>Collected Revenue</span>
            <FiDollarSign className="text-acid" size={16} />
          </div>
          <span className="text-2xl font-bold font-display tracking-wide text-acid">
            ₹{(kpis.totalPaidRevenue || 0).toLocaleString()}
          </span>
          <p className="text-[11px] text-white/30">Gross captured payment value</p>
        </div>

        {/* 3. Pending / Unpaid Orders */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs">
            <span>Unpaid / COD Pending</span>
            <FiAlertCircle className="text-amber-400" size={16} />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-display tracking-wide text-amber-400">
              {kpis.unpaidOrdersCount || 0}
            </span>
            <span className="text-xs text-amber-400 font-mono">
              ₹{(kpis.totalUnpaidRevenue || 0).toLocaleString()}
            </span>
          </div>
          <p className="text-[11px] text-white/30">COD awaiting delivery or pending</p>
        </div>

        {/* 4. Refunded Amount */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs">
            <span>Refunded Value</span>
            <FiRotateCcw className="text-rose-400" size={16} />
          </div>
          <span className="text-2xl font-bold font-display tracking-wide text-rose-400">
            ₹{(kpis.totalRefundedValue || 0).toLocaleString()}
          </span>
          <p className="text-[11px] text-white/30">Total funds reversed to customers</p>
        </div>
      </div>

      {loading ? (
        <div className="py-20"><Loading /></div>
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment Method Share */}
            <div className="card p-5 space-y-4">
              <h3 className="font-bold text-sm">Payment Method Share (Orders)</h3>
              <div className="h-56 w-full flex items-center justify-center">
                {(data?.paymentMethods || []).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.paymentMethods}
                        dataKey="ordersCount"
                        nameKey="method"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={50}
                        paddingAngle={3}
                      >
                        {data.paymentMethods.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <span className="text-white/30 text-xs">No payment records</span>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-4 text-xs pt-2">
                {(data?.paymentMethods || []).map((pm, i) => (
                  <div key={pm.method} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-white/60 uppercase font-mono">{pm.method}:</span>
                    <span className="font-semibold text-white">{pm.ordersCount} orders</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Paid vs Unpaid Value Comparison */}
            <div className="card p-5 space-y-4">
              <h3 className="font-bold text-sm">Payment Status Distribution</h3>
              <p className="text-xs text-white/40">Realized captured funds vs pending COD receivables</p>
              <div className="space-y-3 pt-2">
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FiCheckCircle className="text-emerald-400" size={16} />
                    <span className="font-semibold text-white">Paid & Captured</span>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-emerald-400 font-mono text-sm">
                      ₹{(kpis.totalPaidRevenue || 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-white/40">{kpis.paidOrdersCount || 0} orders</span>
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FiAlertCircle className="text-amber-400" size={16} />
                    <span className="font-semibold text-white">Unpaid / COD Pending</span>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-amber-400 font-mono text-sm">
                      ₹{(kpis.totalUnpaidRevenue || 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-white/40">{kpis.unpaidOrdersCount || 0} orders</span>
                  </div>
                </div>

                <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FiRotateCcw className="text-rose-400" size={16} />
                    <span className="font-semibold text-white">Refunded Capital</span>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-rose-400 font-mono text-sm">
                      ₹{(kpis.totalRefundedValue || 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-white/40">Gross reversals</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method Details Table */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <FiCreditCard className="text-acid" /> Gateway & Payment Method Financial Performance
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/5 text-white/40 font-mono">
                    <th className="py-3 px-4">Method / Channel</th>
                    <th className="py-3 px-3 text-right">Orders</th>
                    <th className="py-3 px-3 text-right">Gross Sales (₹)</th>
                    <th className="py-3 px-3 text-right">Product Discounts (₹)</th>
                    <th className="py-3 px-3 text-right">Coupon Discounts (₹)</th>
                    <th className="py-3 px-3 text-right text-acid font-bold">Net Sales (₹)</th>
                    <th className="py-3 px-3 text-right text-rose-400">Refunds (₹)</th>
                    <th className="py-3 px-3 text-center">Settlement Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {(data?.paymentMethods || []).length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-white/30 font-sans">
                        No payment records found for this period.
                      </td>
                    </tr>
                  ) : (
                    data.paymentMethods.map(pm => (
                      <tr key={pm.method} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-bold text-white uppercase font-sans">
                          {pm.method}
                        </td>
                        <td className="py-3 px-3 text-right">{pm.ordersCount}</td>
                        <td className="py-3 px-3 text-right text-white/80">₹{pm.grossMerchandiseSales.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-rose-400">
                          {pm.productDiscounts > 0 ? `-₹${pm.productDiscounts.toLocaleString()}` : "—"}
                        </td>
                        <td className="py-3 px-3 text-right text-rose-400">
                          {pm.couponDiscounts > 0 ? `-₹${pm.couponDiscounts.toLocaleString()}` : "—"}
                        </td>
                        <td className="py-3 px-3 text-right text-acid font-bold">₹{pm.netSales.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right text-rose-400">
                          {pm.refundValue > 0 ? `₹${pm.refundValue.toLocaleString()}` : "—"}
                        </td>
                        <td className="py-3 px-3 text-center font-sans">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-white/50">
                            Not reconciled
                          </span>
                        </td>
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
