import React from "react"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { BrowserRouter } from "react-router-dom"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import ReportBuilder from "../components/admin/finance/ReportBuilder"
import SavedReportsManager from "../components/admin/finance/SavedReportsManager"
import ExportCenter from "../components/admin/finance/ExportCenter"
import { financeAPI } from "../api"
import toast from "react-hot-toast"

// Mock API module
vi.mock("../api", () => ({
  financeAPI: {
    executeReport: vi.fn(),
    executeSavedReport: vi.fn(),
    getSavedReports: vi.fn(),
    createSavedReport: vi.fn(),
    deleteSavedReport: vi.fn(),
    exportReportXlsx: vi.fn(),
    exportReportPdf: vi.fn(),
    getExportLogs: vi.fn(),
    downloadExport: vi.fn()
  }
}))

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

describe("Phase 3D-5 Report Builder, Saved Reports & Export UI", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()

    // Global mock for URL.createObjectURL and URL.revokeObjectURL and Anchor click
    global.URL.createObjectURL = vi.fn(() => "blob:http://localhost/mock-download-id")
    global.URL.revokeObjectURL = vi.fn()
    window.HTMLAnchorElement.prototype.click = vi.fn()

    // Default mock responses
    financeAPI.executeReport.mockResolvedValue({
      data: {
        success: true,
        reportMetadata: {
          reportType: "product_profitability",
          name: "Product Profitability & Unit Economics",
          generatedAt: new Date().toISOString(),
          dateRange: { start: "2026-09-01", end: "2026-10-01" },
          rowCount: 2
        },
        disclosures: ["COGS derived exclusively from immutable historical snapshots."],
        summary: {
          netRevenue: 85000,
          totalCogs: 40000,
          grossProfit: 45000,
          operatingProfit: 30000
        },
        results: [
          {
            productId: "p1",
            sku: "OX-BLK-42",
            name: "Classic Oxford Shoes",
            category: "oxford",
            grossMerchandiseSales: 50000,
            couponDiscounts: 2000,
            netMerchandiseSales: 48000,
            shippingRevenue: 2000,
            refunds: 0,
            netRevenue: 50000,
            totalCogs: 22000,
            grossProfit: 28000,
            gatewayFee: 1000,
            freightCost: 2000,
            contributionProfit: 25000,
            provenance: "ACTUAL"
          },
          {
            productId: "p2",
            sku: "CH-BRN-43",
            name: "Chelsea Leather Boots",
            category: "boots",
            grossMerchandiseSales: 40000,
            couponDiscounts: 5000,
            netMerchandiseSales: 35000,
            shippingRevenue: 2000,
            refunds: 2000,
            netRevenue: 35000,
            totalCogs: 18000,
            grossProfit: 17000,
            gatewayFee: 800,
            freightCost: 2200,
            contributionProfit: 14000,
            provenance: "DERIVED"
          }
        ]
      }
    })

    financeAPI.getSavedReports.mockResolvedValue({
      data: {
        success: true,
        reports: [
          {
            _id: "sr_1",
            name: "Monthly Product Margins",
            description: "Detailed profitability breakdown by footwear SKU",
            reportType: "product_profitability",
            filters: { startDate: "2026-09-01", endDate: "2026-10-01" },
            selectedColumns: ["grossMerchandiseSales", "netRevenue", "totalCogs", "contributionProfit"],
            sortBy: "grossMerchandiseSales",
            sortDir: "desc",
            createdAt: "2026-10-01T10:00:00.000Z"
          }
        ]
      }
    })

    financeAPI.executeSavedReport.mockResolvedValue({
      data: {
        success: true,
        savedReportInfo: {
          id: "sr_1",
          name: "Monthly Product Margins"
        },
        reportMetadata: {
          reportType: "product_profitability",
          rowCount: 1
        },
        summary: { netRevenue: 50000, totalCogs: 22000, grossProfit: 28000 },
        results: [
          {
            name: "Classic Oxford Shoes",
            category: "oxford",
            grossMerchandiseSales: 50000,
            netRevenue: 50000,
            totalCogs: 22000,
            grossProfit: 28000
          }
        ]
      }
    })

    financeAPI.createSavedReport.mockResolvedValue({
      data: {
        success: true,
        report: { _id: "sr_new", name: "Custom Quarterly Report" }
      }
    })

    financeAPI.deleteSavedReport.mockResolvedValue({
      data: { success: true, message: "Deleted" }
    })

    financeAPI.exportReportXlsx.mockResolvedValue({
      data: {
        success: true,
        exportId: "exp_xlsx_123",
        fileName: "LYVO_Product_Profitability_exp_xlsx_123.xlsx",
        format: "xlsx"
      }
    })

    financeAPI.exportReportPdf.mockResolvedValue({
      data: {
        success: true,
        exportId: "exp_pdf_456",
        fileName: "LYVO_Product_Profitability_exp_pdf_456.pdf",
        format: "pdf"
      }
    })

    financeAPI.downloadExport.mockResolvedValue({
      data: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
    })

    financeAPI.getExportLogs.mockResolvedValue({
      data: {
        success: true,
        logs: [
          {
            _id: "log_1",
            exportId: "exp_172854001",
            reportName: "Product Profitability Statement",
            reportType: "product_profitability",
            format: "xlsx",
            recordCount: 45,
            fileSize: 1048576,
            status: "completed",
            fileName: "LYVO_Product_Profitability.xlsx",
            createdAt: "2026-10-02T14:30:00.000Z"
          },
          {
            _id: "log_2",
            exportId: "exp_172854002",
            reportName: "Operational Expense Audit",
            reportType: "expenses",
            format: "pdf",
            recordCount: 120,
            fileSize: 524288,
            status: "completed",
            fileName: "LYVO_Expenses.pdf",
            createdAt: "2026-10-02T15:00:00.000Z"
          }
        ],
        pagination: { page: 1, limit: 15, total: 2, pages: 1 }
      }
    })
  })

  it("1. renders ReportBuilder with report types, date range, dimensions, and metrics", () => {
    render(<ReportBuilder />)

    expect(screen.getByText("Interactive Report Builder")).toBeInTheDocument()
    expect(screen.getByText("Management P&L Statement")).toBeInTheDocument()
    expect(screen.getByText("Product Profitability & Unit Economics")).toBeInTheDocument()
    expect(screen.getByText("Category & Gender Profitability")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Run Authoritative Report/i })).toBeInTheDocument()
  })

  it("2. allows switching report type and changing date range preset", () => {
    render(<ReportBuilder />)

    const pnlOption = screen.getByText("Management P&L Statement")
    fireEvent.click(pnlOption)

    const sevenDayBtn = screen.getByRole("button", { name: "7D" })
    fireEvent.click(sevenDayBtn)
    expect(sevenDayBtn).toHaveClass("bg-acid")
  })

  it("3. toggles dimensions and metrics in custom/profitability report types", () => {
    render(<ReportBuilder />)

    const skuDimBtn = screen.getByRole("button", { name: /SKU Code/i })
    fireEvent.click(skuDimBtn)
    expect(skuDimBtn).toHaveClass("bg-acid/20")
  })

  it("4. executes authoritative report query and renders results table & summary KPIs", async () => {
    render(<ReportBuilder />)

    const runBtn = screen.getByRole("button", { name: /Run Authoritative Report/i })
    fireEvent.click(runBtn)

    await waitFor(() => {
      expect(financeAPI.executeReport).toHaveBeenCalled()
    })

    expect(await screen.findByText("Classic Oxford Shoes")).toBeInTheDocument()
    expect(screen.getByText("Chelsea Leather Boots")).toBeInTheDocument()
    expect(screen.getByText("OX-BLK-42")).toBeInTheDocument()
    expect(screen.getByText(/COGS derived exclusively from immutable historical snapshots/i)).toBeInTheDocument()
  })

  it("5. validates date inputs so start date cannot be after end date", async () => {
    const { container } = render(<ReportBuilder />)

    const dateInputs = container.querySelectorAll('input[type="date"]')
    const startInput = dateInputs[0]
    const endInput = dateInputs[1]

    fireEvent.change(startInput, { target: { value: "2026-12-31" } })
    fireEvent.change(endInput, { target: { value: "2026-01-01" } })

    const runBtn = screen.getByRole("button", { name: /Run Authoritative Report/i })
    fireEvent.click(runBtn)

    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/start date cannot be after end date/i))
    expect(financeAPI.executeReport).not.toHaveBeenCalled()
  })

  it("6. triggers XLSX export and initiates authenticated download flow", async () => {
    render(<ReportBuilder />)

    // First execute report so export buttons are visible
    fireEvent.click(screen.getByRole("button", { name: /Run Authoritative Report/i }))
    await screen.findByText("Classic Oxford Shoes")

    const exportXlsxBtn = screen.getByRole("button", { name: /Export XLSX/i })
    fireEvent.click(exportXlsxBtn)

    await waitFor(() => {
      expect(financeAPI.exportReportXlsx).toHaveBeenCalled()
      expect(financeAPI.downloadExport).toHaveBeenCalledWith("exp_xlsx_123")
      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })
  })

  it("7. triggers PDF export and initiates authenticated download flow", async () => {
    render(<ReportBuilder />)

    fireEvent.click(screen.getByRole("button", { name: /Run Authoritative Report/i }))
    await screen.findByText("Classic Oxford Shoes")

    const exportPdfBtn = screen.getByRole("button", { name: /Export PDF/i })
    fireEvent.click(exportPdfBtn)

    await waitFor(() => {
      expect(financeAPI.exportReportPdf).toHaveBeenCalled()
      expect(financeAPI.downloadExport).toHaveBeenCalledWith("exp_pdf_456")
    })
  })

  it("8. opens Save Configuration modal and saves report template", async () => {
    render(<ReportBuilder />)

    const saveConfigBtn = screen.getByRole("button", { name: /Save Configuration/i })
    fireEvent.click(saveConfigBtn)

    expect(screen.getByText("Save Report Configuration")).toBeInTheDocument()

    const nameInput = screen.getByPlaceholderText(/Monthly Footwear Unit Economics/i)
    fireEvent.change(nameInput, { target: { value: "Q3 Unit Economics Audit" } })

    const submitBtn = screen.getByRole("button", { name: /Save Template/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(financeAPI.createSavedReport).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Q3 Unit Economics Audit"
        })
      )
    })
  })

  it("9. lists saved templates in SavedReportsManager", async () => {
    render(<SavedReportsManager />)

    await waitFor(() => {
      expect(financeAPI.getSavedReports).toHaveBeenCalled()
    })

    expect(await screen.findByText("Monthly Product Margins")).toBeInTheDocument()
    expect(screen.getByText("Detailed profitability breakdown by footwear SKU")).toBeInTheDocument()
  })

  it("10. executes saved report directly from SavedReportsManager", async () => {
    render(<SavedReportsManager />)

    const executeBtn = await screen.findByRole("button", { name: /Execute Report/i })
    fireEvent.click(executeBtn)

    await waitFor(() => {
      expect(financeAPI.executeSavedReport).toHaveBeenCalledWith("sr_1")
    })

    expect(await screen.findByText("Close Viewer")).toBeInTheDocument()
  })

  it("11. deletes saved report template with confirmation", async () => {
    render(<SavedReportsManager />)

    const deleteIconBtn = await screen.findByTitle("Delete Template")
    fireEvent.click(deleteIconBtn)

    expect(screen.getByText("Delete Report Template?")).toBeInTheDocument()

    const deleteButtons = screen.getAllByRole("button", { name: /Delete Template/i })
    const confirmDeleteBtn = deleteButtons[deleteButtons.length - 1]
    fireEvent.click(confirmDeleteBtn)

    await waitFor(() => {
      expect(financeAPI.deleteSavedReport).toHaveBeenCalledWith("sr_1")
    })
  })

  it("12. renders ExportCenter with export audit logs and format badges", async () => {
    render(<ExportCenter />)

    await waitFor(() => {
      expect(financeAPI.getExportLogs).toHaveBeenCalled()
    })

    expect(await screen.findByText("exp_172854001")).toBeInTheDocument()
    expect(screen.getByText("Product Profitability Statement")).toBeInTheDocument()
    expect(screen.getByText("Operational Expense Audit")).toBeInTheDocument()
    expect(screen.getByText("xlsx")).toBeInTheDocument()
    expect(screen.getByText("pdf")).toBeInTheDocument()
  })

  it("13. downloads completed export file safely via authenticated download in ExportCenter", async () => {
    render(<ExportCenter />)

    const downloadButtons = await screen.findAllByRole("button", { name: /Download/i })
    fireEvent.click(downloadButtons[0])

    await waitFor(() => {
      expect(financeAPI.downloadExport).toHaveBeenCalledWith("exp_172854001")
      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })
  })

  it("14. displays error message when backend report execution fails", async () => {
    financeAPI.executeReport.mockRejectedValueOnce({
      response: { data: { message: "Requested export row limit exceeds the maximum allowed" } }
    })

    render(<ReportBuilder />)

    fireEvent.click(screen.getByRole("button", { name: /Run Authoritative Report/i }))

    expect(await screen.findByText("Report Execution Failed")).toBeInTheDocument()
    expect(screen.getByText(/Requested export row limit exceeds the maximum allowed/i)).toBeInTheDocument()
  })
})
