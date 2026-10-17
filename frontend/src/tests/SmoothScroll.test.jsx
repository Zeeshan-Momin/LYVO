import React from "react"
import { render, screen, act, fireEvent } from "@testing-library/react"
import { MemoryRouter, Link, useSearchParams } from "react-router-dom"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import SmoothScroll, { useLenis, useSmoothScroll } from "../components/common/SmoothScroll"

// Mock Lenis class
const mockLenisInstance = {
  raf: vi.fn(),
  scrollTo: vi.fn(),
  destroy: vi.fn(),
  stop: vi.fn(),
  start: vi.fn(),
  options: {
    duration: 1.1,
    smoothWheel: true
  }
}

vi.mock("lenis", () => {
  return {
    default: class MockLenis {
      constructor() {
        return mockLenisInstance
      }
    }
  }
})

function TestConsumer() {
  const lenis = useLenis()
  const smooth = useSmoothScroll()
  return (
    <div>
      <span data-testid="lenis-status">{lenis ? "initialized" : "null"}</span>
      <span data-testid="smooth-status">{smooth ? "initialized" : "null"}</span>
      <div data-testid="content">Smooth scroll child content</div>
    </div>
  )
}

function NavigationTestApp() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [counter, setCounter] = React.useState(0)

  return (
    <div>
      <span data-testid="counter">{counter}</span>
      <button onClick={() => setCounter((c) => c + 1)}>Trigger Re-render</button>

      {/* Navigation links (including footer links) */}
      <Link to="/products">All Products</Link>
      <Link to="/products?isNew=true">New Arrivals</Link>
      <Link to="/products?isFeatured=true">Featured</Link>
      <Link to="/cart">Cart</Link>
      <Link to="/#faq-section">FAQ Anchor</Link>

      {/* In-page filter updates (simulating Products.jsx handleFilterChange with replace: true) */}
      <button
        onClick={() => {
          const next = new URLSearchParams(searchParams)
          next.set("size", "UK 9")
          setSearchParams(next, { replace: true })
        }}
      >
        Filter Size
      </button>

      <button
        onClick={() => {
          const next = new URLSearchParams(searchParams)
          next.set("sort", "price-low")
          setSearchParams(next, { replace: true })
        }}
      >
        Sort Price
      </button>
    </div>
  )
}

describe("SmoothScroll Component", () => {
  let rafSpy
  let cancelRafSpy
  let scrollToSpy

  beforeEach(() => {
    vi.clearAllMocks()
    rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 123)
    cancelRafSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
    scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
  })

  afterEach(() => {
    rafSpy.mockRestore()
    cancelRafSpy.mockRestore()
    scrollToSpy.mockRestore()
  })

  it("1. renders children correctly", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SmoothScroll>
          <h1>Test Heading</h1>
        </SmoothScroll>
      </MemoryRouter>
    )

    expect(screen.getByText("Test Heading")).toBeInTheDocument()
  })

  it("2. initializes Lenis and provides context to consumers", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SmoothScroll>
          <TestConsumer />
        </SmoothScroll>
      </MemoryRouter>
    )

    expect(screen.getByTestId("content")).toBeInTheDocument()
    expect(screen.getByTestId("lenis-status")).toHaveTextContent("initialized")
    expect(screen.getByTestId("smooth-status")).toHaveTextContent("initialized")
    expect(window.lenis).toBe(mockLenisInstance)
  })

  it("3. starts the requestAnimationFrame loop on mount", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SmoothScroll>
          <p>Child</p>
        </SmoothScroll>
      </MemoryRouter>
    )

    expect(window.requestAnimationFrame).toHaveBeenCalled()
  })

  it("4. properly cleans up Lenis, RAF loop, and global reference on unmount", () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/"]}>
        <SmoothScroll>
          <p>Child</p>
        </SmoothScroll>
      </MemoryRouter>
    )

    act(() => {
      unmount()
    })

    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(123)
    expect(mockLenisInstance.destroy).toHaveBeenCalled()
    expect(window.lenis).toBeUndefined()
  })

  it("5. resets scroll to top when navigating to a different route pathname", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SmoothScroll>
          <NavigationTestApp />
        </SmoothScroll>
      </MemoryRouter>
    )

    mockLenisInstance.scrollTo.mockClear()
    scrollToSpy.mockClear()

    // Navigate from / to /cart
    act(() => {
      fireEvent.click(screen.getByText("Cart"))
    })

    expect(mockLenisInstance.scrollTo).toHaveBeenCalledWith(0, { immediate: true })
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0)
  })

  it("6. resets scroll to top when navigating through footer links to query destinations (/products?isFeatured=true, /products?isNew=true)", () => {
    // Start on /products (scrolled position scenario)
    render(
      <MemoryRouter initialEntries={["/products"]}>
        <SmoothScroll>
          <NavigationTestApp />
        </SmoothScroll>
      </MemoryRouter>
    )

    mockLenisInstance.scrollTo.mockClear()
    scrollToSpy.mockClear()

    // Click "Featured" footer link (/products?isFeatured=true)
    act(() => {
      fireEvent.click(screen.getByText("Featured"))
    })

    expect(mockLenisInstance.scrollTo).toHaveBeenCalledWith(0, { immediate: true })
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0)

    mockLenisInstance.scrollTo.mockClear()
    scrollToSpy.mockClear()

    // Click "New Arrivals" footer link (/products?isNew=true)
    act(() => {
      fireEvent.click(screen.getByText("New Arrivals"))
    })

    expect(mockLenisInstance.scrollTo).toHaveBeenCalledWith(0, { immediate: true })
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0)
  })

  it("7. resets scroll to top when clicking footer link to All Products even from the same pathname", () => {
    // Start on /products (e.g. user scrolled all the way to footer)
    render(
      <MemoryRouter initialEntries={["/products"]}>
        <SmoothScroll>
          <NavigationTestApp />
        </SmoothScroll>
      </MemoryRouter>
    )

    mockLenisInstance.scrollTo.mockClear()
    scrollToSpy.mockClear()

    // User clicks "All Products" link in footer
    act(() => {
      fireEvent.click(screen.getByText("All Products"))
    })

    expect(mockLenisInstance.scrollTo).toHaveBeenCalledWith(0, { immediate: true })
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0)
  })

  it("8. does not reset scroll position when query string updates via in-page filter change (replace: true)", () => {
    render(
      <MemoryRouter initialEntries={["/products"]}>
        <SmoothScroll>
          <NavigationTestApp />
        </SmoothScroll>
      </MemoryRouter>
    )

    mockLenisInstance.scrollTo.mockClear()
    scrollToSpy.mockClear()

    // In-page filter action (sets size with replace: true)
    act(() => {
      fireEvent.click(screen.getByText("Filter Size"))
    })

    // Scroll should NOT be reset to top during in-page filtering
    expect(mockLenisInstance.scrollTo).not.toHaveBeenCalled()
    expect(scrollToSpy).not.toHaveBeenCalled()

    // In-page sort action (sets sort with replace: true)
    act(() => {
      fireEvent.click(screen.getByText("Sort Price"))
    })

    expect(mockLenisInstance.scrollTo).not.toHaveBeenCalled()
    expect(scrollToSpy).not.toHaveBeenCalled()
  })

  it("9. does not reset scroll position during ordinary component re-renders", () => {
    render(
      <MemoryRouter initialEntries={["/products"]}>
        <SmoothScroll>
          <NavigationTestApp />
        </SmoothScroll>
      </MemoryRouter>
    )

    mockLenisInstance.scrollTo.mockClear()
    scrollToSpy.mockClear()

    // Trigger local state re-render
    act(() => {
      fireEvent.click(screen.getByText("Trigger Re-render"))
    })

    expect(screen.getByTestId("counter")).toHaveTextContent("1")
    expect(mockLenisInstance.scrollTo).not.toHaveBeenCalled()
    expect(scrollToSpy).not.toHaveBeenCalled()
  })

  it("10. scrolls to target anchor when location.hash is present", async () => {
    vi.useFakeTimers()

    const mockAnchor = document.createElement("div")
    mockAnchor.id = "faq-section"
    document.body.appendChild(mockAnchor)

    render(
      <MemoryRouter initialEntries={["/"]}>
        <SmoothScroll>
          <NavigationTestApp />
        </SmoothScroll>
      </MemoryRouter>
    )

    mockLenisInstance.scrollTo.mockClear()

    act(() => {
      fireEvent.click(screen.getByText("FAQ Anchor"))
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(mockLenisInstance.scrollTo).toHaveBeenCalledWith(mockAnchor, {
      offset: -80,
      duration: 0.8
    })

    document.body.removeChild(mockAnchor)
    vi.useRealTimers()
  })
})
