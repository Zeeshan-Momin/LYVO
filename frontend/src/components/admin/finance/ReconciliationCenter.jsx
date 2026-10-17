import { useState, useEffect } from "react"
import {
  FiShield, FiCreditCard, FiTruck, FiActivity, FiAlertTriangle,
  FiCheckCircle, FiHelpCircle, FiArrowRight, FiRefreshCw, FiDollarSign
} from "react-icons/fi"
import { financeAPI } from "../../../api"
import Loading from "../../common/Loading"
import toast from "react-hot-toast"

const PROVENANCE_BADGES = {
  ACTUAL: { bg: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20", label: "ACTUAL" },
  ESTIMATED: { bg: "bg-blue-400/10 text-blue-400 border-blue-400/20", label: "ESTIMATED" },
  DERIVED: { bg: "bg-purple-400/10 text-purple-400 border-purple-400/20", label: "DERIVED" },
  UNRECONCILED: { bg: "bg-amber-400/10 text-amber-400 border-amber-400/20", label: "UNRECONCILED" },
  UNKNOWN: { bg: "bg-rose-400/10 text-rose-400 border-rose-400/20", label: "UNKNOWN" },
  NOT_APPLICABLE: { bg: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20", label: "NOT APPLICABLE" }
}

function ProvenanceTag({ type }) {
  const t = (type || "UNKNOWN").toUpperCase()
  const conf = PROVENANCE_BADGES[t] || PROVENANCE_BADGES.UNKNOWN
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${conf.bg}`}>
      {conf.label}
    </span>
  )
}

function HealthBadge({ status }) {
  const isHealthy = status === "healthy" || status === "reconciled" || status === "fully_reconciled"
  if (isHealthy) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
        <FiCheckCircle size={13} /> Reconciled & Healthy
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-400/10 text-amber-400 border border-amber-400/20">
      <FiAlertTriangle size={13} /> Attention Required
    </span>
  )
}

export default function ReconciliationCenter({ onNavigateTab }) {
  const [reconData, setReconData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadSummary = () => {
    setLoading(true)
    financeAPI.getReconciliationSummary()
      .then(res => setReconData(res.data))
      .catch(err => {
        console.error("Error fetching reconciliation summary:", err)
        toast.error("Failed to load reconciliation summary")
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadSummary()
  }, [])

  const payments = reconData?.payments
  const shipping = reconData?.shipping

  if (loading) {
    return <div className="py-20"><Loading /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display tracking-wide">Financial & Operational Reconciliation</h2>
          <p className="text-xs text-white/50">Three-way reconciliation matching orders, gateway settlements, and carrier freight invoices</p>
        </div>
        <button
          onClick={loadSummary}
          className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 text-white font-medium px-4 py-2 rounded-xl text-xs transition border border-white/10 shrink-0"
        >
          <FiRefreshCw size={14} /> Refresh Summary
        </button>
      </div>

      {/* Main Reconciliation Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Payment Gateway (Razorpay) Reconciliation */}
        <div className="card p-6 space-y-5 border-acid/20">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-acid/10 rounded-xl text-acid">
                <FiCreditCard size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-base">Payment Gateway Reconciliation</h3>
                <p className="text-[11px] text-white/40">Razorpay MDR fee & bank settlement tracking</p>
              </div>
            </div>
            <HealthBadge status={payments?.status} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-dark-700/40 p-3 rounded-xl border border-white/5 space-y-1">
              <span className="text-white/40 text-[10px]">Gross Captured & Settled</span>
              <p className="text-lg font-bold text-white">₹{(payments?.totalGrossSettled || 0).toLocaleString()}</p>
              <span className="text-[10px] text-white/40">{payments?.totalSettlements || 0} batches</span>
            </div>
            <div className="bg-dark-700/40 p-3 rounded-xl border border-white/5 space-y-1">
              <span className="text-white/40 text-[10px]">Net Bank Disbursed</span>
              <p className="text-lg font-bold text-acid">₹{(payments?.totalNetReceived || 0).toLocaleString()}</p>
              <span className="text-[10px] text-emerald-400">Deposited to bank</span>
            </div>
          </div>

          <div className="space-y-2 text-xs divide-y divide-white/5">
            <div className="flex justify-between py-1.5">
              <span className="text-white/60">Gateway MDR Commission Paid:</span>
              <span className="font-semibold text-rose-400">₹{(payments?.totalFeePaid || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-white/60">GST on Gateway Commission:</span>
              <span className="font-semibold text-rose-400">₹{(payments?.totalTaxPaid || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-white/60">Matched Paid Orders:</span>
              <span className="font-semibold text-emerald-400">{payments?.matchedTxCount || 0} orders</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-white/60">Unmatched Transactions in Settlement:</span>
              <span className={`font-semibold ${(payments?.unmatchedTxCount || 0) > 0 ? "text-amber-400" : "text-white/60"}`}>
                {payments?.unmatchedTxCount || 0}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-white/60">Amount Mismatches:</span>
              <span className={`font-semibold ${(payments?.mismatchTxCount || 0) > 0 ? "text-rose-400" : "text-white/60"}`}>
                {payments?.mismatchTxCount || 0}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-white/60">Unreconciled Paid Orders in Database:</span>
              <span className="font-semibold text-amber-300">{payments?.unreconciledCount || 0} orders</span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 flex justify-end">
            <button
              onClick={() => onNavigateTab && onNavigateTab("settlements")}
              className="flex items-center gap-1.5 text-xs text-acid font-semibold hover:text-acid/80 transition"
            >
              Inspect Settlement Batches <FiArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Card 2: Courier Freight (Delhivery) Reconciliation */}
        <div className="card p-6 space-y-5 border-blue-400/20">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-400/10 rounded-xl text-blue-400">
                <FiTruck size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-base">Logistics Freight Reconciliation</h3>
                <p className="text-[11px] text-white/40">Delhivery courier invoice & waybill auditing</p>
              </div>
            </div>
            <HealthBadge status={shipping?.status} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-dark-700/40 p-3 rounded-xl border border-white/5 space-y-1">
              <span className="text-white/40 text-[10px]">Total Billed on Invoices</span>
              <p className="text-lg font-bold text-white">₹{(shipping?.totalBilled || 0).toLocaleString()}</p>
              <span className="text-[10px] text-white/40">{shipping?.totalInvoices || 0} invoices</span>
            </div>
            <div className="bg-dark-700/40 p-3 rounded-xl border border-white/5 space-y-1">
              <span className="text-white/40 text-[10px]">Actual Audited Freight</span>
              <p className="text-lg font-bold text-blue-400">₹{(shipping?.totalActualFreight || 0).toLocaleString()}</p>
              <span className="text-[10px] text-blue-300">Sum of itemized waybills</span>
            </div>
          </div>

          <div className="space-y-2 text-xs divide-y divide-white/5">
            <div className="flex justify-between py-1.5">
              <span className="text-white/60">Matched Waybills (AWBs):</span>
              <span className="font-semibold text-emerald-400">{shipping?.matchedShipmentCount || 0} shipments</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-white/60">Unmatched Waybills in Invoices:</span>
              <span className={`font-semibold ${(shipping?.unmatchedShipmentCount || 0) > 0 ? "text-amber-400" : "text-white/60"}`}>
                {shipping?.unmatchedShipmentCount || 0}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-white/60">Unreconciled Dispatched Shipments:</span>
              <span className="font-semibold text-amber-300">{shipping?.unreconciledCount || 0} shipments</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-white/60">Carrier Discrepancy Status:</span>
              <span className="font-semibold text-white/80 capitalize">{shipping?.status?.replace("_", " ") || "Pending"}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 flex justify-end">
            <button
              onClick={() => onNavigateTab && onNavigateTab("invoices")}
              className="flex items-center gap-1.5 text-xs text-blue-400 font-semibold hover:text-blue-300 transition"
            >
              Inspect Courier Invoices <FiArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Reconciliation Principles & Guardrails Notice */}
      <div className="card p-5 space-y-2 border-white/10 bg-dark-800/60">
        <div className="flex items-center gap-2 text-xs font-semibold text-white">
          <FiShield className="text-acid" size={16} />
          <span>Financial Integrity & Reconciliation Principles</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] text-white/60 pt-2">
          <div className="p-3 bg-dark-700/30 rounded-xl border border-white/5">
            <strong className="text-white block mb-1">1. Zero Formula Drift</strong>
            Reconciliation status and fee allocations are evaluated exclusively by authoritative backend services. React performs no independent arithmetic.
          </div>
          <div className="p-3 bg-dark-700/30 rounded-xl border border-white/5">
            <strong className="text-white block mb-1">2. Idempotent Ingestion</strong>
            Settlement IDs and Courier Invoice numbers are strictly deduplicated with unique index constraints. Duplicate transactions are isolated without double-counting.
          </div>
          <div className="p-3 bg-dark-700/30 rounded-xl border border-white/5">
            <strong className="text-white block mb-1">3. Provenance Transparency</strong>
            Unreconciled payments and logistics retain <ProvenanceTag type="UNKNOWN" /> or <ProvenanceTag type="ESTIMATED" /> markers until fully matched to audited bank/carrier vouchers.
          </div>
        </div>
      </div>
    </div>
  )
}
