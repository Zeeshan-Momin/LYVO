import { useState, useEffect } from "react"
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"
import { FiLayers, FiTag, FiRotateCcw, FiShoppingBag, FiSearch } from "react-icons/fi"
import { adminAPI } from "../../../api"
import Loading from "../../../components/common/Loading"

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
              {p.name.toLowerCase().includes("revenue") || p.name.toLowerCase().includes("sales")
                ? `₹${Number(p.value).toLocaleString()}`
                : Number(p.value).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SizeColorAnalyticsTab({ dateParams }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState("")
  const [gender, setGender] = useState("")
  const [search, setSearch] = useState("")
  const [activeSubView, setActiveSubView] = useState("sizes") // "sizes" | "colors" | "combinations"

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await adminAPI.getSizeColorAnalytics({
        ...dateParams,
        category: category || undefined,
        gender: gender || undefined,
        search: search || undefined
      })
      if (res.data?.success) {
        setData(res.data)
      }
    } catch (err) {
      console.error("Failed to load size/color analytics:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [dateParams.startDate, dateParams.endDate, category, gender])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    fetchData()
  }

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-dark-800/80 p-4 rounded-2xl border border-white/5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubView("sizes")}
            className={`btn py-1.5 px-3 text-xs ${activeSubView === "sizes" ? "btn-primary" : "btn-secondary"}`}
          >
            Size Performance
          </button>
          <button
            onClick={() => setActiveSubView("colors")}
            className={`btn py-1.5 px-3 text-xs ${activeSubView === "colors" ? "btn-primary" : "btn-secondary"}`}
          >
            Color Performance
          </button>
          <button
            onClick={() => setActiveSubView("combinations")}
            className={`btn py-1.5 px-3 text-xs ${activeSubView === "combinations" ? "btn-primary" : "btn-secondary"}`}
          >
            Product Variants
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearchSubmit} className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={13} />
            <input
              type="text"
              placeholder="Search product..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-8 pr-3 py-1.5 text-xs w-44 bg-dark-700/60 border-white/10"
            />
          </form>

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
          {/* SUBVIEW 1: SIZES */}
          {activeSubView === "sizes" && (
            <div className="space-y-6">
              {/* Size Demand Chart */}
              {(data?.sizes || []).length > 0 && (
                <div className="card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm">Units Sold by Shoe Size</h3>
                      <p className="text-xs text-white/40">Historical units sold and return rates across sizes</p>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.sizes} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis dataKey="size" stroke="#ffffff40" fontSize={11} />
                        <YAxis stroke="#ffffff40" fontSize={11} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="unitsSold" name="Units Sold" fill="var(--color-acid)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="refundQuantity" name="Returned Units" fill="#FF3A1A" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Size Table */}
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-white/5">
                  <h3 className="font-bold text-sm">Size-Level Sales & Return Rates</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white/[0.02] border-b border-white/5 text-white/40 font-mono">
                        <th className="py-3 px-4">Size</th>
                        <th className="py-3 px-3 text-right">Units Sold</th>
                        <th className="py-3 px-3 text-right">Gross Sales</th>
                        <th className="py-3 px-3 text-right text-acid font-bold">Net Sales</th>
                        <th className="py-3 px-3 text-right">Returns</th>
                        <th className="py-3 px-3 text-right" title="Returned Units / Units Sold × 100">Unit Return Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {(data?.sizes || []).length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-12 text-center text-white/30 font-sans">
                            No size sales recorded for the selected filter criteria.
                          </td>
                        </tr>
                      ) : (
                        data.sizes.map(s => {
                          const rate = s.unitReturnRate !== undefined ? s.unitReturnRate : s.returnRate;
                          return (
                            <tr key={s.size} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3 px-4 font-bold text-white font-sans flex items-center gap-2">
                                <span className="w-6 h-6 rounded bg-dark-700 flex items-center justify-center text-xs font-mono border border-white/10">
                                  {s.size}
                                </span>
                                UK {s.size}
                              </td>
                              <td className="py-3 px-3 text-right">{s.unitsSold}</td>
                              <td className="py-3 px-3 text-right text-white/80">₹{s.grossSales.toLocaleString()}</td>
                              <td className="py-3 px-3 text-right text-acid font-bold">₹{s.netSales.toLocaleString()}</td>
                              <td className="py-3 px-3 text-right text-rose-400">{s.refundQuantity}</td>
                              <td className="py-3 px-3 text-right">
                                <span className={rate > 15 ? "text-amber-400 font-semibold" : "text-white/60"}>
                                  {rate}%
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUBVIEW 2: COLORS */}
          {activeSubView === "colors" && (
            <div className="space-y-6">
              {/* Color Table */}
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-white/5">
                  <h3 className="font-bold text-sm">Colorway Demand & Financial Performance</h3>
                  <p className="text-xs text-white/40">Aggregated from historical customer purchases</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white/[0.02] border-b border-white/5 text-white/40 font-mono">
                        <th className="py-3 px-4">Colorway</th>
                        <th className="py-3 px-3 text-right">Units Sold</th>
                        <th className="py-3 px-3 text-right">Gross Sales</th>
                        <th className="py-3 px-3 text-right text-acid font-bold">Net Sales</th>
                        <th className="py-3 px-3 text-right">Returns</th>
                        <th className="py-3 px-3 text-right" title="Returned Units / Units Sold × 100">Unit Return Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {(data?.colors || []).length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-12 text-center text-white/30 font-sans">
                            No colorway data recorded for the selected filter criteria.
                          </td>
                        </tr>
                      ) : (
                        data.colors.map(c => {
                          const rate = c.unitReturnRate !== undefined ? c.unitReturnRate : c.returnRate;
                          return (
                            <tr key={c.color} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3 px-4 font-bold text-white font-sans flex items-center gap-2">
                                <span className="w-3.5 h-3.5 rounded-full border border-white/20 bg-dark-600" />
                                {c.color}
                              </td>
                              <td className="py-3 px-3 text-right">{c.unitsSold}</td>
                              <td className="py-3 px-3 text-right text-white/80">₹{c.grossSales.toLocaleString()}</td>
                              <td className="py-3 px-3 text-right text-acid font-bold">₹{c.netSales.toLocaleString()}</td>
                              <td className="py-3 px-3 text-right text-rose-400">{c.refundQuantity}</td>
                              <td className="py-3 px-3 text-right">
                                <span className={rate > 15 ? "text-amber-400 font-semibold" : "text-white/60"}>
                                  {rate}%
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUBVIEW 3: COMBINATIONS */}
          {activeSubView === "combinations" && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-white/5">
                <h3 className="font-bold text-sm">Product Variant Breakdown (Product + Size + Color)</h3>
                <p className="text-xs text-white/40">Granular SKU and variant performance</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/5 text-white/40 font-mono">
                      <th className="py-3 px-4">Product Variant</th>
                      <th className="py-3 px-3">Size</th>
                      <th className="py-3 px-3">Color</th>
                      <th className="py-3 px-3 text-right">Units Sold</th>
                      <th className="py-3 px-3 text-right text-acid font-bold">Net Sales</th>
                      <th className="py-3 px-3 text-right">Return Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(data?.combinations || []).length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-12 text-center text-white/30">
                          No variant sales found.
                        </td>
                      </tr>
                    ) : (
                      data.combinations.map((c, i) => (
                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 font-semibold text-white">
                            {c.productName}
                          </td>
                          <td className="py-3 px-3 font-mono">UK {c.size}</td>
                          <td className="py-3 px-3">{c.color}</td>
                          <td className="py-3 px-3 text-right font-mono">{c.unitsSold}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-acid">
                            ₹{c.netSales.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-white/60">
                            {c.returnRate}%
                          </td>
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
