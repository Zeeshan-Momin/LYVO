import { useState, useEffect } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"
import {
  FiShoppingBag, FiDollarSign, FiRotateCcw, FiPackage,
  FiSearch, FiFilter, FiCheckCircle, FiAlertTriangle, FiArrowUp, FiArrowDown, FiSliders
} from "react-icons/fi"
import { adminAPI } from "../../../api"
import Loading from "../../../components/common/Loading"

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
              {p.name.toLowerCase().includes("revenue") || p.name.toLowerCase().includes("sales") || p.name.toLowerCase().includes("value")
                ? `₹${Number(p.value).toLocaleString()}`
                : Number(p.value).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ProductsAnalyticsTab({ dateParams }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState("")
  const [gender, setGender] = useState("")
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState("grossMerchandiseSales")
  const [sortDir, setSortDir] = useState("desc")
  const [lowStockThreshold, setLowStockThreshold] = useState(5)
  const [page, setPage] = useState(1)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await adminAPI.getProductAnalytics({
        ...dateParams,
        category: category || undefined,
        gender: gender || undefined,
        search: search || undefined,
        sortBy,
        sortDir,
        page,
        limit: 15,
        lowStockThreshold
      })
      if (res.data?.success) {
        setData(res.data)
      }
    } catch (err) {
      console.error("Failed to load product analytics:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [dateParams.startDate, dateParams.endDate, category, gender, sortBy, sortDir, page, lowStockThreshold])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setPage(1)
    fetchData()
  }

  const chartData = (data?.products || []).slice(0, 6).map(p => ({
    name: p.productName?.length > 14 ? p.productName.substring(0, 14) + "..." : p.productName,
    GMS: p.grossMerchandiseSales,
    NetSales: p.netSales,
    Units: p.unitsSold
  }))

  const getStatusBadge = (status) => {
    switch (status) {
      case "In Stock":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-400/10 text-emerald-400">In Stock</span>
      case "Low Stock":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-400/10 text-amber-400">Low Stock (&le;{lowStockThreshold})</span>
      case "Out of Stock":
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-400/10 text-rose-400">Out of Stock</span>
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-white/60">{status}</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Filter & Search Bar with Configurable Low-Stock Threshold */}
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
              onChange={e => { setLowStockThreshold(Number(e.target.value)); setPage(1); }}
              className="bg-transparent text-white font-mono font-bold focus:outline-none text-xs"
            >
              <option value="3">3 units</option>
              <option value="5">5 units</option>
              <option value="10">10 units</option>
              <option value="15">15 units</option>
            </select>
          </div>

          <select
            value={category}
            onChange={e => { setCategory(e.target.value); setPage(1); }}
            className="input py-1.5 px-2.5 text-xs bg-dark-700/60 border-white/10"
          >
            <option value="">All Categories</option>
            <option value="Sneakers">Sneakers</option>
            <option value="Loafers">Loafers</option>
            <option value="Boots">Boots</option>
            <option value="Sliders">Sliders</option>
            <option value="Formals">Formals</option>
          </select>

          <select
            value={gender}
            onChange={e => { setGender(e.target.value); setPage(1); }}
            className="input py-1.5 px-2.5 text-xs bg-dark-700/60 border-white/10"
          >
            <option value="">All Genders</option>
            <option value="men">Men</option>
            <option value="women">Women</option>
            <option value="unisex">Unisex</option>
          </select>

          <select
            value={sortBy}
            onChange={e => { setSortBy(e.target.value); setPage(1); }}
            className="input py-1.5 px-2.5 text-xs bg-dark-700/60 border-white/10"
          >
            <option value="grossMerchandiseSales">Sort by GMS</option>
            <option value="netSales">Sort by Net Sales</option>
            <option value="unitsSold">Sort by Units Sold</option>
            <option value="unitReturnRate">Sort by Unit Return Rate</option>
            <option value="currentStock">Sort by Current Stock</option>
          </select>

          <button
            onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
            className="btn btn-secondary py-1.5 px-2.5 text-xs flex items-center gap-1"
            title={`Sort ${sortDir === "desc" ? "Descending" : "Ascending"}`}
          >
            {sortDir === "desc" ? <FiArrowDown size={13} /> : <FiArrowUp size={13} />}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20"><Loading /></div>
      ) : (
        <>
          {/* Top Performance Chart */}
          {chartData.length > 0 && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">Top Products: Gross Sales vs Net Sales</h3>
                  <p className="text-xs text-white/40">Compares gross merchandise sales against net sales after returns and discounts</p>
                </div>
                <span className="text-[11px] font-mono text-white/40">Showing top {chartData.length} items</span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="name" stroke="#ffffff40" fontSize={11} angle={-15} textAnchor="end" />
                    <YAxis stroke="#ffffff40" fontSize={11} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="GMS" name="Gross Sales" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="NetSales" name="Net Sales" fill="var(--color-acid)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Detailed Product Performance Table */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Product Performance & Financial Breakdown</h3>
                <p className="text-xs text-white/40">Calculated strictly from immutable historical order item snapshots</p>
              </div>
              <span className="text-xs font-mono text-white/50">
                Total: {data?.pagination?.total || 0} products
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/5 text-white/40 font-mono">
                    <th className="py-3 px-4">Product / SKU</th>
                    <th className="py-3 px-3 text-right">Units</th>
                    <th className="py-3 px-3 text-right">GMS</th>
                    <th className="py-3 px-3 text-right">Discounts</th>
                    <th className="py-3 px-3 text-right text-acid font-bold">Net Sales</th>
                    <th className="py-3 px-3 text-right" title="Returned Units / Units Sold × 100">Unit Return Rate</th>
                    <th className="py-3 px-3 text-right">Stock</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Gross Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(data?.products || []).length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-white/30">
                        No product sales found matching the active filters and date range.
                      </td>
                    </tr>
                  ) : (
                    data.products.map(p => {
                      const returnRateVal = p.unitReturnRate !== undefined ? p.unitReturnRate : p.returnRate;
                      return (
                        <tr key={p.productId || p.productName} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {p.image ? (
                                <img src={p.image} alt={p.productName} className="w-9 h-9 rounded-lg object-cover bg-dark-700" />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-dark-700 flex items-center justify-center text-white/30">
                                  <FiPackage size={16} />
                                </div>
                              )}
                              <div>
                                <span className="font-semibold text-white block max-w-[200px] truncate">{p.productName}</span>
                                <div className="flex items-center gap-2 text-[10px] text-white/40 font-mono">
                                  <span>{p.sku || "NO-SKU"}</span>
                                  <span>•</span>
                                  <span>{p.category}</span>
                                  <span>•</span>
                                  <span className="capitalize">{p.gender}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-medium">
                            {p.unitsSold}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-white/80">
                            ₹{p.grossMerchandiseSales.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-rose-400/80">
                            {p.totalDiscounts > 0 ? `-₹${p.totalDiscounts.toLocaleString()}` : "—"}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-acid">
                            ₹{p.netSales.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            {returnRateVal > 0 ? (
                              <span className="text-amber-400">{returnRateVal}% <span className="text-white/30">({p.refundQuantity})</span></span>
                            ) : (
                              <span className="text-white/30">0%</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            <span className={p.currentStock <= lowStockThreshold ? "text-amber-400 font-bold" : "text-white/80"}>
                              {p.currentStock}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {getStatusBadge(p.healthTag || p.inventoryStatus)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            {p.grossProfit !== null ? (
                              <div>
                                <span className="font-semibold text-emerald-400">₹{p.grossProfit.toLocaleString()}</span>
                                <span className="block text-[10px] text-white/40">({p.grossMargin}%)</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-white/30" title="COGS baseline missing on some units">
                                Incomplete
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {data?.pagination?.pages > 1 && (
              <div className="p-4 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-white/40">
                  Page {data.pagination.page} of {data.pagination.pages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={data.pagination.page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="btn btn-secondary py-1 px-3 text-xs disabled:opacity-30"
                  >
                    Previous
                  </button>
                  <button
                    disabled={data.pagination.page >= data.pagination.pages}
                    onClick={() => setPage(p => p + 1)}
                    className="btn btn-secondary py-1 px-3 text-xs disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
