import { useState, useEffect } from "react"
import {
  FiDollarSign, FiPlus, FiFilter, FiSearch, FiFileText,
  FiTrash2, FiEye, FiCheckCircle, FiAlertTriangle, FiX,
  FiChevronLeft, FiChevronRight, FiCalendar, FiShield, FiTag
} from "react-icons/fi"
import { financeAPI } from "../../../api"
import Loading from "../../common/Loading"
import toast from "react-hot-toast"

const EXPENSE_CATEGORIES = [
  { id: "marketing", label: "Marketing & Performance Ads" },
  { id: "logistics_freight", label: "Logistics & Freight" },
  { id: "packaging", label: "Packaging Materials" },
  { id: "software_it", label: "Software & IT Services" },
  { id: "rent_utilities", label: "Rent & Utilities" },
  { id: "salaries", label: "Salaries & Contractor Fees" },
  { id: "legal_accounting", label: "Legal & Accounting" },
  { id: "bank_charges", label: "Bank Charges & Gateway Fees" },
  { id: "procurement", label: "Procurement & Quality" },
  { id: "other", label: "Other Administrative" }
]

const ITC_ELIGIBILITY_OPTIONS = [
  { id: "eligible", label: "Eligible for ITC" },
  { id: "ineligible", label: "Ineligible" },
  { id: "blocked", label: "Blocked Credit (Sec 17(5))" },
  { id: "pending_verification", label: "Pending Verification" }
]

const PROVENANCE_BADGES = {
  ACTUAL: { bg: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20", label: "ACTUAL" },
  ESTIMATED: { bg: "bg-blue-400/10 text-blue-400 border-blue-400/20", label: "ESTIMATED" },
  DERIVED: { bg: "bg-purple-400/10 text-purple-400 border-purple-400/20", label: "DERIVED" },
  UNRECONCILED: { bg: "bg-amber-400/10 text-amber-400 border-amber-400/20", label: "UNRECONCILED" },
  UNKNOWN: { bg: "bg-rose-400/10 text-rose-400 border-rose-400/20", label: "UNKNOWN" }
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

function StatusBadge({ status }) {
  const s = status || "approved"
  if (s === "approved") {
    return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">Approved</span>
  }
  if (s === "cancelled") {
    return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-400/10 text-rose-400 border border-rose-400/20">Cancelled</span>
  }
  return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20">{s}</span>
}

function ItcBadge({ eligibility }) {
  switch (eligibility) {
    case "eligible":
      return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">ELIGIBLE</span>
    case "pending_verification":
      return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20">PENDING</span>
    case "blocked":
      return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-400/10 text-rose-400 border border-rose-400/20">BLOCKED</span>
    default:
      return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">INELIGIBLE</span>
  }
}

export default function ExpenseManager({ dateParams }) {
  const [expenses, setExpenses] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 })

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("approved")
  const [itcFilter, setItcFilter] = useState("all")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all")

  // Modals & Drawers
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)

  // Create Form State
  const initialFormState = {
    expenseDate: new Date().toISOString().split("T")[0],
    category: "marketing",
    subcategory: "",
    description: "",
    vendorName: "",
    vendorGstin: "",
    vendorPan: "",
    invoiceNumber: "",
    invoiceDate: "",
    taxableAmount: "",
    cgst: "0",
    sgst: "0",
    igst: "0",
    cess: "0",
    grossAmount: "",
    paymentMethod: "bank_transfer",
    paymentStatus: "paid",
    itcEligibility: "pending_verification",
    itcAmount: "",
    notes: ""
  }
  const [formData, setFormData] = useState(initialFormState)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  const loadExpenses = () => {
    setLoading(true)
    const params = {
      ...dateParams,
      category: categoryFilter !== "all" ? categoryFilter : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      itcEligibility: itcFilter !== "all" ? itcFilter : undefined,
      paymentStatus: paymentStatusFilter !== "all" ? paymentStatusFilter : undefined,
      page: pagination.page,
      limit: pagination.limit
    }

    Promise.all([
      financeAPI.getExpenses(params),
      financeAPI.getExpenseSummary(dateParams)
    ])
      .then(([expRes, sumRes]) => {
        setExpenses(expRes.data?.expenses || [])
        setPagination(expRes.data?.pagination || { page: 1, limit: 15, total: 0, pages: 1 })
        setSummary(sumRes.data?.summary || sumRes.data?.totals || sumRes.data)
      })
      .catch(err => {
        console.error("Error loading expenses:", err)
        toast.error(err.response?.data?.message || "Failed to load expenses")
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadExpenses()
  }, [dateParams, categoryFilter, statusFilter, itcFilter, paymentStatusFilter, pagination.page])

  // Computed amounts helper for form preview
  const handleTaxableChange = (val) => {
    const numTaxable = parseFloat(val) || 0
    const numCgst = parseFloat(formData.cgst) || 0
    const numSgst = parseFloat(formData.sgst) || 0
    const numIgst = parseFloat(formData.igst) || 0
    const numCess = parseFloat(formData.cess) || 0
    const totalGst = numCgst + numSgst + numIgst + numCess
    setFormData(prev => ({
      ...prev,
      taxableAmount: val,
      grossAmount: (numTaxable + totalGst).toString()
    }))
  }

  const handleGstChange = (field, val) => {
    const updated = { ...formData, [field]: val }
    const numTaxable = parseFloat(updated.taxableAmount) || 0
    const numCgst = parseFloat(field === "cgst" ? val : updated.cgst) || 0
    const numSgst = parseFloat(field === "sgst" ? val : updated.sgst) || 0
    const numIgst = parseFloat(field === "igst" ? val : updated.igst) || 0
    const numCess = parseFloat(field === "cess" ? val : updated.cess) || 0
    const totalGst = numCgst + numSgst + numIgst + numCess
    setFormData({
      ...updated,
      grossAmount: (numTaxable + totalGst).toString()
    })
  }

  const handleCreateExpense = async (e) => {
    e.preventDefault()
    setFormError("")

    // Validate
    if (!formData.description.trim()) {
      setFormError("Expense description is required")
      return
    }
    if (!formData.category) {
      setFormError("Category is required")
      return
    }
    if (!formData.vendorName.trim()) {
      setFormError("Vendor name is required")
      return
    }
    const taxableNum = parseFloat(formData.taxableAmount)
    if (isNaN(taxableNum) || taxableNum < 0) {
      setFormError("Taxable amount must be a valid non-negative number")
      return
    }

    setFormSubmitting(true)
    try {
      const payload = {
        expenseDate: formData.expenseDate,
        category: formData.category,
        subcategory: formData.subcategory,
        description: formData.description,
        vendor: {
          name: formData.vendorName,
          gstin: formData.vendorGstin,
          pan: formData.vendorPan
        },
        invoiceNumber: formData.invoiceNumber,
        invoiceDate: formData.invoiceDate || null,
        taxableAmount: taxableNum,
        cgst: parseFloat(formData.cgst) || 0,
        sgst: parseFloat(formData.sgst) || 0,
        igst: parseFloat(formData.igst) || 0,
        cess: parseFloat(formData.cess) || 0,
        grossAmount: parseFloat(formData.grossAmount) || undefined,
        paymentMethod: formData.paymentMethod,
        paymentStatus: formData.paymentStatus,
        itcEligibility: formData.itcEligibility,
        itcAmount: formData.itcAmount ? parseFloat(formData.itcAmount) : undefined,
        notes: formData.notes
      }

      await financeAPI.createExpense(payload)
      toast.success("Expense voucher recorded successfully")
      setShowCreateModal(false)
      setFormData(initialFormState)
      loadExpenses()
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || "Failed to record expense")
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleCancelExpense = async (id) => {
    if (!window.confirm("Are you sure you want to cancel this expense voucher?")) return
    setCancellingId(id)
    try {
      await financeAPI.cancelExpense(id)
      toast.success("Expense cancelled")
      loadExpenses()
      if (selectedExpense?._id === id) setSelectedExpense(null)
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to cancel expense")
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display tracking-wide">Expense Management</h2>
          <p className="text-xs text-white/50">Operational spend recording, vendor vouchers, and ITC validation</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-acid text-dark-900 font-semibold px-4 py-2 rounded-xl text-xs hover:bg-acid/90 transition shadow-lg shrink-0"
        >
          <FiPlus size={16} /> Record New Expense
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="card p-4 space-y-1 border-white/10">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>Total Gross Spend</span>
            <ProvenanceTag type="ACTUAL" />
          </div>
          <div className="text-xl font-bold text-white">
            ₹{(summary?.grossSpend || summary?.totalGross || 0).toLocaleString()}
          </div>
          <p className="text-[10px] text-white/40">{summary?.totalExpenses || pagination.total || 0} vouchers recorded</p>
        </div>

        <div className="card p-4 space-y-1 border-white/10">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>Taxable Spend</span>
            <ProvenanceTag type="ACTUAL" />
          </div>
          <div className="text-xl font-bold text-white/90">
            ₹{(summary?.taxableSpend || summary?.totalTaxable || 0).toLocaleString()}
          </div>
          <p className="text-[10px] text-white/40">Base procurement & OPEX</p>
        </div>

        <div className="card p-4 space-y-1 border-white/10">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>GST Paid</span>
            <ProvenanceTag type="ACTUAL" />
          </div>
          <div className="text-xl font-bold text-rose-400">
            ₹{(summary?.totalGstPaid || summary?.totalGst || 0).toLocaleString()}
          </div>
          <p className="text-[10px] text-white/40">Input tax on vendor invoices</p>
        </div>

        <div className="card p-4 space-y-1 border-white/10">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>Eligible ITC</span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold">GST CREDIT</span>
          </div>
          <div className="text-xl font-bold text-emerald-400">
            ₹{(summary?.totalItcEligible || 0).toLocaleString()}
          </div>
          <p className="text-[10px] text-white/40">Available input credit</p>
        </div>

        <div className="card p-4 space-y-1 border-white/10">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>Pending ITC</span>
            <span className="text-[10px] text-amber-400 font-mono font-bold">UNVERIFIED</span>
          </div>
          <div className="text-xl font-bold text-amber-400">
            ₹{(summary?.totalItcPending || 0).toLocaleString()}
          </div>
          <p className="text-[10px] text-white/40">Awaiting vendor GST filing</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-white/60 mr-1">
            <FiFilter size={14} /> Filter By:
          </div>

          <select
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
            className="input py-1.5 px-3 bg-dark-700 border-white/10 text-xs rounded-xl"
          >
            <option value="all">All Categories</option>
            {EXPENSE_CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
            className="input py-1.5 px-3 bg-dark-700 border-white/10 text-xs rounded-xl"
          >
            <option value="all">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="cancelled">Cancelled</option>
            <option value="draft">Draft</option>
          </select>

          <select
            value={itcFilter}
            onChange={e => { setItcFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
            className="input py-1.5 px-3 bg-dark-700 border-white/10 text-xs rounded-xl"
          >
            <option value="all">All ITC Statuses</option>
            <option value="eligible">Eligible</option>
            <option value="pending_verification">Pending Verification</option>
            <option value="ineligible">Ineligible</option>
            <option value="blocked">Blocked</option>
          </select>

          <select
            value={paymentStatusFilter}
            onChange={e => { setPaymentStatusFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
            className="input py-1.5 px-3 bg-dark-700 border-white/10 text-xs rounded-xl"
          >
            <option value="all">All Payment Statuses</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="partially_paid">Partially Paid</option>
          </select>
        </div>

        <div className="text-white/40 text-[11px]">
          Showing {expenses.length} of {pagination.total} records
        </div>
      </div>

      {/* Expenses Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-20"><Loading /></div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <FiFileText size={36} className="mx-auto text-white/20" />
            <p className="text-sm text-white/60 font-medium">No expense records found</p>
            <p className="text-xs text-white/30">Adjust your filters or record a new expense voucher</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-dark-700/60 text-white/40 uppercase tracking-wider font-mono text-[10px] border-b border-white/5">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Taxable (₹)</th>
                  <th className="py-3 px-4 text-right">GST (₹)</th>
                  <th className="py-3 px-4 text-right">Gross (₹)</th>
                  <th className="py-3 px-4 text-center">ITC</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {expenses.map(exp => (
                  <tr key={exp._id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3 px-4 font-mono text-white/70 whitespace-nowrap">
                      {new Date(exp.expenseDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-white truncate max-w-[140px]">{exp.vendor?.name}</p>
                      {exp.vendor?.gstin && (
                        <p className="text-[10px] font-mono text-white/40 truncate max-w-[140px]">{exp.vendor.gstin}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize text-white/80">{exp.category?.replace("_", " ")}</span>
                    </td>
                    <td className="py-3 px-4 text-white/60 max-w-xs truncate">
                      {exp.description}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-white/90">
                      ₹{(exp.taxableAmount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-400">
                      ₹{(exp.totalGst || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-white">
                      ₹{(exp.grossAmount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <ItcBadge eligibility={exp.itcEligibility} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={exp.status} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedExpense(exp)}
                          title="View Details"
                          className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition"
                        >
                          <FiEye size={14} />
                        </button>
                        {exp.status !== "cancelled" && (
                          <button
                            onClick={() => handleCancelExpense(exp._id)}
                            disabled={cancellingId === exp._id}
                            title="Cancel Expense"
                            className="p-1.5 text-rose-400/60 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        )}
                      </div>
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

      {/* CREATE EXPENSE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-dark-800 border border-white/10 rounded-2xl w-full max-w-2xl p-6 space-y-5 my-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <FiDollarSign className="text-acid" size={20} />
                <h3 className="font-display text-lg tracking-wide">Record Expense Voucher</h3>
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

            <form onSubmit={handleCreateExpense} className="space-y-4 text-xs">
              {/* Row 1: Date & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/60 mb-1 font-medium">Expense Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.expenseDate}
                    onChange={e => setFormData({ ...formData, expenseDate: e.target.value })}
                    className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-1 font-medium">Category *</label>
                  <select
                    required
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                  >
                    {EXPENSE_CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Description & Subcategory */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-white/60 mb-1 font-medium">Description *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Meta Ads campaign spend or packaging carton order"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-1 font-medium">Subcategory</label>
                  <input
                    type="text"
                    placeholder="e.g. Google Ads"
                    value={formData.subcategory}
                    onChange={e => setFormData({ ...formData, subcategory: e.target.value })}
                    className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                  />
                </div>
              </div>

              {/* Row 3: Vendor Details */}
              <div className="border-t border-white/5 pt-3">
                <p className="font-semibold text-white/80 mb-2">Vendor Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-white/60 mb-1">Vendor Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Meta Platforms Ireland"
                      value={formData.vendorName}
                      onChange={e => setFormData({ ...formData, vendorName: e.target.value })}
                      className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">GSTIN</label>
                    <input
                      type="text"
                      placeholder="27ABCDE1234F1Z5"
                      value={formData.vendorGstin}
                      onChange={e => setFormData({ ...formData, vendorGstin: e.target.value.toUpperCase() })}
                      className="input w-full bg-dark-700 border-white/10 text-xs py-2 font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">PAN</label>
                    <input
                      type="text"
                      placeholder="ABCDE1234F"
                      value={formData.vendorPan}
                      onChange={e => setFormData({ ...formData, vendorPan: e.target.value.toUpperCase() })}
                      className="input w-full bg-dark-700 border-white/10 text-xs py-2 font-mono uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: Invoice Details */}
              <div className="border-t border-white/5 pt-3">
                <p className="font-semibold text-white/80 mb-2">Invoice Reference</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/60 mb-1">Invoice Number</label>
                    <input
                      type="text"
                      placeholder="INV-2026-0091"
                      value={formData.invoiceNumber}
                      onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })}
                      className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">Invoice Date</label>
                    <input
                      type="date"
                      value={formData.invoiceDate}
                      onChange={e => setFormData({ ...formData, invoiceDate: e.target.value })}
                      className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                    />
                  </div>
                </div>
              </div>

              {/* Row 5: Financials & Taxes */}
              <div className="border-t border-white/5 pt-3">
                <p className="font-semibold text-white/80 mb-2">Amounts & GST Breakdown (₹)</p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-white/60 mb-1">Taxable Amount *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      placeholder="10000"
                      value={formData.taxableAmount}
                      onChange={e => handleTaxableChange(e.target.value)}
                      className="input w-full bg-dark-700 border-white/10 text-xs py-2 font-semibold text-acid"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">CGST</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.cgst}
                      onChange={e => handleGstChange("cgst", e.target.value)}
                      className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">SGST</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.sgst}
                      onChange={e => handleGstChange("sgst", e.target.value)}
                      className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">IGST</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.igst}
                      onChange={e => handleGstChange("igst", e.target.value)}
                      className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">
                      Gross Amount <span className="text-[10px] text-white/40 font-normal">(Preview — server authoritative)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.grossAmount}
                      onChange={e => setFormData({ ...formData, grossAmount: e.target.value })}
                      className="input w-full bg-dark-700 border-white/10 text-xs py-2 font-bold text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Row 6: ITC & Payment */}
              <div className="border-t border-white/5 pt-3">
                <p className="font-semibold text-white/80 mb-2">ITC Eligibility & Payment Mode</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-white/60 mb-1">ITC Eligibility</label>
                    <select
                      value={formData.itcEligibility}
                      onChange={e => setFormData({ ...formData, itcEligibility: e.target.value })}
                      className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                    >
                      {ITC_ELIGIBILITY_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">Payment Method</label>
                    <select
                      value={formData.paymentMethod}
                      onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                      className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                    >
                      <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                      <option value="upi">UPI</option>
                      <option value="card">Corporate Card</option>
                      <option value="cash">Petty Cash</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">Payment Status</label>
                    <select
                      value={formData.paymentStatus}
                      onChange={e => setFormData({ ...formData, paymentStatus: e.target.value })}
                      className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                    >
                      <option value="paid">Paid</option>
                      <option value="unpaid">Unpaid / Accrued</option>
                      <option value="partially_paid">Partially Paid</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 7: Notes */}
              <div>
                <label className="block text-white/60 mb-1">Internal Notes</label>
                <textarea
                  rows="2"
                  placeholder="Optional audit notes or reference link"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="input w-full bg-dark-700 border-white/10 text-xs py-2"
                />
              </div>

              {/* Modal Actions */}
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
                  {formSubmitting ? "Recording..." : "Record Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW EXPENSE DETAILS DRAWER/MODAL */}
      {selectedExpense && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FiFileText className="text-acid" size={18} />
                <h3 className="font-display text-base tracking-wide">Expense Voucher Details</h3>
              </div>
              <button onClick={() => setSelectedExpense(null)} className="text-white/40 hover:text-white">
                <FiX size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Voucher ID:</span>
                <span className="font-mono text-white/80">{selectedExpense._id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Expense Date:</span>
                <span className="font-semibold text-white">{new Date(selectedExpense.expenseDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Category:</span>
                <span className="font-semibold capitalize text-white">{selectedExpense.category?.replace("_", " ")}</span>
              </div>
              {selectedExpense.subcategory && (
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-white/50">Subcategory:</span>
                  <span className="text-white">{selectedExpense.subcategory}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Description:</span>
                <span className="font-medium text-white max-w-[280px] text-right">{selectedExpense.description}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Vendor Name:</span>
                <span className="font-semibold text-white">{selectedExpense.vendor?.name}</span>
              </div>
              {selectedExpense.vendor?.gstin && (
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-white/50">Vendor GSTIN:</span>
                  <span className="font-mono text-white/90">{selectedExpense.vendor.gstin}</span>
                </div>
              )}
              {selectedExpense.invoiceNumber && (
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-white/50">Invoice No / Date:</span>
                  <span className="font-mono text-white/80">
                    {selectedExpense.invoiceNumber} {selectedExpense.invoiceDate ? `(${new Date(selectedExpense.invoiceDate).toLocaleDateString()})` : ""}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Taxable Amount:</span>
                <span className="font-bold text-white">₹{(selectedExpense.taxableAmount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">GST (CGST + SGST + IGST):</span>
                <span className="font-bold text-rose-400">₹{(selectedExpense.totalGst || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Gross Amount:</span>
                <span className="font-bold text-acid text-sm">₹{(selectedExpense.grossAmount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">ITC Eligibility:</span>
                <ItcBadge eligibility={selectedExpense.itcEligibility} />
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Eligible ITC Claim:</span>
                <span className="font-semibold text-emerald-400">₹{(selectedExpense.itcAmount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/50">Payment Status / Mode:</span>
                <span className="capitalize text-white/80">{selectedExpense.paymentStatus} via {selectedExpense.paymentMethod?.replace("_", " ")}</span>
              </div>
              {selectedExpense.notes && (
                <div className="py-1">
                  <span className="text-white/50 block mb-0.5">Notes:</span>
                  <p className="p-2 bg-dark-700/50 rounded-xl text-white/70 text-[11px]">{selectedExpense.notes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                onClick={() => setSelectedExpense(null)}
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
