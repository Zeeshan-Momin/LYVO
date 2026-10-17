import { useState, useEffect } from "react"
import {
  FiDownload, FiRefreshCw, FiFileText, FiCheckCircle,
  FiAlertTriangle, FiClock, FiFilter, FiSearch, FiInfo,
  FiLayers, FiChevronLeft, FiChevronRight
} from "react-icons/fi"
import { financeAPI } from "../../../api"
import Loading from "../../common/Loading"
import toast from "react-hot-toast"

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 KB"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export default function ExportCenter() {
  const [logs, setLogs] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState(null)

  // Filters
  const [formatFilter, setFormatFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const fetchExportHistory = async (page = 1) => {
    setLoading(true)
    try {
      const params = { page, limit: 15 }
      if (formatFilter) params.format = formatFilter
      if (statusFilter) params.status = statusFilter
      if (searchQuery) params.search = searchQuery

      const res = await financeAPI.getExportLogs(params)
      if (res.data?.success) {
        setLogs(res.data.logs || res.data.exports || [])
        if (res.data.pagination) {
          setPagination(res.data.pagination)
        }
      }
    } catch (err) {
      console.error("Failed to load export history:", err)
      toast.error(err.response?.data?.message || "Failed to load export history")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExportHistory(1)
  }, [formatFilter, statusFilter])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    fetchExportHistory(1)
  }

  // Authenticated Download
  const handleDownload = async (exportLog) => {
    if (!exportLog.exportId) return
    setDownloadingId(exportLog.exportId)
    try {
      const response = await financeAPI.downloadExport(exportLog.exportId)
      const blob = new Blob([response.data], {
        type: response.headers["content-type"] || "application/octet-stream"
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = exportLog.fileName || `LYVO_${exportLog.exportId}.${exportLog.format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success("Download started")
    } catch (err) {
      console.error("Download failed:", err)
      toast.error(err.response?.data?.message || "Authenticated download failed")
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <FiDownload className="text-acid text-xl" />
            <h2 className="text-lg font-semibold text-white">Export Audit Center</h2>
          </div>
          <p className="text-xs text-white/40 mt-0.5">
            Audit history of generated Excel (XLSX) and PDF management reports with secure authenticated downloads
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchExportHistory(pagination.page)}
          className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <FiRefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search by report name or ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input w-full bg-dark-700 border-white/10 pl-9 py-1.5 text-xs"
            />
          </div>
          <button type="submit" className="btn-secondary py-1.5 px-3 text-xs">
            Search
          </button>
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={formatFilter}
            onChange={e => setFormatFilter(e.target.value)}
            className="input bg-dark-700 border-white/10 py-1.5 px-3 text-xs text-white/80"
          >
            <option value="">All Formats (XLSX & PDF)</option>
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="pdf">PDF Document (.pdf)</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="input bg-dark-700 border-white/10 py-1.5 px-3 text-xs text-white/80"
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Table of Exports */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="py-20">
            <Loading />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-white/40 text-xs space-y-2">
            <FiFileText className="mx-auto text-2xl text-white/20" />
            <p className="font-semibold text-white/60">No Export Logs Found</p>
            <p>Generate exports from the Report Builder to see the audit trail here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-dark-700/60 text-white/60 uppercase tracking-wider text-[10px] border-b border-white/5">
                <tr>
                  <th className="py-3 px-4">Export ID</th>
                  <th className="py-3 px-4">Report Name & Scope</th>
                  <th className="py-3 px-4">Format</th>
                  <th className="py-3 px-4 text-right">Rows</th>
                  <th className="py-3 px-4 text-right">File Size</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {logs.map((log) => {
                  const isSuccess = log.status === "completed"
                  const isFailed = log.status === "failed"
                  return (
                    <tr key={log._id || log.exportId} className="hover:bg-white/[0.02] transition">
                      <td className="py-3 px-4 font-mono text-white/70">
                        {log.exportId}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-white">{log.reportName}</p>
                        <span className="text-[10px] font-mono text-acid uppercase">
                          {log.reportType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                            log.format === "xlsx"
                              ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                              : "bg-rose-400/10 text-rose-400 border-rose-400/20"
                          }`}
                        >
                          {log.format}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-white/80">
                        {log.recordCount !== undefined ? log.recordCount.toLocaleString() : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-white/60">
                        {formatFileSize(log.fileSize)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold capitalize border ${
                            isSuccess
                              ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                              : isFailed
                              ? "bg-rose-400/10 text-rose-400 border-rose-400/20"
                              : "bg-amber-400/10 text-amber-400 border-amber-400/20"
                          }`}
                        >
                          {isSuccess && <FiCheckCircle size={10} />}
                          {isFailed && <FiAlertTriangle size={10} />}
                          {log.status}
                        </span>
                        {isFailed && log.errorMessage && (
                          <p className="text-[10px] text-rose-400/80 mt-0.5 max-w-xs truncate">
                            {log.errorMessage}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-white/50 text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isSuccess ? (
                          <button
                            type="button"
                            onClick={() => handleDownload(log)}
                            disabled={downloadingId === log.exportId}
                            className="btn-secondary py-1.5 px-3 text-xs font-semibold inline-flex items-center gap-1.5 text-acid border-acid/30 hover:bg-acid/10 disabled:opacity-50"
                          >
                            {downloadingId === log.exportId ? (
                              <FiRefreshCw className="animate-spin" />
                            ) : (
                              <FiDownload size={13} />
                            )}
                            Download
                          </button>
                        ) : (
                          <span className="text-white/20 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.pages > 1 && (
          <div className="p-4 border-t border-white/5 flex items-center justify-between text-xs text-white/50">
            <span>
              Page {pagination.page} of {pagination.pages} ({pagination.total} exports)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchExportHistory(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="btn-secondary py-1 px-2.5 disabled:opacity-30"
              >
                <FiChevronLeft />
              </button>
              <button
                type="button"
                onClick={() => fetchExportHistory(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="btn-secondary py-1 px-2.5 disabled:opacity-30"
              >
                <FiChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
