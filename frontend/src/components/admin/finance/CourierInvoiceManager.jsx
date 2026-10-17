import { useState, useEffect } from "react"
import {
  FiTruck, FiPlus, FiEye, FiCheckCircle, FiAlertTriangle,
  FiX, FiChevronLeft, FiChevronRight, FiFileText, FiShield
} from "react-icons/fi"
import { financeAPI } from "../../../api"
import Loading from "../../common/Loading"
import toast from "react-hot-toast"

function StatusBadge({ status }) {
  const s = status || "unreconciled"
  if (s === "reconciled" || s === "healthy") {
    return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">Reconciled</span>
  }
  if (s === "partially_reconciled") {
    return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20">Partially Reconciled</span>
  }
  return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-400/10 text-rose-400 border border-rose-400/20">Unreconciled</span>
}

function WaybillStatusBadge({ status }) {
  switch (status) {
    case "matched":
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">MATCHED</span>
    case "amount_mismatch":
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-400/10 text-rose-400 border border-rose-400/20">MISMATCH</span>
    case "duplicate":
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20">DUPLICATE</span>
    default:
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">UNMATCHED</span>
  }
}

export default function CourierInvoiceManager() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 })

  // Modals & Details
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [importMode, setImportMode] = useState("form") // "form" | "json"

  // Import Form State
  const initialFormState = {
    invoiceNumber: `DLH-${Date.now().toString().slice(-6)}`,
    invoiceDate: new Date().toISOString().split("T")[0],
    carrier: "delhivery",
    billingPeriodStart: "",
    billingPeriodEnd: "",
    totalBilledAmount: "",
    jsonInput: "",
    lineItemsText: ""
  }
  const [formData, setFormData] = useState(initialFormState)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  const loadInvoices = () => {
    setLoading(true)
    financeAPI.getCourierInvoices({ page: pagination.page, limit: pagination.limit })
      .then(res => {
        setInvoices(res.data?.invoices || [])
        setPagination(res.data?.pagination || { page: 1, limit: 15, total: 0, pages: 1 })
      })
      .catch(err => {
        console.error("Error loading courier invoices:", err)
        toast.error(err.response?.data?.message || "Failed to load courier invoices")
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadInvoices()
  }, [pagination.page])

  const handleImportInvoice = async (e) => {
    e.preventDefault()
    setFormError("")

    setFormSubmitting(true)
    try {
      let payload = {}

      if (importMode === "json") {
        try {
          payload = JSON.parse(formData.jsonInput)
        } catch (jsonErr) {
          setFormError("Invalid JSON syntax: " + jsonErr.message)
          setFormSubmitting(false)
          return
        }
      } else {
        if (!formData.invoiceNumber.trim()) {
          setFormError("Invoice number is required")
          setFormSubmitting(false)
          return
        }
        if (!formData.totalBilledAmount || isNaN(parseFloat(formData.totalBilledAmount))) {
          setFormError("Valid total billed amount is required")
          setFormSubmitting(false)
          return
        }

        // Parse line items text (CSV lines: waybill, orderNumber, chargedWeight, freight, fuelSurcharge, codHandling, rtoFreight, taxAmount, totalCarrierCharge)
        let lines = []
        if (formData.lineItemsText.trim()) {
          try {
            if (formData.lineItemsText.trim().startsWith("[")) {
              lines = JSON.parse(formData.lineItemsText.trim())
            } else {
              const textRows = formData.lineItemsText.trim().split("\n")
              for (const row of textRows) {
                const parts = row.split(",").map(p => p.trim())
                if (parts[0]) {
                  const freightVal = parseFloat(parts[3]) || parseFloat(parts[2]) || 0
                  const totalCharge = parseFloat(parts[8]) || parseFloat(parts[7]) || parseFloat(parts[2]) || freightVal
                  lines.push({
                    waybill: parts[0],
                    orderNumber: parts[1] || "",
                    chargedWeightGrams: parseFloat(parts[2]) || null,
                    freight: freightVal,
                    fuelSurcharge: parseFloat(parts[4]) || 0,
                    codHandling: parseFloat(parts[5]) || 0,
                    rtoFreight: parseFloat(parts[6]) || 0,
                    taxAmount: parseFloat(parts[7]) || 0,
                    totalCarrierCharge: totalCharge
                  })
                }
              }
            }
          } catch (itemErr) {
            setFormError("Error parsing line items: " + itemErr.message)
            setFormSubmitting(false)
            return
          }
        }

        payload = {
          invoiceNumber: formData.invoiceNumber.trim(),
          invoiceDate: formData.invoiceDate,
          carrier: formData.carrier,
          billingPeriod: {
            start: formData.billingPeriodStart || null,
            end: formData.billingPeriodEnd || null
          },
          totalBilledAmount: parseFloat(formData.totalBilledAmount),
          lineItems: lines
        }
      }

      await financeAPI.importCourierInvoice(payload)
      toast.success("Courier invoice imported and waybills reconciled")
      setShowImportModal(false)
      setFormData(initialFormState)
      loadInvoices()
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || "Failed to import invoice")
    } finally {
      setFormSubmitting(false)
    }
  }

  // Summary totals
  const totalBilled = invoices.reduce((acc, cur) => acc + (cur.totalBilledAmount || 0), 0)
  const totalActualFreight = invoices.reduce((acc, cur) => acc + (cur.reconciliationSummary?.totalActualFreight || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display tracking-wide">Delhivery Courier Freight Invoices</h2>
          <p className="text-xs text-white/50">Logistics billing, waybill (AWB) reconciliation, and carrier weight dispute tracking</p>
        </div>
        <button
          onClick={() => {
            setFormData({ ...initialFormState, invoiceNumber: `DLH-${Date.now().toString().slice(-6)}` })
            setShowImportModal(true)
          }}
          className="flex items-center gap-2 bg-acid text-dark-900 font-semibold px-4 py-2 rounded-xl text-xs hover:bg-acid/90 transition shadow-lg shrink-0"
        >
          <FiPlus size={16} /> Import Carrier Invoice
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 space-y-1 border-white/10">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>Imported Invoices</span>
            <span className="text-[10px] font-mono text-blue-400">DELHIVERY</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {pagination.total}
          </div>
          <p className="text-[10px] text-white/40">Billed carrier statements</p>
        </div>

        <div className="card p-4 space-y-1 border-white/10">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>Total Billed Amount</span>
            <span className="text-[10px] font-mono text-white/60">INVOICED TOTAL</span>
          </div>
          <div className="text-2xl font-bold text-white/90">
            ₹{totalBilled.toLocaleString()}
          </div>
          <p className="text-[10px] text-white/40">Gross freight charges on invoices</p>
        </div>

        <div className="card p-4 space-y-1 border-white/10">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>Total Actual Freight</span>
            <span className="text-[10px] font-mono text-emerald-400">AUDITED FREIGHT</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            ₹{totalActualFreight.toLocaleString()}
          </div>
          <p className="text-[10px] text-white/40">Sum of itemized waybill costs</p>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-20"><Loading /></div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <FiTruck size={36} className="mx-auto text-white/20" />
            <p className="text-sm text-white/60 font-medium">No Delhivery courier freight invoices recorded</p>
            <p className="text-xs text-white/30">Import carrier invoice reports to reconcile shipment waybills against actual deliveries</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-dark-700/60 text-white/40 uppercase tracking-wider font-mono text-[10px] border-b border-white/5">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Invoice Date</th>
                  <th className="py-3 px-4">Carrier</th>
                  <th className="py-3 px-4">Billing Period</th>
                  <th className="py-3 px-4 text-center">Shipments Count</th>
                  <th className="py-3 px-4 text-right">Total Billed (₹)</th>
                  <th className="py-3 px-4 text-center">Recon Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {invoices.map(inv => (
                  <tr key={inv._id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3 px-4 font-mono font-bold text-acid">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-white/70 whitespace-nowrap">
                      {new Date(inv.invoiceDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 capitalize font-semibold text-white/80">
                      {inv.carrier}
                    </td>
                    <td className="py-3 px-4 font-mono text-white/60 text-[11px]">
                      {inv.billingPeriod?.start ? new Date(inv.billingPeriod.start).toLocaleDateString() : "—"} to {inv.billingPeriod?.end ? new Date(inv.billingPeriod.end).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {inv.totalShipments || inv.lineItems?.length || 0}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-white">
                      ₹{(inv.totalBilledAmount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={inv.reconciliationSummary?.status} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        title="View Waybill Itemization"
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

      {/* IMPORT INVOICE MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-dark-800 border border-white/10 rounded-2xl w-full max-w-2xl p-6 space-y-5 my-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <FiTruck className="text-acid" size={20} />
                <h3 className="font-display text-lg tracking-wide">Import Courier Freight Invoice</h3>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-white/40 hover:text-white">
                <FiX size={20} />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex bg-dark-700 p-1 rounded-xl border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setImportMode("form")}
                className={`flex-1 py-1.5 rounded-lg transition font-medium ${
                  importMode === "form" ? "bg-acid text-dark-900 font-semibold" : "text-white/60 hover:text-white"
                }`}
              >
                Standard Form Entry
              </button>
              <button
                type="button"
                onClick={() => setImportMode("json")}
                className={`flex-1 py-1.5 rounded-lg transition font-medium ${
                  importMode === "json" ? "bg-acid text-dark-900 font-semibold" : "text-white/60 hover:text-white"
                }`}
              >
                Direct JSON Ingest
              </button>
            </div>

            {formError && (
              <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <FiAlertTriangle className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleImportInvoice} className="space-y-4 text-xs">
              {importMode === "json" ? (
                <div>
                  <label className="block text-white/60 mb-1 font-medium">JSON Courier Invoice Object *</label>
                  <textarea
                    rows="12"
                    required
                    placeholder={`{\n  "invoiceNumber": "DELH-INV-2026-01",\n  "invoiceDate": "2026-10-01",\n  "carrier": "delhivery",\n  "totalBilledAmount": 8400,\n  "lineItems": [\n    {\n      "waybill": "DLHV123456789",\n      "orderNumber": "ORD-2026-001",\n      "freight": 80,\n      "totalCarrierCharge": 80\n    }\n  ]\n}`}
                    value={formData.jsonInput}
                    onChange={e => setFormData({ ...formData, jsonInput: e.target.value })}
                    className="input w-full bg-dark-700 border-white/10 text-xs py-2 font-mono"
                  />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-white/60 mb-1 font-medium">Invoice Number *</label>
                      <input
                        type="text"
                        required
                        placeholder="DELH-987654"
                        value={formData.invoiceNumber}
                        onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })}
                        className="input w-full bg-dark-700 border-white/10 text-xs py-2 font-mono font-bold text-acid"
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 mb-1 font-medium">Invoice Date *</label>
                      <input
                        type="date"
                        required
                        value={formData.invoiceDate}
                        onChange={e => setFormData({ ...formData, invoiceDate: e.target.value })}
                        className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 mb-1 font-medium">Carrier</label>
                      <input
                        type="text"
                        value={formData.carrier}
                        onChange={e => setFormData({ ...formData, carrier: e.target.value })}
                        className="input w-full bg-dark-700 border-white/10 text-xs py-2 capitalize font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/5 pt-3">
                    <div>
                      <label className="block text-white/60 mb-1">Billing Period Start</label>
                      <input
                        type="date"
                        value={formData.billingPeriodStart}
                        onChange={e => setFormData({ ...formData, billingPeriodStart: e.target.value })}
                        className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 mb-1">Billing Period End</label>
                      <input
                        type="date"
                        value={formData.billingPeriodEnd}
                        onChange={e => setFormData({ ...formData, billingPeriodEnd: e.target.value })}
                        className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 mb-1 font-medium">Total Billed (₹) *</label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        placeholder="12500"
                        value={formData.totalBilledAmount}
                        onChange={e => setFormData({ ...formData, totalBilledAmount: e.target.value })}
                        className="input w-full bg-dark-700 border-white/10 text-xs py-2 font-bold text-emerald-400"
                      />
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-3">
                    <label className="block text-white/60 mb-1 font-medium">
                      Line Items (Optional CSV / Waybill List)
                    </label>
                    <textarea
                      rows="4"
                      placeholder="waybill, orderNumber, chargedWeightGrams, freight, fuelSurcharge, codHandling, rtoFreight, taxAmount, totalCarrierCharge&#10;DLHV998877, ORD-2026-001, 500, 75, 5, 0, 0, 14.4, 94.4"
                      value={formData.lineItemsText}
                      onChange={e => setFormData({ ...formData, lineItemsText: e.target.value })}
                      className="input w-full bg-dark-700 border-white/10 text-xs py-2 font-mono"
                    />
                    <p className="text-[11px] text-white/40 mt-1">One waybill per line for automated shipment tracking matching and freight validation</p>
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-xl text-white/70 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-acid text-dark-900 font-semibold rounded-xl hover:bg-acid/90 transition shadow-lg disabled:opacity-50"
                >
                  {formSubmitting ? "Importing..." : "Import & Reconcile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW INVOICE DETAILS MODAL */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-white/10 rounded-2xl w-full max-w-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FiTruck className="text-acid" size={18} />
                <h3 className="font-display text-base tracking-wide">Invoice #{selectedInvoice.invoiceNumber}</h3>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="text-white/40 hover:text-white">
                <FiX size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-dark-700/30 p-3 rounded-xl border border-white/5">
              <div>
                <span className="text-white/40 block text-[10px]">Carrier / Date:</span>
                <p className="font-semibold text-white capitalize">{selectedInvoice.carrier}</p>
                <p className="text-white/40 text-[10px]">{new Date(selectedInvoice.invoiceDate).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-white/40 block text-[10px]">Total Billed:</span>
                <p className="font-bold text-white">₹{(selectedInvoice.totalBilledAmount || 0).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-white/40 block text-[10px]">Actual Freight:</span>
                <p className="font-semibold text-blue-400">₹{(selectedInvoice.reconciliationSummary?.totalActualFreight || 0).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-white/40 block text-[10px]">Recon Status:</span>
                <StatusBadge status={selectedInvoice.reconciliationSummary?.status} />
              </div>
            </div>

            {/* Reconciliation Stats Card */}
            <div className="flex items-center justify-between p-3 bg-dark-700/50 rounded-xl border border-white/5 text-xs">
              <span className="text-white/50">Waybill Matching Summary:</span>
              <div className="flex items-center gap-3 text-white/70">
                <span>Matched: <strong className="text-emerald-400">{selectedInvoice.reconciliationSummary?.matchedShipments || 0}</strong></span>
                <span>Unmatched: <strong className="text-amber-400">{selectedInvoice.reconciliationSummary?.unmatchedShipments || 0}</strong></span>
                <span>Duplicates: <strong className="text-rose-400">{selectedInvoice.reconciliationSummary?.duplicateCount || 0}</strong></span>
              </div>
            </div>

            {/* Line Items List */}
            <div>
              <p className="font-semibold text-xs text-white/80 mb-2">Itemized Waybills (AWBs)</p>
              <div className="overflow-x-auto border border-white/5 rounded-xl max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-dark-700 text-white/40 uppercase font-mono text-[10px] sticky top-0">
                    <tr>
                      <th className="p-2.5">Waybill (AWB)</th>
                      <th className="p-2.5">Order Ref</th>
                      <th className="p-2.5 text-right">Weight (g)</th>
                      <th className="p-2.5 text-right">Freight (₹)</th>
                      <th className="p-2.5 text-right">Total Charge (₹)</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(selectedInvoice.lineItems || []).map((it, i) => (
                      <tr key={i} className="hover:bg-white/[0.01]">
                        <td className="p-2.5 font-mono text-white/80">{it.waybill}</td>
                        <td className="p-2.5 font-mono text-white/60">{it.orderNumber || "—"}</td>
                        <td className="p-2.5 text-right font-mono text-white/70">{it.chargedWeightGrams || "—"}</td>
                        <td className="p-2.5 text-right text-blue-400">₹{(it.freight || 0).toLocaleString()}</td>
                        <td className="p-2.5 text-right font-medium text-white">₹{(it.totalCarrierCharge || 0).toLocaleString()}</td>
                        <td className="p-2.5 text-center">
                          <WaybillStatusBadge status={it.reconciliationStatus} />
                        </td>
                      </tr>
                    ))}
                    {(!selectedInvoice.lineItems || selectedInvoice.lineItems.length === 0) && (
                      <tr>
                        <td colSpan="6" className="p-4 text-center text-white/30 text-xs">
                          No itemized waybills attached to this invoice
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                onClick={() => setSelectedInvoice(null)}
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
