import React from "react"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { BrowserRouter, MemoryRouter, Routes, Route } from "react-router-dom"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import Accessories from "../pages/Accessories"
import Navbar from "../components/common/Navbar"
import { productAPI } from "../api"
import { AuthProvider } from "../context/AuthContext"
import { CartProvider } from "../context/CartContext"
import { ThemeProvider } from "../context/ThemeContext"

// Mock API module
vi.mock("../api", () => ({
  productAPI: {
    getAll: vi.fn(),
    getCategories: vi.fn(),
    search: vi.fn().mockResolvedValue({ data: { suggestions: [] } })
  },
  analyticsAPI: {
    recordVisit: vi.fn().mockResolvedValue({})
  }
}))

const mockCategories = [
  { _id: "cat_belts_1", name: "Belts", slug: "belts", icon: "🥋" },
  { _id: "cat_socks_1", name: "Socks", slug: "socks", icon: "🧦" },
  { _id: "cat_running_1", name: "Running", slug: "running", icon: "🏃" }
]

const mockProducts = [
  {
    _id: "prod_belt_1",
    name: "Classic Black Leather Belt",
    brand: "LYVO",
    category: { _id: "cat_belts_1", name: "Belts", slug: "belts" },
    gender: "unisex",
    price: 999,
    discountPrice: 799,
    discountPercent: 20,
    totalStock: 50,
    sizes: [
      { size: "30", stock: 10 },
      { size: "32", stock: 10 },
      { size: "34", stock: 10 },
      { size: "36", stock: 10 },
      { size: "38", stock: 10 }
    ],
    images: [{ url: "https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=800", isPrimary: true }],
    isNew: true,
    isFeatured: true
  },
  {
    _id: "prod_belt_2",
    name: "Reversible Brown-Black Belt",
    brand: "LYVO",
    category: { _id: "cat_belts_1", name: "Belts", slug: "belts" },
    gender: "unisex",
    price: 1099,
    discountPrice: 899,
    discountPercent: 18,
    totalStock: 50,
    sizes: [
      { size: "30", stock: 10 },
      { size: "32", stock: 10 },
      { size: "34", stock: 10 },
      { size: "36", stock: 10 },
      { size: "38", stock: 10 }
    ],
    images: [{ url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800", isPrimary: true }],
    isBestSeller: true
  },
  {
    _id: "prod_sock_1",
    name: "Black Cotton Crew Socks (Pack of 3)",
    brand: "LYVO",
    category: { _id: "cat_socks_1", name: "Socks", slug: "socks" },
    gender: "unisex",
    price: 399,
    discountPrice: 299,
    discountPercent: 25,
    totalStock: 25,
    sizes: [{ size: "Free Size", stock: 25 }],
    images: [{ url: "https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=800", isPrimary: true }],
    isNew: true
  },
  {
    _id: "prod_sock_2",
    name: "White Ankle Socks (Pack of 3)",
    brand: "LYVO",
    category: { _id: "cat_socks_1", name: "Socks", slug: "socks" },
    gender: "unisex",
    price: 349,
    discountPrice: 249,
    discountPercent: 29,
    totalStock: 25,
    sizes: [{ size: "Free Size", stock: 25 }],
    images: [{ url: "https://images.unsplash.com/photo-1582966772680-860e372bb558?w=800", isPrimary: true }],
    isBestSeller: true
  },
  {
    _id: "prod_shoe_1",
    name: "LYVO Hustle Runner",
    brand: "LYVO",
    category: { _id: "cat_running_1", name: "Running", slug: "running" },
    gender: "unisex",
    price: 12999,
    discountPrice: 9999,
    totalStock: 20,
    sizes: [{ size: "UK 8", stock: 20 }],
    images: [{ url: "https://example.com/shoe.jpg", isPrimary: true }]
  }
]

function renderWithProviders(ui, initialEntries = ["/accessories"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            {ui}
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>
  )
}

describe("LYVO Accessories Section (Belts & Socks)", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("1. renders Accessories link in the storefront Navbar", () => {
    renderWithProviders(<Navbar />, ["/"])
    const accessoriesLinks = screen.getAllByRole("link", { name: /accessories/i })
    expect(accessoriesLinks.length).toBeGreaterThanOrEqual(1)
    expect(accessoriesLinks[0]).toHaveAttribute("href", "/accessories")
  })

  it("2. loads /accessories and displays Belts and Socks rows with products", async () => {
    productAPI.getAll.mockResolvedValueOnce({
      data: { success: true, products: mockProducts }
    })
    productAPI.getCategories.mockResolvedValueOnce({
      data: { success: true, categories: mockCategories }
    })

    renderWithProviders(<Accessories />)

    // Verify Header
    expect(screen.getByRole("heading", { level: 1, name: /accessories/i })).toBeInTheDocument()

    // Verify Belts Section & Product
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: /belts/i })).toBeInTheDocument()
      expect(screen.getByText("Classic Black Leather Belt")).toBeInTheDocument()
      expect(screen.getByText("Reversible Brown-Black Belt")).toBeInTheDocument()
    })

    // Verify Socks Section & Product
    expect(screen.getByRole("heading", { level: 2, name: /socks/i })).toBeInTheDocument()
    expect(screen.getByText("Black Cotton Crew Socks (Pack of 3)")).toBeInTheDocument()
    expect(screen.getByText("White Ankle Socks (Pack of 3)")).toBeInTheDocument()

    // Running sneaker should NOT appear in Belts or Socks rows
    expect(screen.queryByText("LYVO Hustle Runner")).not.toBeInTheDocument()
  })

  it("3. provides correct View All links for Belts and Socks", async () => {
    productAPI.getAll.mockResolvedValueOnce({
      data: { success: true, products: mockProducts }
    })
    productAPI.getCategories.mockResolvedValueOnce({
      data: { success: true, categories: mockCategories }
    })

    renderWithProviders(<Accessories />)

    await waitFor(() => {
      const viewAllBelts = screen.getByRole("link", { name: /view all belts/i })
      expect(viewAllBelts).toHaveAttribute("href", "/products?category=belts")

      const viewAllSocks = screen.getByRole("link", { name: /view all socks/i })
      expect(viewAllSocks).toHaveAttribute("href", "/products?category=socks")
    })
  })

  it("4. handles empty categories cleanly without crashing", async () => {
    productAPI.getAll.mockResolvedValueOnce({
      data: { success: true, products: [] }
    })
    productAPI.getCategories.mockResolvedValueOnce({
      data: { success: true, categories: mockCategories }
    })

    renderWithProviders(<Accessories />)

    await waitFor(() => {
      expect(screen.getByText("No Belt Products Currently Available")).toBeInTheDocument()
      expect(screen.getByText("No Sock Products Currently Available")).toBeInTheDocument()
    })
  })

  it("5. renders product card details including prices and discounts", async () => {
    productAPI.getAll.mockResolvedValueOnce({
      data: { success: true, products: mockProducts }
    })
    productAPI.getCategories.mockResolvedValueOnce({
      data: { success: true, categories: mockCategories }
    })

    renderWithProviders(<Accessories />)

    await waitFor(() => {
      expect(screen.getByText(`₹${Number(799).toLocaleString()}`)).toBeInTheDocument()
      expect(screen.getByText(`₹${Number(299).toLocaleString()}`)).toBeInTheDocument()
    })
  })
})
