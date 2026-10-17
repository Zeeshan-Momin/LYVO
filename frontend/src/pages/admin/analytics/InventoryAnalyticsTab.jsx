import { useState, useEffect } from "react"
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"
import {
  FiPackage, FiAlertTriangle, FiCheckCircle, FiDollarSign,
  FiSearch, FiInfo, FiLayers, FiTrendingUp, FiSliders
} from "react-icons/fi"
import { adminAPI } from "../../../api"
import Loading from "../../../components/common/Loading"

const COLORS = ["var(--color-acid)", "#60a5fa", "#FFD166", "#FF3A1A", "#a78bfa", "#22d3ee", "#f472b6", "#34d399"]

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
              {p.name.toLowerCase().includes("value")
                ? `₹${Number(p.value).toLocaleString()}`
                : Number(p.value).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function InventoryAnalyticsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState("")
  const [gender, setGender] = useState("")
  const [stockStatus, setStockStatus] = useState("")
  const [search, setSearch] = useState("")
  const [lowStockThreshold, setLowStockThreshold] = useState(5)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await adminAPI.getInventoryAnalytics({
        category: category || undefined,
        gender: gender || undefined,
        stockStatus: stockStatus || undefined,
        search: search || undefined,
        lowStockThreshold
      })
      if (res.data?.success) {
        setData(res.data)
      }
    } catch (err) {
      console.error("Failed to load inventory analytics:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [category, gender, stockStatus, lowStockThreshold])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    fetchData()
  }

  const kpis = data?.kpis || data?.summary || {}

  const getStatusBadge = (status) => {
    switch (status) {
      case "In Stock":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-400/10 text-emerald-400">In Stock</span>
      case "Low Stock":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-400/10 text-amber-400">Low Stock (&le;{kpis.lowStockThreshold || lowStockThreshold})</span>
      case "Out of Stock":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-400/10 text-rose-400">Out of Stock</span>
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-white/60">{status}</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* Historical Movement Disclaimer Banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-start gap-3 text-xs text-blue-300">
        <FiInfo className="shrink-0 mt-0.5 text-blue-400" size={16} />
        <div>
          <span className="font-semibold block text-white">Live Inventory State Telemetry</span>
          <span>
            Current inventory quantities and stock valuation reflect live catalog levels. Historical daily stock movements and inwarding histories are not fabricated and require a future ERP stock-ledger integration.
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Stock in Warehouse */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs">
            <span>Total Units in Stock</span>
            <FiPackage className="text-acid" size={16} />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-display tracking-wide text-white">
              {(kpis.totalUnitsInStock || 0).toLocaleString()}
            </span>
            <span className="text-xs text-white/40 font-mono">
              {kpis.totalProducts || 0} styles ({kpis.activeProducts || 0} active)
            </span>
          </div>
          <p className="text-[11px] text-white/30">Available sellable inventory</p>
        </div>

        {/* Stock Valuation at Retail */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs">
            <span>Stock Value (Retail)</span>
            <FiDollarSign className="text-emerald-400" size={16} />
          </div>
          <span className="text-2xl font-bold font-display tracking-wide text-emerald-400">
            ₹{(kpis.stockRetailValue || 0).toLocaleString()}
          </span>
          <p className="text-[11px] text-white/30">Total potential retail realization</p>
        </div>

        {/* Stock Valuation at Cost (Distinguishing Known vs Estimated vs Unknown) */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs">
            <span>Holding Cost Valuation</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
              kpis.costCoveragePercent === 100 ? "bg-emerald-400/10 text-emerald-400" : "bg-amber-400/10 text-amber-400"
            }`}>
              {kpis.costCoveragePercent || 0}% Baseline
            </span>
          </div>
          <div>
            <span className="text-2xl font-bold font-display tracking-wide text-blue-400">
              ₹{(kpis.stockCostValue || 0).toLocaleString()}
            </span>
            <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono mt-1">
              <span>Actual: ₹{(kpis.knownCostValue || 0).toLocaleString()}</span>
              <span>•</span>
              <span>Est: ₹{(kpis.estimatedCostValue || 0).toLocaleString()}</span>
            </div>
          </div>
          {kpis.unknownCostUnits > 0 && (
            <p className="text-[10px] text-rose-400 font-medium">
              ⚠️ {kpis.unknownCostUnits} units ({kpis.unknownCostStyles} styles) lack cost data
            </p>
          )}
        </div>

        {/* Stock Health Alerts */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-white/40 text-xs">
            <span>Stock Health Alerts</span>
            <FiAlertTriangle className="text-amber-400" size={16} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-amber-400 font-mono">{kpis.lowStockProducts || 0}</span>
              <span className="text-[10px] text-white/40 uppercase">Low (&le;{kpis.lowStockThreshold || lowStockThreshold})</span>
            </div>
            <span className="text-white/20">|</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-rose-400 font-mono">{kpis.outOfStockProducts || 0}</span>
              <span className="text-[10px] text-white/40 uppercase">Out (0)</span>
            </div>
          </div>
          <p className="text-[11px] text-white/30">Requires reorder or restocking</p>
        </div>
      </div>

      {/* Filter & Search Bar with Configurable Low-Stock Threshold */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-dark-800/80 p-4 rounded-2xl border border-white/5">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={14} />
            <input
              type="text"
              placeholder="Search product name or SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-9 pr-3 py-1.5 text-xs w-full bg-dark-700/60 border-white/10"
            />
          </div>
          <button type="submit" className="btn btn-secondary py-1.5 px-3 text-xs">Filter</button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Configurable Low-Stock Threshold Selector */}
          <div className="flex items-center gap-1.5 bg-dark-700/60 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs">
            <FiSliders className="text-acid" size={13} />
            <span className="text-white/40 text-[11px]">Low Stock &le;</span>
            <select
              value={lowStockThreshold}
              onChange={e => setLowStockThreshold(Number(e.target.value))}
              className="bg-transparent text-white font-mono font-bold focus:outline-none text-xs"
            >
              <option value="3">3 units</option>
              <option value="5">5 units</option>
              <option value="10">10 units</option>
              <option value="15">15 units</option>
            </select>
          </div>

          <select
            value={stockStatus}
            onChange={e => setStockStatus(e.target.value)}
            className="input py-1.5 px-2.5 text-xs bg-dark-700/60 border-white/10"
          >
            <option value="">All Stock Levels</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>

          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="input py-1.5 px-2.5 text-xs bg-dark-700/60 border-white/10"
          >
            <option value="">All Categories</option>
            <option value="Sneakers">Sneakers</option>
            <option value="Loafers">Loafers</option>
            <option value="Boots">Boots</option>
            <option value="Sliders">Sliders</option>
          </select>

          <select
            value={gender}
            onChange={e => setGender(e.target.value)}
            className="input py-1.5 px-2.5 text-xs bg-dark-700/60 border-white/10"
          >
            <option value="">All Genders</option>
            <option value="men">Men</option>
            <option value="women">Women</option>
            <option value="unisex">Unisex</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-20"><Loading /></div>
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stock by Category */}
            <div className="card p-5 space-y-4">
              <h3 className="font-bold text-sm">Stock Distribution by Category</h3>
              <div className="h-56 w-full flex items-center justify-center">
                {(data?.categoryStock || []).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.categoryStock}
                        dataKey="unitsInStock"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={50}
                        paddingAngle={3}
                      >
                        {data.categoryStock.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <span className="text-white/30 text-xs">No stock data available</span>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-3 text-xs pt-2">
                {(data?.categoryStock || []).map((cat, i) => (
                  <div key={cat.category} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-white/60">{cat.category}:</span>
                    <span className="font-semibold text-white">{cat.unitsInStock}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stock by Gender */}
            <div className="card p-5 space-y-4">
              <h3 className="font-bold text-sm">Stock Distribution by Gender</h3>
              <div className="h-56 w-full">
                {(data?.genderStock || []).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.genderStock} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis dataKey="gender" stroke="#ffffff40" fontSize={11} tickFormatter={v => v?.toUpperCase()} />
                      <YAxis stroke="#ffffff40" fontSize={11} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="unitsInStock" name="Units in Stock" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-white/30 text-xs">
                    No stock data available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Live Inventory Details Table */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Live Catalog Inventory Health</h3>
                <p className="text-xs text-white/40">Real-time stock units, sell-through velocity, and valuation</p>
              </div>
              <span className="text-xs font-mono text-white/40">
                {data?.inventory?.length || 0} styles displayed
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/5 text-white/40 font-mono">
                    <th className="py-3 px-4">Product / SKU</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-right">Available Stock</th>
                    <th className="py-3 px-3 text-right">Lifetime Sold</th>
                    <th className="py-3 px-3 text-right">Sell-Through</th>
                    <th className="py-3 px-3 text-right">Retail Value</th>
                    <th className="py-3 px-3 text-right">Cost Value</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(data?.inventory || []).length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-white/30">
                        No inventory matching the current search or filters.
                      </td>
                    </tr>
                  ) : (
                    data.inventory.map(item => (
                      <tr key={item._id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="w-8 h-8 rounded-lg object-cover bg-dark-700" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center text-white/30">
                                <FiPackage size={14} />
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-white block max-w-[200px] truncate">{item.name}</span>
                              <span className="text-[10px] text-white/40 font-mono">{item.sku || "NO-SKU"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-white/60">{item.category}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          <span className={item.totalStock === 0 ? "text-rose-400" : item.totalStock <= (kpis.lowStockThreshold || lowStockThreshold) ? "text-amber-400" : "text-white"}>
                            {item.totalStock}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-white/70">{item.soldCount}</td>
                        <td className="py-3 px-3 text-right font-mono">
                          {item.sellThroughRate > 0 ? (
                            <span className="text-acid font-medium">{item.sellThroughRate}%</span>
                          ) : (
                            <span className="text-white/30">0%</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-400 font-medium">
                          ₹{item.stockValueRetail.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-blue-400">
                          {item.costPrice !== null && item.costPriceSource !== "unknown" ? (
                            `₹${item.stockValueCost.toLocaleString()}`
                          ) : (
                            <span className="text-white/30 text-[11px]">Unknown</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {getStatusBadge(item.stockStatus)}
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
