import { useState, useEffect } from "react"
import {
  FiPackage, FiPlus, FiTrash2, FiEye, FiCheckCircle, FiX,
  FiChevronLeft, FiChevronRight, FiAlertTriangle, FiFileText,
  FiTruck, FiLayers, FiShield
} from "react-icons/fi"
import { financeAPI, productAPI } from "../../../api"
import Loading from "../../common/Loading"
import toast from "react-hot-toast"

function StatusBadge({ status }) {
  const s = status || "received"
  if (s === "received") {
    return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">Received</span>
  }
  if (s === "cancelled") {
    return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-400/10 text-rose-400 border border-rose-400/20">Cancelled</span>
  }
  return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20">{s}</span>
}

export default function StockInwardManager() {
  const [inwards, setInwards] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 })
  const [statusFilter, setStatusFilter] = useState("all")

  // Catalog products for selector
  const [productsList, setProductsList] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Modals & Details
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedInward, setSelectedInward] = useState(null)

  // Form State
  const initialFormState = {
    grnNumber: `GRN-${Date.now().toString().slice(-6)}`,
    supplierName: "",
    supplierGstin: "",
    supplierContact: "",
    invoiceNumber: "",
    invoiceDate: "",
    receivedDate: new Date().toISOString().split("T")[0],
    notes: "",
    items: [
      {
        product: "",
        sku: "",
        name: "",
        quantityReceived: "1",
        unitCost: "0",
        taxAmount: "0",
        freightShare: "0"
      }
    ]
  }
  const [formData, setFormData] = useState(initialFormState)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  const loadInwards = () => {
    setLoading(true)
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      status: statusFilter !== "all" ? statusFilter : undefined
    }
    financeAPI.getStockInwards(params)
      .then(res => {
        setInwards(res.data?.inwards || [])
        setPagination(res.data?.pagination || { page: 1, limit: 15, total: 0, pages: 1 })
      })
      .catch(err => {
        console.error("Error loading stock inwards:", err)
        toast.error(err.response?.data?.message || "Failed to load stock inwards")
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadInwards()
  }, [pagination.page, statusFilter])

  // Load products list for dropdown
  useEffect(() => {
    if (showCreateModal && productsList.length === 0) {
      setLoadingProducts(true)
      productAPI.getAll({ limit: 100 })
        .then(res => {
          setProductsList(res.data?.products || [])
        })
        .catch(err => console.error("Error loading products catalog:", err))
        .finally(() => setLoadingProducts(false))
    }
  }, [showCreateModal])

  // Item row handlers
  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product: "",
          sku: "",
          name: "",
          quantityReceived: "1",
          unitCost: "0",
          taxAmount: "0",
          freightShare: "0"
        }
      ]
    }))
  }

  const handleRemoveItem = (index) => {
    if (formData.items.length <= 1) {
      toast.error("At least one item is required in a GRN")
      return
    }
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const handleItemChange = (index, field, value) => {
    const updated = [...formData.items]
    updated[index] = { ...updated[index], [field]: value }

    // If product changed, auto-populate SKU and name
    if (field === "product") {
      const selected = productsList.find(p => p._id === value)
      if (selected) {
        updated[index].name = selected.name || ""
        updated[index].sku = selected.sku || ""
      }
    }

    setFormData(prev => ({ ...prev, items: updated }))
  }

  const calculateLandedPreview = (item) => {
    const qty = parseFloat(item.quantityReceived) || 1
    const cost = parseFloat(item.unitCost) || 0
    const tax = parseFloat(item.taxAmount) || 0
    const freight = parseFloat(item.freightShare) || 0
    return cost + (tax / qty) + (freight / qty)
  }

  const handleCreateGRN = async (e) => {
    e.preventDefault()
    setFormError("")

    if (!formData.grnNumber.trim()) {
      setFormError("GRN number is required")
      return
    }
    if (!formData.supplierName.trim()) {
      setFormError("Supplier name is required")
      return
    }
    if (formData.items.length === 0) {
      setFormError("At least one item is required")
      return
    }

    for (let i = 0; i < formData.items.length; i++) {
      const it = formData.items[i]
      if (!it.product) {
        setFormError(`Please select a catalog product for line item #${i + 1}`)
        return
      }
      const qty = parseInt(it.quantityReceived, 10)
      if (isNaN(qty) || qty <= 0) {
        setFormError(`Quantity for line item #${i + 1} must be at least 1`)
        return
      }
      const cost = parseFloat(it.unitCost)
      if (isNaN(cost) || cost < 0) {
        setFormError(`Unit cost for line item #${i + 1} cannot be negative`)
        return
      }
    }

    setFormSubmitting(true)
    try {
      const payload = {
        grnNumber: formData.grnNumber.trim().toUpperCase(),
        supplier: {
          name: formData.supplierName.trim(),
          gstin: formData.supplierGstin.trim().toUpperCase(),
          contact: formData.supplierContact.trim()
        },
        invoiceNumber: formData.invoiceNumber.trim(),
        invoiceDate: formData.invoiceDate || null,
        receivedDate: formData.receivedDate,
        notes: formData.notes,
        items: formData.items.map(it => {
          const qty = parseInt(it.quantityReceived, 10)
          const cost = parseFloat(it.unitCost)
          const tax = parseFloat(it.taxAmount) || 0
          const freight = parseFloat(it.freightShare) || 0
          const landed = cost + (tax / qty) + (freight / qty)
          return {
            product: it.product,
            sku: it.sku,
            name: it.name,
            quantityReceived: qty,
            unitCost: cost,
            taxAmount: tax,
            freightShare: freight,
            landedUnitCost: landed
          }
        })
      }

      await financeAPI.recordStockInward(payload)
      toast.success("Stock Inward GRN recorded successfully")
      setShowCreateModal(false)
      setFormData(initialFormState)
      loadInwards()
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || "Failed to record GRN")
    } finally {
      setFormSubmitting(false)
    }
  }

  // Summary computations from loaded list
  const totalUnits = inwards.reduce((acc, cur) => acc + (cur.totalQuantity || 0), 0)
  const totalLandedValue = inwards.reduce((acc, cur) => acc + (cur.totalLandedCost || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display tracking-wide">Stock Inward (Procurement GRN)</h2>
          <p className="text-xs text-white/50">Inward batch tracking, supplier invoices, and landed unit cost foundation</p>
        </div>
        <button
          onClick={() => {
            setFormData({ ...initialFormState, grnNumber: `GRN-${Date.now().toString().slice(-6)}` })
            setShowCreateModal(true)
          }}
          className="flex items-center gap-2 bg-acid text-dark-900 font-semibold px-4 py-2 rounded-xl text-xs hover:bg-acid/90 transition shadow-lg shrink-0"
        >
          <FiPlus size={16} /> Create Stock GRN
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 space-y-1 border-white/10">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>Recorded Inward Batches</span>
            <span className="text-[10px] font-mono text-acid">GRN VOUCHERS</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {pagination.total}
          </div>
          <p className="text-[10px] text-white/40">Total verified goods receipt notes</p>
        </div>

        <div className="card p-4 space-y-1 border-white/10">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>Total Units Received</span>
            <span className="text-[10px] font-mono text-blue-400">PHYSICAL INWARD</span>
          </div>
          <div className="text-2xl font-bold text-white/90">
            {totalUnits.toLocaleString()} units
          </div>
          <p className="text-[10px] text-white/40">Catalog stock intake</p>
        </div>

        <div className="card p-4 space-y-1 border-white/10">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>Total Landed Value</span>
            <span className="text-[10px] font-mono text-emerald-400">LANDED COST</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            ₹{totalLandedValue.toLocaleString()}
          </div>
          <p className="text-[10px] text-white/40">Base cost + tax + freight allocation</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-4 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-white/60">Status:</span>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
            className="input py-1.5 px-3 bg-dark-700 border-white/10 text-xs rounded-xl"
          >
            <option value="all">All Statuses</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        <div className="text-white/40 text-[11px]">
          Showing {inwards.length} of {pagination.total} GRNs
        </div>
      </div>

      {/* Inwards Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-20"><Loading /></div>
        ) : inwards.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <FiPackage size={36} className="mx-auto text-white/20" />
            <p className="text-sm text-white/60 font-medium">No stock inward records found</p>
            <p className="text-xs text-white/30">Create a new Goods Receipt Note to log supplier procurement</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-dark-700/60 text-white/40 uppercase tracking-wider font-mono text-[10px] border-b border-white/5">
                <tr>
                  <th className="py-3 px-4">GRN #</th>
                  <th className="py-3 px-4">Received Date</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Invoice Ref</th>
                  <th className="py-3 px-4 text-center">Items Count</th>
                  <th className="py-3 px-4 text-right">Total Qty</th>
                  <th className="py-3 px-4 text-right">Gross Cost (₹)</th>
                  <th className="py-3 px-4 text-right">Landed Cost (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {inwards.map(inw => (
                  <tr key={inw._id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3 px-4 font-mono font-bold text-acid">
                      {inw.grnNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-white/70 whitespace-nowrap">
                      {new Date(inw.receivedDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-white truncate max-w-[140px]">{inw.supplier?.name}</p>
                      {inw.supplier?.gstin && (
                        <p className="text-[10px] font-mono text-white/40">{inw.supplier.gstin}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-white/70 font-mono">
                      {inw.invoiceNumber || "—"}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-white/80">
                      {inw.items?.length || 0}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-white">
                      {(inw.totalQuantity || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-white/80">
                      ₹{(inw.totalGrossCost || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-400">
                      ₹{(inw.totalLandedCost || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={inw.status} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedInward(inw)}
                        title="View Line Items"
                        className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition"
                      >
                        <FiEye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-white/5 text-xs text-white/50">
            <div>Page {pagination.page} of {pagination.pages}</div>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                className="p-1.5 bg-dark-700 rounded-lg disabled:opacity-30 hover:text-white transition"
              >
                <FiChevronLeft size={16} />
              </button>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                className="p-1.5 bg-dark-700 rounded-lg disabled:opacity-30 hover:text-white transition"
              >
                <FiChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE GRN MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-dark-800 border border-white/10 rounded-2xl w-full max-w-4xl p-6 space-y-5 my-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <FiPackage className="text-acid" size={20} />
                <h3 className="font-display text-lg tracking-wide">Create Stock Inward (GRN)</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-white/40 hover:text-white">
                <FiX size={20} />
              </button>
            </div>

            {formError && (
              <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <FiAlertTriangle className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateGRN} className="space-y-4 text-xs">
              {/* Row 1: GRN & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-white/60 mb-1 font-medium">GRN Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.grnNumber}
                    onChange={e => setFormData({ ...formData, grnNumber: e.target.value.toUpperCase() })}
                    className="input w-full bg-dark-700 border-white/10 text-xs py-2 font-mono font-bold text-acid uppercase"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-1 font-medium">Received Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.receivedDate}
                    onChange={e => setFormData({ ...formData, receivedDate: e.target.value })}
                    className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-1 font-medium">Invoice Date</label>
                  <input
                    type="date"
                    value={formData.invoiceDate}
                    onChange={e => setFormData({ ...formData, invoiceDate: e.target.value })}
                    className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                  />
                </div>
              </div>

              {/* Row 2: Supplier & Invoice */}
              <div className="border-t border-white/5 pt-3">
                <p className="font-semibold text-white/80 mb-2">Supplier & Invoice Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-white/60 mb-1">Supplier Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Apparel Exports"
                      value={formData.supplierName}
                      onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
                      className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">Supplier GSTIN</label>
                    <input
                      type="text"
                      placeholder="27ABCDE1234F1Z5"
                      value={formData.supplierGstin}
                      onChange={e => setFormData({ ...formData, supplierGstin: e.target.value.toUpperCase() })}
                      className="input w-full bg-dark-700 border-white/10 text-xs py-2 font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">Contact Phone/Email</label>
                    <input
                      type="text"
                      placeholder="+91 9876543210"
                      value={formData.supplierContact}
                      onChange={e => setFormData({ ...formData, supplierContact: e.target.value })}
                      className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">Supplier Invoice #</label>
                    <input
                      type="text"
                      placeholder="SUP-INV-889"
                      value={formData.invoiceNumber}
                      onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })}
                      className="input w-full bg-dark-700 border-white/10 text-xs py-2 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Inward Items Dynamic Table */}
              <div className="border-t border-white/5 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white/80">Inward Product Line Items</p>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center gap-1.5 px-3 py-1 bg-dark-700 hover:bg-dark-600 rounded-lg text-acid text-xs font-semibold transition"
                  >
                    <FiPlus size={14} /> Add Product Line
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.items.map((item, idx) => {
                    const landedPreview = calculateLandedPreview(item)
                    return (
                      <div key={idx} className="p-3 bg-dark-700/50 border border-white/5 rounded-xl space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
                          {/* Product Dropdown */}
                          <div className="sm:col-span-2">
                            <label className="block text-white/50 text-[10px] mb-1">Product *</label>
                            {loadingProducts ? (
                              <div className="text-white/40 text-[11px]">Loading catalog...</div>
                            ) : (
                              <select
                                required
                                value={item.product}
                                onChange={e => handleItemChange(idx, "product", e.target.value)}
                                className="input w-full bg-dark-800 border-white/10 text-xs py-1.5"
                              >
                                <option value="">Select Catalog Product...</option>
                                {productsList.map(p => (
                                  <option key={p._id} value={p._id}>
                                    {p.name} {p.sku ? `(${p.sku})` : ""}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          {/* Qty Received */}
                          <div>
                            <label className="block text-white/50 text-[10px] mb-1">Qty Received *</label>
                            <input
                              type="number"
                              required
                              min="1"
                              value={item.quantityReceived}
                              onChange={e => handleItemChange(idx, "quantityReceived", e.target.value)}
                              className="input w-full bg-dark-800 border-white/10 text-xs py-1.5 font-bold"
                            />
                          </div>

                          {/* Unit Cost */}
                          <div>
                            <label className="block text-white/50 text-[10px] mb-1">Unit Cost (₹) *</label>
                            <input
                              type="number"
                              required
                              min="0"
                              step="0.01"
                              value={item.unitCost}
                              onChange={e => handleItemChange(idx, "unitCost", e.target.value)}
                              className="input w-full bg-dark-800 border-white/10 text-xs py-1.5 font-semibold text-acid"
                            />
                          </div>

                          {/* Tax Amount */}
                          <div>
                            <label className="block text-white/50 text-[10px] mb-1">Tax Total (₹)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.taxAmount}
                              onChange={e => handleItemChange(idx, "taxAmount", e.target.value)}
                              className="input w-full bg-dark-800 border-white/10 text-xs py-1.5 text-rose-400"
                            />
                          </div>

                          {/* Freight Share */}
                          <div>
                            <label className="block text-white/50 text-[10px] mb-1">Freight Share (₹)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.freightShare}
                              onChange={e => handleItemChange(idx, "freightShare", e.target.value)}
                              className="input w-full bg-dark-800 border-white/10 text-xs py-1.5 text-blue-400"
                            />
                          </div>
                        </div>

                        {/* Line summary footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                          <div className="flex items-center gap-3">
                            <span className="text-white/40">SKU: <strong className="text-white/70 font-mono">{item.sku || "—"}</strong></span>
                            <span className="text-white/40">Landed Unit Cost (Preview — server authoritative): <strong className="text-emerald-400 font-mono font-bold">₹{landedPreview.toFixed(2)}/unit</strong></span>
                          </div>
                          {formData.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-rose-400 hover:text-rose-300 flex items-center gap-1 transition"
                            >
                              <FiTrash2 size={12} /> Remove Line
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Row 4: Notes */}
              <div>
                <label className="block text-white/60 mb-1">Internal Notes</label>
                <textarea
                  rows="2"
                  placeholder="Quality notes, warehouse bay location, or batch remarks"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-xl text-white/70 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-acid text-dark-900 font-semibold rounded-xl hover:bg-acid/90 transition shadow-lg disabled:opacity-50"
                >
                  {formSubmitting ? "Recording GRN..." : "Record Inward GRN"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW INWARD DETAILS MODAL */}
      {selectedInward && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-white/10 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FiPackage className="text-acid" size={18} />
                <h3 className="font-display text-base tracking-wide">GRN #{selectedInward.grnNumber}</h3>
              </div>
              <button onClick={() => setSelectedInward(null)} className="text-white/40 hover:text-white">
                <FiX size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-dark-700/30 p-3 rounded-xl border border-white/5">
              <div>
                <span className="text-white/40 block text-[10px]">Supplier:</span>
                <p className="font-semibold text-white">{selectedInward.supplier?.name}</p>
                {selectedInward.supplier?.gstin && <p className="font-mono text-white/50 text-[10px]">{selectedInward.supplier.gstin}</p>}
              </div>
              <div>
                <span className="text-white/40 block text-[10px]">Received Date:</span>
                <p className="font-semibold text-white">{new Date(selectedInward.receivedDate).toLocaleDateString()}</p>
                <p className="text-white/40 text-[10px]">Invoice: {selectedInward.invoiceNumber || "—"}</p>
              </div>
            </div>

            <div>
              <p className="font-semibold text-xs text-white/80 mb-2">Inward Items Breakdown</p>
              <div className="overflow-x-auto border border-white/5 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-dark-700 text-white/40 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-2.5">Product / SKU</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">Unit Cost</th>
                      <th className="p-2.5 text-right">Tax</th>
                      <th className="p-2.5 text-right">Freight</th>
                      <th className="p-2.5 text-right">Landed Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(selectedInward.items || []).map((it, i) => (
                      <tr key={i} className="hover:bg-white/[0.01]">
                        <td className="p-2.5">
                          <p className="font-medium text-white truncate max-w-[160px]">{it.name}</p>
                          <p className="font-mono text-[10px] text-white/40">{it.sku || "—"}</p>
                        </td>
                        <td className="p-2.5 text-center font-bold text-white">{it.quantityReceived}</td>
                        <td className="p-2.5 text-right font-mono text-white/80">₹{it.unitCost}</td>
                        <td className="p-2.5 text-right font-mono text-rose-400">₹{it.taxAmount || 0}</td>
                        <td className="p-2.5 text-right font-mono text-blue-400">₹{it.freightShare || 0}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-400">₹{it.landedUnitCost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center bg-acid/10 p-3 rounded-xl border border-acid/20 text-xs">
              <span className="font-semibold text-acid">Total Landed Inward Valuation:</span>
              <span className="font-bold text-acid text-sm">₹{(selectedInward.totalLandedCost || 0).toLocaleString()}</span>
            </div>

            {selectedInward.notes && (
              <div className="text-xs text-white/50">
                <span className="font-semibold text-white/70 block mb-0.5">Notes:</span>
                <p className="p-2 bg-dark-700/50 rounded-lg">{selectedInward.notes}</p>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                onClick={() => setSelectedInward(null)}
                className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-xl text-white text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
