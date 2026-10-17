import React from "react"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import GeographyAnalyticsTab from "../pages/admin/analytics/GeographyAnalyticsTab"
import { adminAPI } from "../api"

// Mock ResponsiveContainer and Recharts components for jsdom
vi.mock("recharts", () => {
  const Original = vi.importActual("recharts")
  return {
    ...Original,
    ResponsiveContainer: ({ children }) => <div className="recharts-responsive-container">{children}</div>,
    BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
    Bar: () => <div data-testid="bar" />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: () => <div data-testid="tooltip" />
  }
})

// Mock API module
vi.mock("../api", () => ({
  adminAPI: {
    getGeographyAnalytics: vi.fn()
  }
}))

describe("GeographyAnalyticsTab Regression & Contract Tests", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("1. renders normal geographic analytics data correctly without errors", async () => {
    adminAPI.getGeographyAnalytics.mockResolvedValueOnce({
      data: {
        success: true,
        states: [
          {
            state: "Maharashtra",
            orders: 120,
            grossRevenue: 250000,
            netSales: 240000,
            unitsSold: 300,
            uniqueCustomers: 95
          },
          {
            state: "Karnataka",
            orders: 80,
            grossRevenue: 180000,
            netSales: 175000,
            unitsSold: 210,
            uniqueCustomers: 65
          }
        ],
        cities: [
          {
            city: "Mumbai",
            state: "Maharashtra",
            orders: 90,
            revenue: 190000,
            unitsSold: 220
          },
          {
            city: "Bengaluru",
            state: "Karnataka",
            orders: 75,
            revenue: 165000,
            unitsSold: 195
          }
        ]
      }
    })

    render(<GeographyAnalyticsTab dateParams={{ startDate: "2026-01-01", endDate: "2026-01-31" }} />)

    await waitFor(() => {
      expect(screen.getAllByText("Maharashtra").length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText("Karnataka").length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(`₹${Number(240000).toLocaleString()}`).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(`₹${Number(250000).toLocaleString()}`)).toBeInTheDocument()
    })

    // Switch to cities view
    const cityBtn = screen.getByRole("button", { name: /City-Wise Performance/i })
    fireEvent.click(cityBtn)

    await waitFor(() => {
      expect(screen.getByText("Mumbai")).toBeInTheDocument()
      expect(screen.getByText("Bengaluru")).toBeInTheDocument()
      expect(screen.getByText(`₹${Number(190000).toLocaleString()}`)).toBeInTheDocument()
    })
  })

  it("2. handles empty results gracefully with empty state indicators", async () => {
    adminAPI.getGeographyAnalytics.mockResolvedValueOnce({
      data: {
        success: true,
        states: [],
        cities: []
      }
    })

    render(<GeographyAnalyticsTab dateParams={{ startDate: "2026-01-01", endDate: "2026-01-31" }} />)

    await waitFor(() => {
      expect(screen.getByText("No state records found.")).toBeInTheDocument()
    })

    const cityBtn = screen.getByRole("button", { name: /City-Wise Performance/i })
    fireEvent.click(cityBtn)

    await waitFor(() => {
      expect(screen.getByText("No city records found.")).toBeInTheDocument()
    })
  })

  it("3. renders gracefully when optional fields are missing from records", async () => {
    adminAPI.getGeographyAnalytics.mockResolvedValueOnce({
      data: {
        success: true,
        states: [
          {
            state: "Delhi"
            // orders, grossRevenue, netSales, unitsSold, uniqueCustomers all missing
          }
        ],
        cities: [
          {
            city: "New Delhi"
            // state, orders, revenue, unitsSold all missing
          }
        ]
      }
    })

    render(<GeographyAnalyticsTab dateParams={{ startDate: "2026-01-01", endDate: "2026-01-31" }} />)

    await waitFor(() => {
      expect(screen.getAllByText("Delhi").length).toBeGreaterThanOrEqual(1)
    })

    // Check placeholders for missing numeric data
    const dashes = screen.getAllByText("—")
    expect(dashes.length).toBeGreaterThan(0)

    // Switch to city view
    const cityBtn = screen.getByRole("button", { name: /City-Wise Performance/i })
    fireEvent.click(cityBtn)

    await waitFor(() => {
      expect(screen.getByText("New Delhi")).toBeInTheDocument()
    })
  })

  it("4. handles null values in numeric fields without throwing errors", async () => {
    adminAPI.getGeographyAnalytics.mockResolvedValueOnce({
      data: {
        success: true,
        states: [
          {
            state: "Tamil Nadu",
            orders: null,
            grossRevenue: null,
            netSales: null,
            unitsSold: null,
            uniqueCustomers: null
          }
        ],
        cities: [
          {
            city: "Chennai",
            state: null,
            orders: null,
            revenue: null,
            unitsSold: null
          }
        ]
      }
    })

    render(<GeographyAnalyticsTab dateParams={{ startDate: "2026-01-01", endDate: "2026-01-31" }} />)

    await waitFor(() => {
      expect(screen.getAllByText("Tamil Nadu").length).toBeGreaterThanOrEqual(1)
    })

    // Check placeholder dashes
    const dashes = screen.getAllByText("—")
    expect(dashes.length).toBeGreaterThan(0)
  })

  it("5. preserves valid numeric zero values without converting to placeholder dashes", async () => {
    adminAPI.getGeographyAnalytics.mockResolvedValueOnce({
      data: {
        success: true,
        states: [
          {
            state: "Goa",
            orders: 0,
            grossRevenue: 0,
            netSales: 0,
            unitsSold: 0,
            uniqueCustomers: 0
          }
        ],
        cities: [
          {
            city: "Panaji",
            state: "Goa",
            orders: 0,
            revenue: 0,
            unitsSold: 0
          }
        ]
      }
    })

    render(<GeographyAnalyticsTab dateParams={{ startDate: "2026-01-01", endDate: "2026-01-31" }} />)

    await waitFor(() => {
      expect(screen.getAllByText("Goa").length).toBeGreaterThanOrEqual(1)
      // Should display ₹0, not —
      const zeroRevenues = screen.getAllByText("₹0")
      expect(zeroRevenues.length).toBeGreaterThanOrEqual(1)
      const zeroCounts = screen.getAllByText("0")
      expect(zeroCounts.length).toBeGreaterThanOrEqual(1)
    })
  })

  it("6. handles failed API requests cleanly without unhandled crashes", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    adminAPI.getGeographyAnalytics.mockRejectedValueOnce(new Error("Network Error"))

    render(<GeographyAnalyticsTab dateParams={{ startDate: "2026-01-01", endDate: "2026-01-31" }} />)

    await waitFor(() => {
      // Renders empty state rather than crashing
      expect(screen.getByText("No state records found.")).toBeInTheDocument()
    })

    consoleSpy.mockRestore()
  })
})
