import React from "react"
import { render, screen, act } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
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

describe("SmoothScroll Component", () => {
  let rafSpy
  let cancelRafSpy

  beforeEach(() => {
    vi.clearAllMocks()
    rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      return 123
    })
    cancelRafSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
  })

  afterEach(() => {
    rafSpy.mockRestore()
    cancelRafSpy.mockRestore()
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
})
