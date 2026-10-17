import { useState, useEffect } from "react"
import {
  FiBookmark, FiPlay, FiTrash2, FiDownload, FiRefreshCw,
  FiCalendar, FiPlus, FiAlertTriangle, FiCheckCircle, FiInfo,
  FiFileText, FiLayers, FiX
} from "react-icons/fi"
import { financeAPI } from "../../../api"
import Loading from "../../common/Loading"
import toast from "react-hot-toast"

export default function SavedReportsManager({ onSelectTemplate, onNewReport }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Execution modal state
  const [executingId, setExecutingId] = useState(null)
  const [executedReport, setExecutedReport] = useState(null)
  const [showResultModal, setShowResultModal] = useState(false)

  // Export state
  const [exportingId, setExportingId] = useState(null)

  // Delete modal state
  const [deletingId, setDeletingId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchSavedReports = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await financeAPI.getSavedReports()
      if (res.data?.success) {
        setReports(res.data.reports || [])
      }
    } catch (err) {
      console.error("Failed to fetch saved reports:", err)
      setError(err.response?.data?.message || "Failed to load saved reports")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSavedReports()
  }, [])

  // Execute Saved Template Directly
  const handleExecuteSaved = async (report) => {
    setExecutingId(report._id)
    try {
      const res = await financeAPI.executeSavedReport(report._id)
      if (res.data?.success) {
        setExecutedReport(res.data)
        setShowResultModal(true)
        toast.success(`Executed template '${report.name}'`)
      }
    } catch (err) {
      console.error("Execution failed:", err)
      toast.error(err.response?.data?.message || "Failed to execute saved report")
    } finally {
      setExecutingId(null)
    }
  }

  // Quick Export
  const handleQuickExport = async (report, format) => {
    setExportingId(`${report._id}_${format}`)
    try {
      const apiMethod = format === "xlsx" ? financeAPI.exportReportXlsx : financeAPI.exportReportPdf
      const res = await apiMethod({ savedReportId: report._id })
      if (res.data?.success && res.data?.exportId) {
        toast.success(`${format.toUpperCase()} generated! Initiating download...`)
        const response = await financeAPI.downloadExport(res.data.exportId)
        const blob = new Blob([response.data], {
          type: response.headers["content-type"] || "application/octet-stream"
        })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = res.data.fileName || `LYVO_${report.name}.${format}`
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error("Quick export failed:", err)
      toast.error(err.response?.data?.message || "Quick export failed")
    } finally {
      setExportingId(null)
    }
  }

  // Delete Template
  const handleDeleteConfirm = async () => {
    if (!deletingId) return
    setDeleting(true)
    try {
      const res = await financeAPI.deleteSavedReport(deletingId)
      if (res.data?.success) {
        toast.success("Saved report template deleted")
        setReports(reports.filter(r => r._id !== deletingId))
        setDeletingId(null)
      }
    } catch (err) {
      console.error("Failed to delete saved report:", err)
      toast.error(err.response?.data?.message || "Failed to delete report")
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="py-20">
        <Loading />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <FiBookmark className="text-acid text-xl" />
            <h2 className="text-lg font-semibold text-white">Saved Report Templates</h2>
          </div>
          <p className="text-xs text-white/40 mt-0.5">
            Pre-configured report definitions for recurring managerial analysis and one-click financial exports
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchSavedReports}
            className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5"
          >
            <FiRefreshCw size={13} /> Refresh
          </button>
          {onNewReport && (
            <button
              type="button"
              onClick={onNewReport}
              className="btn-primary py-2 px-3 text-xs font-semibold flex items-center gap-1.5"
            >
              <FiPlus size={14} /> New Report Config
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl flex items-center gap-3 text-xs text-rose-200">
          <FiAlertTriangle className="text-rose-400 shrink-0" size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Templates List */}
      {reports.length === 0 ? (
        <div className="card p-12 text-center space-y-3 border-dashed border-white/10">
          <div className="w-12 h-12 rounded-full bg-dark-700 flex items-center justify-center mx-auto text-white/40">
            <FiBookmark size={22} />
          </div>
          <p className="text-sm font-semibold text-white">No Saved Report Templates</p>
          <p className="text-xs text-white/40 max-w-sm mx-auto">
            Configure report queries in the Report Builder and click "Save Configuration" to store templates for recurring execution.
          </p>
          {onNewReport && (
            <button
              type="button"
              onClick={onNewReport}
              className="btn-secondary py-2 px-4 text-xs inline-flex items-center gap-1.5 text-acid border-acid/30 mt-2"
            >
              <FiPlus size={14} /> Go to Report Builder
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map(report => (
            <div
              key={report._id}
              className="card p-5 space-y-4 hover:border-acid/30 transition group flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white group-hover:text-acid transition">
                      {report.name}
                    </h3>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono bg-acid/10 text-acid border border-acid/20 uppercase font-semibold">
                      {report.reportType}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeletingId(report._id)}
                    className="text-white/30 hover:text-rose-400 transition p-1"
                    title="Delete Template"
                  >
                    <FiTrash2 size={15} />
                  </button>
                </div>

                {report.description ? (
                  <p className="text-xs text-white/50 line-clamp-2 leading-relaxed">
                    {report.description}
                  </p>
                ) : (
                  <p className="text-xs text-white/30 italic">No description provided</p>
                )}

                <div className="p-2.5 bg-dark-700/40 rounded-xl space-y-1 text-[11px] text-white/60">
                  <p><strong>Sort:</strong> {report.sortBy} ({report.sortDir})</p>
                  <p><strong>Columns:</strong> {report.selectedColumns?.length || "Default"} metrics</p>
                  <p className="text-white/40 text-[10px]">
                    Created: {new Date(report.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-white/5 pt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectTemplate) {
                      onSelectTemplate(report)
                    } else {
                      handleExecuteSaved(report)
                    }
                  }}
                  disabled={executingId === report._id}
                  className="btn-primary py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5 flex-1 justify-center disabled:opacity-50"
                >
                  {executingId === report._id ? (
                    <FiRefreshCw className="animate-spin" />
                  ) : (
                    <FiPlay size={13} />
                  )}
                  Execute Report
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleQuickExport(report, "xlsx")}
                    disabled={exportingId === `${report._id}_xlsx`}
                    className="p-2 bg-dark-700 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs transition border border-white/5"
                    title="Export XLSX"
                  >
                    {exportingId === `${report._id}_xlsx` ? <FiRefreshCw className="animate-spin" /> : "XLSX"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickExport(report, "pdf")}
                    disabled={exportingId === `${report._id}_pdf`}
                    className="p-2 bg-dark-700 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs transition border border-white/5"
                    title="Export PDF"
                  >
                    {exportingId === `${report._id}_pdf` ? <FiRefreshCw className="animate-spin" /> : "PDF"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-white/10 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400">
              <FiAlertTriangle size={20} />
              <h3 className="font-semibold text-white">Delete Report Template?</h3>
            </div>
            <p className="text-xs text-white/60">
              Are you sure you want to delete this saved template? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="btn-secondary py-1.5 px-3 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="btn-danger py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5"
              >
                {deleting ? <FiRefreshCw className="animate-spin" /> : <FiTrash2 />}
                Delete Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execution Results Modal */}
      {showResultModal && executedReport && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-white/10 rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="font-semibold text-white text-base">
                  {executedReport.savedReportInfo?.name || "Executed Report"}
                </h3>
                <p className="text-xs text-white/40 mt-0.5">
                  Type: {executedReport.reportMetadata?.reportType} • {executedReport.results?.length || 0} records
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowResultModal(false)}
                className="text-white/40 hover:text-white"
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Summary Metrics */}
              {executedReport.summary && Object.keys(executedReport.summary).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {executedReport.summary.netRevenue !== undefined && (
                    <div className="p-3 bg-dark-700/40 rounded-xl">
                      <p className="text-[11px] text-white/40">Net Revenue</p>
                      <p className="text-base font-bold text-acid font-display">
                        ₹{Number(executedReport.summary.netRevenue).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {executedReport.summary.totalCogs !== undefined && (
                    <div className="p-3 bg-dark-700/40 rounded-xl">
                      <p className="text-[11px] text-white/40">Total COGS</p>
                      <p className="text-base font-bold text-white font-display">
                        ₹{Number(executedReport.summary.totalCogs).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {executedReport.summary.grossProfit !== undefined && (
                    <div className="p-3 bg-dark-700/40 rounded-xl">
                      <p className="text-[11px] text-white/40">Gross Profit</p>
                      <p className="text-base font-bold text-emerald-400 font-display">
                        ₹{Number(executedReport.summary.grossProfit).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Data Table */}
              <div className="overflow-x-auto border border-white/5 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-dark-700 text-white/60 text-[10px] uppercase">
                    <tr>
                      {executedReport.results?.[0]?.orderNumber && <th className="py-2.5 px-3">Order #</th>}
                      {executedReport.results?.[0]?.name && <th className="py-2.5 px-3">Product</th>}
                      {executedReport.results?.[0]?.category && <th className="py-2.5 px-3">Category</th>}
                      {executedReport.results?.[0]?.grossMerchandiseSales !== undefined && <th className="py-2.5 px-3 text-right">GMS</th>}
                      {executedReport.results?.[0]?.netRevenue !== undefined && <th className="py-2.5 px-3 text-right">Net Revenue</th>}
                      {executedReport.results?.[0]?.totalCogs !== undefined && <th className="py-2.5 px-3 text-right">COGS</th>}
                      {executedReport.results?.[0]?.grossProfit !== undefined && <th className="py-2.5 px-3 text-right">Gross Profit</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-sans">
                    {(executedReport.results || []).map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        {row.orderNumber && <td className="py-2 px-3 font-mono font-medium text-white">{row.orderNumber}</td>}
                        {row.name && <td className="py-2 px-3 text-white truncate max-w-xs">{row.name}</td>}
                        {row.category && <td className="py-2 px-3 text-white/70 capitalize">{row.category}</td>}
                        {row.grossMerchandiseSales !== undefined && (
                          <td className="py-2 px-3 text-right">₹{Number(row.grossMerchandiseSales).toLocaleString()}</td>
                        )}
                        {row.netRevenue !== undefined && (
                          <td className="py-2 px-3 text-right text-acid font-semibold">₹{Number(row.netRevenue).toLocaleString()}</td>
                        )}
                        {row.totalCogs !== undefined && (
                          <td className="py-2 px-3 text-right">₹{Number(row.totalCogs || 0).toLocaleString()}</td>
                        )}
                        {row.grossProfit !== undefined && (
                          <td className="py-2 px-3 text-right text-emerald-400 font-semibold">₹{Number(row.grossProfit || 0).toLocaleString()}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowResultModal(false)}
                className="btn-secondary py-2 px-4 text-xs"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
