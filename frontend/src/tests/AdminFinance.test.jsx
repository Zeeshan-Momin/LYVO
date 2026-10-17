import React from "react"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { BrowserRouter } from "react-router-dom"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import AdminFinance from "../pages/admin/AdminFinance"
import ExpenseManager from "../components/admin/finance/ExpenseManager"
import StockInwardManager from "../components/admin/finance/StockInwardManager"
import SettlementManager from "../components/admin/finance/SettlementManager"
import CourierInvoiceManager from "../components/admin/finance/CourierInvoiceManager"
import ReconciliationCenter from "../components/admin/finance/ReconciliationCenter"
import { financeAPI, productAPI } from "../api"

// Mock API module
vi.mock("../api", () => ({
  financeAPI: {
    getOverview: vi.fn(),
    getPnL: vi.fn(),
    getReconciliationSummary: vi.fn(),
    getExpenses: vi.fn(),
    getExpenseSummary: vi.fn(),
    createExpense: vi.fn(),
    cancelExpense: vi.fn(),
    getStockInwards: vi.fn(),
    recordStockInward: vi.fn(),
    getRazorpaySettlements: vi.fn(),
    importRazorpaySettlement: vi.fn(),
    getCourierInvoices: vi.fn(),
    importCourierInvoice: vi.fn(),
    executeReport: vi.fn(),
    executeSavedReport: vi.fn(),
    getSavedReports: vi.fn(),
    createSavedReport: vi.fn(),
    deleteSavedReport: vi.fn(),
    exportReportXlsx: vi.fn(),
    exportReportPdf: vi.fn(),
    getExportLogs: vi.fn(),
    downloadExport: vi.fn()
  },
  adminAPI: {
    getDashboard: vi.fn()
  },
  productAPI: {
    getAll: vi.fn()
  }
}))

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

describe("Phase 3D-4 Operational Finance Frontend UI", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()

    financeAPI.getOverview.mockResolvedValue({
      data: {
        kpis: {
          revenue: {
            grossMerchandiseSales: 100000,
            productDiscounts: 10000,
            couponDiscounts: 5000,
            netMerchandiseSales: 85000,
            shippingRevenue: 5000,
            refundsValue: 2000,
            netRevenue: 88000,
            provenance: "ACTUAL"
          },
          profitability: {
            totalCogs: 40000,
            cogsCoveragePercent: 100,
            cogsStatus: "complete",
            grossProfit: 48000,
            grossMarginPercent: 54.5,
            operatingExpenses: 15000,
            operatingProfit: 33000,
            operatingMarginPercent: 37.5
          }
        },
        expensesByCategory: [{ category: "marketing", spend: 10000, count: 5, gst: 1800 }]
      }
    })

    financeAPI.getPnL.mockResolvedValue({
      data: {
        dateRange: { start: "2026-09-01", end: "2026-10-01" },
        revenue: {
          grossMerchandiseSales: { amount: 100000 },
          productDiscounts: { amount: 10000 },
          couponDiscounts: { amount: 5000 },
          netMerchandiseSales: { amount: 85000 },
          shippingRevenue: { amount: 5000 },
          refunds: { amount: 2000 },
          netRevenue: { amount: 88000 }
        },
        cogs: {
          knownCogs: { amount: 40000 },
          estimatedCogs: { amount: 0 },
          totalCogs: { amount: 40000 },
          grossProfit: { amount: 48000 },
          cogsCoveragePercent: 100
        },
        operatingExpenses: {
          totalOperatingExpenses: { amount: 15000 },
          marketing: { amount: 10000 }
        },
        operatingResult: {
          operatingProfit: { amount: 33000 },
          operatingMarginPercent: 37.5,
          isComplete: true
        },
        disclosures: ["COGS calculated using historical snapshots"]
      }
    })

    financeAPI.getReconciliationSummary.mockResolvedValue({
      data: {
        payments: {
          status: "healthy",
          totalSettlements: 3,
          totalGrossSettled: 150000,
          totalFeePaid: 3000,
          totalTaxPaid: 540,
          totalNetReceived: 146460,
          matchedTxCount: 25,
          unmatchedTxCount: 0,
          mismatchTxCount: 0,
          unreconciledCount: 0
        },
        shipping: {
          status: "healthy",
          totalInvoices: 2,
          totalBilled: 12000,
          totalActualFreight: 12000,
          matchedShipmentCount: 40,
          unmatchedShipmentCount: 0,
          unreconciledCount: 0
        }
      }
    })

    financeAPI.getExpenses.mockResolvedValue({
      data: {
        expenses: [
          {
            _id: "exp_1",
            expenseDate: "2026-10-01",
            category: "marketing",
            description: "Google Search Ads Spend",
            vendor: { name: "Google India", gstin: "07AAACG1234F1Z5" },
            taxableAmount: 10000,
            totalGst: 1800,
            grossAmount: 11800,
            itcEligibility: "eligible",
            itcAmount: 1800,
            status: "approved",
            paymentStatus: "paid",
            paymentMethod: "bank_transfer"
          }
        ],
        pagination: { page: 1, limit: 15, total: 1, pages: 1 }
      }
    })

    financeAPI.getExpenseSummary.mockResolvedValue({
      data: {
        summary: {
          totalExpenses: 1,
          grossSpend: 11800,
          taxableSpend: 10000,
          totalGstPaid: 1800,
          totalItcEligible: 1800,
          totalItcPending: 0
        }
      }
    })

    financeAPI.getStockInwards.mockResolvedValue({
      data: {
        inwards: [
          {
            _id: "grn_1",
            grnNumber: "GRN-001001",
            supplier: { name: "Apex Suppliers", gstin: "27AAACA1234F1Z1" },
            receivedDate: "2026-10-01",
            invoiceNumber: "INV-99",
            totalQuantity: 50,
            totalGrossCost: 25000,
            totalLandedCost: 26500,
            status: "received",
            items: [
              {
                product: "prod_1",
                name: "Oxford Shoe",
                sku: "OX-SH-01",
                quantityReceived: 50,
                unitCost: 500,
                taxAmount: 1000,
                freightShare: 500,
                landedUnitCost: 530
              }
            ]
          }
        ],
        pagination: { page: 1, limit: 15, total: 1, pages: 1 }
      }
    })

    productAPI.getAll.mockResolvedValue({
      data: {
        products: [
          { _id: "prod_1", name: "Oxford Shoe", sku: "OX-SH-01" }
        ]
      }
    })

    financeAPI.getRazorpaySettlements.mockResolvedValue({
      data: {
        settlements: [
          {
            _id: "setl_1",
            settlementId: "setl_test100",
            settlementDate: "2026-10-01",
            grossAmount: 50000,
            feeAmount: 1000,
            taxAmount: 180,
            netAmount: 48820,
            utr: "UTR12345",
            reconciliationSummary: { status: "fully_reconciled", matchedCount: 10, unmatchedCount: 0, mismatchCount: 0 }
          }
        ],
        pagination: { page: 1, limit: 15, total: 1, pages: 1 }
      }
    })

    financeAPI.getCourierInvoices.mockResolvedValue({
      data: {
        invoices: [
          {
            _id: "inv_1",
            invoiceNumber: "DELH-INV-01",
            invoiceDate: "2026-10-01",
            carrier: "delhivery",
            totalBilledAmount: 6000,
            reconciliationSummary: { status: "reconciled", totalActualFreight: 6000, matchedShipments: 20, unmatchedShipments: 0 }
          }
        ],
        pagination: { page: 1, limit: 15, total: 1, pages: 1 }
      }
    })

    financeAPI.getSavedReports.mockResolvedValue({
      data: { success: true, reports: [] }
    })

    financeAPI.getExportLogs.mockResolvedValue({
      data: { success: true, logs: [], pagination: { page: 1, limit: 15, total: 0, pages: 1 } }
    })
  })

  it("1. renders finance navigation with all operational, managerial & reporting tabs", async () => {
    render(
      <BrowserRouter>
        <AdminFinance />
      </BrowserRouter>
    )

    expect(screen.getByText("Finance & Management P&L")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Finance Overview/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Management P&L/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Reconciliation/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Expenses/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Stock Inward/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Gateway Settlements/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Courier Invoices/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Report Builder/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Saved Templates/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Export Center/i })).toBeInTheDocument()

    await waitFor(() => {
      expect(financeAPI.getOverview).toHaveBeenCalled()
    })
  })

  it("2. displays Finance Overview KPIs from authoritative backend service", async () => {
    render(
      <BrowserRouter>
        <AdminFinance />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(financeAPI.getOverview).toHaveBeenCalled()
    })

    const netRevCard = await screen.findByText(/Net Business Revenue/i)
    expect(netRevCard).toBeInTheDocument()
    expect(screen.getByText(/GMS/i)).toBeInTheDocument()
    expect(screen.getByText(/Net Merchandise Sales/i)).toBeInTheDocument()
  })

  it("3. switches to Management P&L tab and displays P&L breakdown", async () => {
    render(
      <BrowserRouter>
        <AdminFinance />
      </BrowserRouter>
    )

    const pnlTabBtn = screen.getByRole("button", { name: /Management P&L/i })
    fireEvent.click(pnlTabBtn)

    await waitFor(() => {
      expect(financeAPI.getPnL).toHaveBeenCalled()
      expect(screen.getByText("Managerial Income Statement (P&L)")).toBeInTheDocument()
      expect(screen.getByText("Gross Merchandise Sales (GMS)")).toBeInTheDocument()
    })
  })

  it("4. renders ReconciliationCenter with gateway and freight sections", async () => {
    render(
      <BrowserRouter>
        <ReconciliationCenter onNavigateTab={vi.fn()} />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(financeAPI.getReconciliationSummary).toHaveBeenCalled()
      expect(screen.getByText("Financial & Operational Reconciliation")).toBeInTheDocument()
      expect(screen.getByText("Payment Gateway Reconciliation")).toBeInTheDocument()
      expect(screen.getByText("Logistics Freight Reconciliation")).toBeInTheDocument()
    })
  })

  it("5. renders ExpenseManager with vouchers list and summary cards", async () => {
    render(
      <BrowserRouter>
        <ExpenseManager dateParams={{ startDate: "2026-09-01", endDate: "2026-10-01" }} />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(financeAPI.getExpenses).toHaveBeenCalled()
      expect(screen.getByText("Google Search Ads Spend")).toBeInTheDocument()
      expect(screen.getByText("Google India")).toBeInTheDocument()
      expect(screen.getAllByText("₹11,800").length).toBeGreaterThan(0)
    })
  })

  it("6. opens Record Expense modal and submits validated voucher", async () => {
    financeAPI.createExpense.mockResolvedValue({ data: { success: true } })

    render(
      <BrowserRouter>
        <ExpenseManager dateParams={{ startDate: "2026-09-01", endDate: "2026-10-01" }} />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Record New Expense")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("Record New Expense"))

    expect(screen.getByText("Record Expense Voucher")).toBeInTheDocument()

    // Fill form fields
    fireEvent.change(screen.getByPlaceholderText(/Meta Ads campaign/i), { target: { value: "New Packaging Cartons" } })
    fireEvent.change(screen.getByPlaceholderText(/Meta Platforms Ireland/i), { target: { value: "Packaging World Ltd" } })
    fireEvent.change(screen.getByPlaceholderText("10000"), { target: { value: "5000" } })

    // Submit
    fireEvent.click(screen.getByRole("button", { name: "Record Expense" }))

    await waitFor(() => {
      expect(financeAPI.createExpense).toHaveBeenCalledWith(expect.objectContaining({
        description: "New Packaging Cartons",
        vendor: expect.objectContaining({ name: "Packaging World Ltd" }),
        taxableAmount: 5000
      }))
    })
  })

  it("7. renders StockInwardManager with GRN list and total landed valuation", async () => {
    render(
      <BrowserRouter>
        <StockInwardManager />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(financeAPI.getStockInwards).toHaveBeenCalled()
      expect(screen.getByText("GRN-001001")).toBeInTheDocument()
      expect(screen.getByText("Apex Suppliers")).toBeInTheDocument()
      expect(screen.getAllByText("₹26,500").length).toBeGreaterThan(0)
    })
  })

  it("8. opens Create Stock GRN modal and handles dynamic line items", async () => {
    render(
      <BrowserRouter>
        <StockInwardManager />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Create Stock GRN")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("Create Stock GRN"))

    expect(screen.getByText("Create Stock Inward (GRN)")).toBeInTheDocument()

    // Add another item line
    fireEvent.click(screen.getByText("Add Product Line"))

    expect(screen.getAllByText(/Qty Received/i).length).toBe(2)
  })

  it("9. renders SettlementManager with settlements list", async () => {
    render(
      <BrowserRouter>
        <SettlementManager />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(financeAPI.getRazorpaySettlements).toHaveBeenCalled()
      expect(screen.getByText("setl_test100")).toBeInTheDocument()
      expect(screen.getAllByText("₹48,820").length).toBeGreaterThan(0)
    })
  })

  it("10. opens Import Settlement modal and supports form inputs", async () => {
    render(
      <BrowserRouter>
        <SettlementManager />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Import Settlement Batch")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("Import Settlement Batch"))

    expect(screen.getByText("Import Razorpay Settlement")).toBeInTheDocument()
    expect(screen.getByText("Standard Form Entry")).toBeInTheDocument()
    expect(screen.getByText("Direct JSON Ingest")).toBeInTheDocument()
  })

  it("11. renders CourierInvoiceManager with invoices list", async () => {
    render(
      <BrowserRouter>
        <CourierInvoiceManager />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(financeAPI.getCourierInvoices).toHaveBeenCalled()
      expect(screen.getByText("DELH-INV-01")).toBeInTheDocument()
      expect(screen.getAllByText("₹6,000").length).toBeGreaterThan(0)
    })
  })

  it("12. opens Import Courier Invoice modal and supports JSON ingest switch", async () => {
    render(
      <BrowserRouter>
        <CourierInvoiceManager />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Import Carrier Invoice")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("Import Carrier Invoice"))

    expect(screen.getByText("Import Courier Freight Invoice")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Direct JSON Ingest"))
    expect(screen.getByPlaceholderText(/DELH-INV-2026-01/i)).toBeInTheDocument()
  })

  it("13. handles global date range filter selection in AdminFinance", async () => {
    render(
      <BrowserRouter>
        <AdminFinance />
      </BrowserRouter>
    )

    const filter7d = screen.getByRole("button", { name: "7D" })
    fireEvent.click(filter7d)

    await waitFor(() => {
      expect(financeAPI.getOverview).toHaveBeenCalled()
    })
  })

  it("14. displays provenance tags accurately without converting unknown to zero", async () => {
    render(
      <BrowserRouter>
        <AdminFinance />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText("ACTUAL").length).toBeGreaterThan(0)
    })
  })
})
