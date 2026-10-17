import { useState, useEffect } from "react"
import {
  FiCreditCard, FiPlus, FiEye, FiCheckCircle, FiAlertTriangle,
  FiX, FiChevronLeft, FiChevronRight, FiFileText, FiDownload,
  FiActivity, FiShield, FiAlertCircle
} from "react-icons/fi"
import { financeAPI } from "../../../api"
import Loading from "../../common/Loading"
import toast from "react-hot-toast"

function StatusBadge({ status }) {
  const s = status || "unreconciled"
  if (s === "fully_reconciled" || s === "healthy") {
    return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">Fully Reconciled</span>
  }
  if (s === "partially_reconciled") {
    return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20">Partially Reconciled</span>
  }
  return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-400/10 text-rose-400 border border-rose-400/20">Unreconciled</span>
}

function TxStatusBadge({ status }) {
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

export default function SettlementManager() {
  const [settlements, setSettlements] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 })

  // Modals & Details
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedSettlement, setSelectedSettlement] = useState(null)
  const [importMode, setImportMode] = useState("form") // "form" | "json"

  // Import Form State
  const initialFormState = {
    settlementId: `setl_${Date.now().toString().slice(-8)}`,
    settlementDate: new Date().toISOString().split("T")[0],
    grossAmount: "",
    feeAmount: "",
    taxAmount: "",
    feeProvenance: "actual",
    adjustment: "0",
    netAmount: "",
    utr: "",
    jsonInput: "",
    transactionsText: ""
  }
  const [formData, setFormData] = useState(initialFormState)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  const loadSettlements = () => {
    setLoading(true)
    financeAPI.getRazorpaySettlements({ page: pagination.page, limit: pagination.limit })
      .then(res => {
        setSettlements(res.data?.settlements || [])
        setPagination(res.data?.pagination || { page: 1, limit: 15, total: 0, pages: 1 })
      })
      .catch(err => {
        console.error("Error loading Razorpay settlements:", err)
        toast.error(err.response?.data?.message || "Failed to load settlements")
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadSettlements()
  }, [pagination.page])

  // Form computations helper
  const handleGrossOrFeeChange = (field, val) => {
    const updated = { ...formData, [field]: val }
    const gross = parseFloat(field === "grossAmount" ? val : updated.grossAmount) || 0
    const fee = parseFloat(field === "feeAmount" ? val : updated.feeAmount) || 0
    const tax = parseFloat(field === "taxAmount" ? val : updated.taxAmount) || 0
    const adj = parseFloat(updated.adjustment) || 0
    const net = gross - fee - tax + adj
    setFormData({
      ...updated,
      netAmount: net > 0 ? net.toString() : ""
    })
  }

  const handleImportSettlement = async (e) => {
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
        if (!formData.settlementId.trim()) {
          setFormError("Settlement ID is required")
          setFormSubmitting(false)
          return
        }
        if (!formData.grossAmount || isNaN(parseFloat(formData.grossAmount))) {
          setFormError("Valid gross settlement amount is required")
          setFormSubmitting(false)
          return
        }
        if (!formData.netAmount || isNaN(parseFloat(formData.netAmount))) {
          setFormError("Valid net settlement amount is required")
          setFormSubmitting(false)
          return
        }

        // Parse optional transactions text (CSV or JSON lines: paymentId, orderId, amount, fee, tax)
        let txList = []
        if (formData.transactionsText.trim()) {
          try {
            // Check if JSON array
            if (formData.transactionsText.trim().startsWith("[")) {
              txList = JSON.parse(formData.transactionsText.trim())
            } else {
              // Parse line by line: paymentId, orderId/number, amount, fee, tax
              const lines = formData.transactionsText.trim().split("\n")
              for (const line of lines) {
                const parts = line.split(",").map(p => p.trim())
                if (parts[0]) {
                  txList.push({
                    paymentId: parts[0],
                    orderId: parts[1] || "",
                    lyvoOrderNumber: parts[1] || "",
                    amount: parseFloat(parts[2]) || 0,
                    fee: parseFloat(parts[3]) || 0,
                    tax: parseFloat(parts[4]) || 0
                  })
                }
              }
            }
          } catch (txErr) {
            setFormError("Error parsing transactions list: " + txErr.message)
            setFormSubmitting(false)
            return
          }
        }

        payload = {
          settlementId: formData.settlementId.trim(),
          settlementDate: formData.settlementDate,
          grossAmount: parseFloat(formData.grossAmount),
          feeAmount: parseFloat(formData.feeAmount) || 0,
          taxAmount: parseFloat(formData.taxAmount) || 0,
          feeProvenance: formData.feeProvenance,
          adjustment: parseFloat(formData.adjustment) || 0,
          netAmount: parseFloat(formData.netAmount),
          utr: formData.utr.trim(),
          transactions: txList
        }
      }

      await financeAPI.importRazorpaySettlement(payload)
      toast.success("Settlement batch imported and reconciled successfully")
      setShowImportModal(false)
      setFormData(initialFormState)
      loadSettlements()
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || "Failed to import settlement")
    } finally {
      setFormSubmitting(false)
    }
  }

  // Summary computations
  const totalGrossSettled = settlements.reduce((acc, cur) => acc + (cur.grossAmount || 0), 0)
  const totalFeesPaid = settlements.reduce((acc, cur) => acc + (cur.feeAmount || 0), 0)
  const totalNetReceived = settlements.reduce((acc, cur) => acc + (cur.netAmount || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display tracking-wide">Razorpay Gateway Settlements</h2>
          <p className="text-xs text-white/50">Settlement batches, gateway MDR commission deductions, and UTR bank deposits</p>
        </div>
        <button
          onClick={() => {
            setFormData({ ...initialFormState, settlementId: `setl_${Date.now().toString().slice(-8)}` })
            setShowImportModal(true)
          }}
          className="flex items-center gap-2 bg-acid text-dark-900 font-semibold px-4 py-2 rounded-xl text-xs hover:bg-acid/90 transition shadow-lg shrink-0"
        >
          <FiPlus size={16} /> Import Settlement Batch
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4 space-y-1 border-white/10">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>Settlement Batches</span>
            <span className="text-[10px] font-mono text-acid">RAZORPAY</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {pagination.total}
          </div>
          <p className="text-[10px] text-white/40">Imported settlement files</p>
        </div>

        <div className="card p-4 space-y-1 border-white/10">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>Gross Settled</span>
            <span className="text-[10px] font-mono text-white/60">PAYMENT TOTAL</span>
          </div>
          <div className="text-2xl font-bold text-white/90">
            ₹{totalGrossSettled.toLocaleString()}
          </div>
          <p className="text-[10px] text-white/40">Customer captures settled</p>
        </div>

        <div className="card p-4 space-y-1 border-white/10">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>Gateway Fees Paid</span>
            <span className="text-[10px] font-mono text-rose-400">MDR COMMISSION</span>
          </div>
          <div className="text-2xl font-bold text-rose-400">
            ₹{totalFeesPaid.toLocaleString()}
          </div>
          <p className="text-[10px] text-white/40">Deducted MDR commission</p>
        </div>

        <div className="card p-4 space-y-1 border-white/10">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>Net Bank Deposit</span>
            <span className="text-[10px] font-mono text-emerald-400">NET DEPOSITED</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            ₹{totalNetReceived.toLocaleString()}
          </div>
          <p className="text-[10px] text-white/40">Disbursed to bank account</p>
        </div>
      </div>

      {/* Settlements Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-20"><Loading /></div>
        ) : settlements.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <FiCreditCard size={36} className="mx-auto text-white/20" />
            <p className="text-sm text-white/60 font-medium">No Razorpay settlement batches recorded</p>
            <p className="text-xs text-white/30">Import settlement export files from Razorpay dashboard to reconcile payments</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-dark-700/60 text-white/40 uppercase tracking-wider font-mono text-[10px] border-b border-white/5">
                <tr>
                  <th className="py-3 px-4">Settlement ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">UTR</th>
                  <th className="py-3 px-4 text-right">Gross (₹)</th>
                  <th className="py-3 px-4 text-right">Fee (₹)</th>
                  <th className="py-3 px-4 text-right">Tax (₹)</th>
                  <th className="py-3 px-4 text-right">Net Deposit (₹)</th>
                  <th className="py-3 px-4 text-center">Tx Count</th>
                  <th className="py-3 px-4 text-center">Recon Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {settlements.map(setl => (
                  <tr key={setl._id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3 px-4 font-mono font-bold text-acid">
                      {setl.settlementId}
                    </td>
                    <td className="py-3 px-4 font-mono text-white/70 whitespace-nowrap">
                      {new Date(setl.settlementDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-white/80">
                      {setl.utr || "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-white">
                      ₹{(setl.grossAmount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-400">
                      ₹{(setl.feeAmount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-400">
                      ₹{(setl.taxAmount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-400">
                      ₹{(setl.netAmount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {setl.transactions?.length || setl.reconciliationSummary?.totalTransactions || 0}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={setl.reconciliationSummary?.status} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedSettlement(setl)}
                        title="View Transactions Breakdown"
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

      {/* IMPORT SETTLEMENT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-dark-800 border border-white/10 rounded-2xl w-full max-w-2xl p-6 space-y-5 my-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <FiCreditCard className="text-acid" size={20} />
                <h3 className="font-display text-lg tracking-wide">Import Razorpay Settlement</h3>
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

            <form onSubmit={handleImportSettlement} className="space-y-4 text-xs">
              {importMode === "json" ? (
                <div>
                  <label className="block text-white/60 mb-1 font-medium">JSON Settlement Object *</label>
                  <textarea
                    rows="12"
                    required
                    placeholder={`{\n  "settlementId": "setl_test123",\n  "settlementDate": "2026-10-01",\n  "grossAmount": 15000,\n  "feeAmount": 300,\n  "taxAmount": 54,\n  "netAmount": 14646,\n  "utr": "UTR12345678",\n  "transactions": [\n    {\n      "paymentId": "pay_test1",\n      "orderId": "order_test1",\n      "amount": 5000,\n      "fee": 100,\n      "tax": 18\n    }\n  ]\n}`}
                    value={formData.jsonInput}
                    onChange={e => setFormData({ ...formData, jsonInput: e.target.value })}
                    className="input w-full bg-dark-700 border-white/10 text-xs py-2 font-mono"
                  />
                  <p className="text-[11px] text-white/40 mt-1">Paste standard Razorpay settlement payload matching the schema</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-white/60 mb-1 font-medium">Settlement ID *</label>
                      <input
                        type="text"
                        required
                        placeholder="setl_12345"
                        value={formData.settlementId}
                        onChange={e => setFormData({ ...formData, settlementId: e.target.value })}
                        className="input w-full bg-dark-700 border-white/10 text-xs py-2 font-mono font-bold text-acid"
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 mb-1 font-medium">Settlement Date *</label>
                      <input
                        type="date"
                        required
                        value={formData.settlementDate}
                        onChange={e => setFormData({ ...formData, settlementDate: e.target.value })}
                        className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 mb-1 font-medium">Bank UTR / Ref</label>
                      <input
                        type="text"
                        placeholder="UTR987654321"
                        value={formData.utr}
                        onChange={e => setFormData({ ...formData, utr: e.target.value })}
                        className="input w-full bg-dark-700 border-white/10 text-xs py-2 font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-white/5 pt-3">
                    <div>
                      <label className="block text-white/60 mb-1">Gross Settled (₹) *</label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        placeholder="10000"
                        value={formData.grossAmount}
                        onChange={e => handleGrossOrFeeChange("grossAmount", e.target.value)}
                        className="input w-full bg-dark-700 border-white/10 text-xs py-2 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 mb-1">Fee (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="200"
                        value={formData.feeAmount}
                        onChange={e => handleGrossOrFeeChange("feeAmount", e.target.value)}
                        className="input w-full bg-dark-700 border-white/10 text-xs py-2 text-rose-400"
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 mb-1">GST on Fee (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="36"
                        value={formData.taxAmount}
                        onChange={e => handleGrossOrFeeChange("taxAmount", e.target.value)}
                        className="input w-full bg-dark-700 border-white/10 text-xs py-2 text-rose-400"
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 mb-1">Net Deposit (₹) *</label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        placeholder="9764"
                        value={formData.netAmount}
                        onChange={e => setFormData({ ...formData, netAmount: e.target.value })}
                        className="input w-full bg-dark-700 border-white/10 text-xs py-2 font-bold text-emerald-400"
                      />
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-3">
                    <label className="block text-white/60 mb-1 font-medium">
                      Settled Transactions List (Optional CSV / Lines)
                    </label>
                    <textarea
                      rows="4"
                      placeholder="paymentId, orderId/number, amount, fee, tax&#10;pay_ABC123, ORD-2026-001, 5000, 100, 18&#10;pay_DEF456, ORD-2026-002, 3500, 70, 12.6"
                      value={formData.transactionsText}
                      onChange={e => setFormData({ ...formData, transactionsText: e.target.value })}
                      className="input w-full bg-dark-700 border-white/10 text-xs py-2 font-mono"
                    />
                    <p className="text-[11px] text-white/40 mt-1">One transaction per line for automated order matching and reconciliation</p>
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

      {/* VIEW SETTLEMENT DETAILS MODAL */}
      {selectedSettlement && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-white/10 rounded-2xl w-full max-w-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FiCreditCard className="text-acid" size={18} />
                <h3 className="font-display text-base tracking-wide">Settlement #{selectedSettlement.settlementId}</h3>
              </div>
              <button onClick={() => setSelectedSettlement(null)} className="text-white/40 hover:text-white">
                <FiX size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-dark-700/30 p-3 rounded-xl border border-white/5">
              <div>
                <span className="text-white/40 block text-[10px]">Settlement Date:</span>
                <p className="font-semibold text-white">{new Date(selectedSettlement.settlementDate).toLocaleDateString()}</p>
                <p className="text-white/40 text-[10px] font-mono">UTR: {selectedSettlement.utr || "—"}</p>
              </div>
              <div>
                <span className="text-white/40 block text-[10px]">Gross Settled:</span>
                <p className="font-semibold text-white">₹{(selectedSettlement.grossAmount || 0).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-white/40 block text-[10px]">Fees & Taxes:</span>
                <p className="font-semibold text-rose-400">₹{((selectedSettlement.feeAmount || 0) + (selectedSettlement.taxAmount || 0)).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-white/40 block text-[10px]">Net Bank Deposit:</span>
                <p className="font-bold text-emerald-400">₹{(selectedSettlement.netAmount || 0).toLocaleString()}</p>
              </div>
            </div>

            {/* Reconciliation Summary Badge Card */}
            <div className="flex items-center justify-between p-3 bg-dark-700/50 rounded-xl border border-white/5 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-white/50">Reconciliation Result:</span>
                <StatusBadge status={selectedSettlement.reconciliationSummary?.status} />
              </div>
              <div className="flex items-center gap-3 text-white/70">
                <span>Matched: <strong className="text-emerald-400">{selectedSettlement.reconciliationSummary?.matchedCount || 0}</strong></span>
                <span>Unmatched: <strong className="text-amber-400">{selectedSettlement.reconciliationSummary?.unmatchedCount || 0}</strong></span>
                <span>Mismatches: <strong className="text-rose-400">{selectedSettlement.reconciliationSummary?.mismatchCount || 0}</strong></span>
              </div>
            </div>

            {/* Transactions List */}
            <div>
              <p className="font-semibold text-xs text-white/80 mb-2">Transactions Matching Ledger</p>
              <div className="overflow-x-auto border border-white/5 rounded-xl max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-dark-700 text-white/40 uppercase font-mono text-[10px] sticky top-0">
                    <tr>
                      <th className="p-2.5">Payment ID</th>
                      <th className="p-2.5">Order Ref</th>
                      <th className="p-2.5 text-right">Amount (₹)</th>
                      <th className="p-2.5 text-right">Fee (₹)</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(selectedSettlement.transactions || []).map((tx, i) => (
                      <tr key={i} className="hover:bg-white/[0.01]">
                        <td className="p-2.5 font-mono text-white/80">{tx.paymentId}</td>
                        <td className="p-2.5 font-mono text-white/60">{tx.lyvoOrderNumber || tx.orderId || "—"}</td>
                        <td className="p-2.5 text-right font-medium text-white">₹{(tx.amount || 0).toLocaleString()}</td>
                        <td className="p-2.5 text-right text-rose-400">₹{(tx.fee || 0).toLocaleString()}</td>
                        <td className="p-2.5 text-center">
                          <TxStatusBadge status={tx.reconciliationStatus} />
                        </td>
                        <td className="p-2.5 text-[11px] text-white/50">{tx.mismatchReason || "—"}</td>
                      </tr>
                    ))}
                    {(!selectedSettlement.transactions || selectedSettlement.transactions.length === 0) && (
                      <tr>
                        <td colSpan="6" className="p-4 text-center text-white/30 text-xs">
                          No itemized transaction records attached to this settlement batch
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                onClick={() => setSelectedSettlement(null)}
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
