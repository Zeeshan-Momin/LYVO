import { useEffect, useRef, useState, createContext, useContext } from "react"
import { useLocation, useNavigationType } from "react-router-dom"
import Lenis from "lenis"
import "lenis/dist/lenis.css"

const LenisContext = createContext(null)

export const useLenis = () => useContext(LenisContext)
export const useSmoothScroll = () => useContext(LenisContext)

export default function SmoothScroll({ children }) {
  const location = useLocation()
  const navType = useNavigationType()
  const lenisRef = useRef(null)
  const prevLocationRef = useRef(null)
  const [lenisInstance, setLenisInstance] = useState(null)

  const currentLocationRef = useRef(location)
  currentLocationRef.current = location

  useEffect(() => {
    if (typeof window === "undefined") return

    // Configure manual scroll restoration so the browser doesn't conflict with custom restoration
    let originalScrollRestoration
    try {
      if (window.history && "scrollRestoration" in window.history) {
        originalScrollRestoration = window.history.scrollRestoration
        window.history.scrollRestoration = "manual"
      }
    } catch {
      // ignore environments where history.scrollRestoration cannot be set
    }

    // Handle link clicks to the current page (e.g. clicking "All Products" in the footer when already on /products)
    const handleLinkClick = (e) => {
      if (typeof window === "undefined") return
      const anchor = e.target.closest?.("a")
      if (!anchor) return

      const href = anchor.getAttribute("href")
      if (!href) return

      if (anchor.target === "_blank" || href.startsWith("http") || href.startsWith("//") || href.startsWith("mailto:")) {
        return
      }
      if (href.startsWith("#")) return

      try {
        const currentLoc = currentLocationRef.current
        const base = typeof window.location !== "undefined" && window.location.origin ? window.location.origin : "http://localhost"
        const url = new URL(href, base)
        if (
          url.pathname === currentLoc.pathname &&
          url.search === currentLoc.search &&
          !url.hash
        ) {
          if (lenisRef.current) {
            lenisRef.current.scrollTo(0, { immediate: true })
          }
          if (typeof window.scrollTo === "function") {
            window.scrollTo(0, 0)
          }
        }
      } catch {
        // ignore invalid URL
      }
    }

    if (typeof document !== "undefined") {
      document.addEventListener("click", handleLinkClick)
    }

    // Detect user's reduced-motion preference
    const motionQuery = typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null
    const prefersReducedMotion = motionQuery ? motionQuery.matches : false

    // Initialize Lenis with natural, responsive inertia
    const lenis = new Lenis({
      duration: prefersReducedMotion ? 0 : 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: !prefersReducedMotion,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.5,
      infinite: false,
      autoRaf: false,
      respectReducedMotion: true,
      prevent: (node) => {
        if (!node || typeof node.closest !== "function") return false

        // Respect explicit lenis-prevent markers
        if (node.closest("[data-lenis-prevent], [data-lenis-prevent-wheel], [data-lenis-prevent-touch], .lenis-prevent")) {
          return true
        }

        // Preserve native scrolling for nested scrollable containers (drawers, modals, dropdowns, tables)
        const scrollable = node.closest(
          '[role="dialog"], [role="listbox"], [role="menu"], [aria-modal="true"], .overflow-y-auto, .overflow-y-scroll, .overflow-x-auto, .overflow-x-scroll'
        )
        if (scrollable && scrollable !== document.documentElement && scrollable !== document.body) {
          return true
        }

        return false
      }
    })

    lenisRef.current = lenis
    setLenisInstance(lenis)
    window.lenis = lenis

    // Drive Lenis through requestAnimationFrame
    let rafId
    const raf = (time) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    // Observe body overflow changes for modal/drawer scroll locking
    let observer = null
    if (typeof MutationObserver !== "undefined" && document.body) {
      observer = new MutationObserver(() => {
        if (document.body.style.overflow === "hidden") {
          lenis.stop()
        } else {
          lenis.start()
        }
      })
      observer.observe(document.body, { attributes: true, attributeFilter: ["style"] })
    }

    // Handle runtime changes to reduced-motion preferences
    const handleMotionChange = (e) => {
      if (e.matches) {
        lenis.options.duration = 0
        lenis.options.smoothWheel = false
      } else {
        lenis.options.duration = 1.1
        lenis.options.smoothWheel = true
      }
    }

    if (motionQuery?.addEventListener) {
      motionQuery.addEventListener("change", handleMotionChange)
    } else if (motionQuery?.addListener) {
      motionQuery.addListener(handleMotionChange)
    }

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("click", handleLinkClick)
      }
      if (rafId) cancelAnimationFrame(rafId)
      if (observer) observer.disconnect()
      if (motionQuery?.removeEventListener) {
        motionQuery.removeEventListener("change", handleMotionChange)
      } else if (motionQuery?.removeListener) {
        motionQuery.removeListener(handleMotionChange)
      }
      try {
        if (originalScrollRestoration && window.history && "scrollRestoration" in window.history) {
          window.history.scrollRestoration = originalScrollRestoration
        }
      } catch {
        // ignore
      }
      lenis.destroy()
      lenisRef.current = null
      setLenisInstance(null)
      if (window.lenis === lenis) {
        delete window.lenis
      }
    }
  }, [])

  // Handle route navigation: reset scroll to top or scroll to target hash
  useEffect(() => {
    const lenis = lenisRef.current
    const prevLocation = prevLocationRef.current

    // Update ref for next comparison
    prevLocationRef.current = {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      key: location.key
    }

    // Ignore ordinary component re-renders where location did not change
    if (
      prevLocation &&
      prevLocation.pathname === location.pathname &&
      prevLocation.search === location.search &&
      prevLocation.hash === location.hash &&
      prevLocation.key === location.key
    ) {
      return
    }

    const scrollToTop = () => {
      if (lenis) {
        lenis.scrollTo(0, { immediate: true })
      }
      if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
        window.scrollTo(0, 0)
      }
    }

    // If target has a hash anchor, scroll to that element
    if (location.hash) {
      const timer = setTimeout(() => {
        try {
          const target = document.querySelector(location.hash)
          if (target) {
            if (lenis) {
              lenis.scrollTo(target, { offset: -80, duration: 0.8 })
            } else if (typeof target.scrollIntoView === "function") {
              target.scrollIntoView({ behavior: "smooth" })
            }
          }
        } catch {
          // ignore invalid selector
        }
      }, 50)
      return () => clearTimeout(timer)
    }

    // On initial mount, ensure viewport is at top
    if (!prevLocation) {
      scrollToTop()
      return
    }

    const isDifferentRoute = location.pathname !== prevLocation.pathname
    const isPushNavigation = navType === "PUSH"
    const isPopWithDifferentQuery = navType === "POP" && location.search !== prevLocation.search
    const isReplaceOnSamePath = navType === "REPLACE" && !isDifferentRoute

    // In-page filter/sort/search updates intentionally use replace: true on the same pathname;
    // do NOT reset the scroll position for filter updates.
    if (isReplaceOnSamePath) {
      return
    }

    // Reset scroll to top when:
    // 1. Route/pathname changes (different route)
    // 2. Navigating via link / push (including footer links: New Arrivals, Featured, All Products, etc.)
    // 3. Browser history navigation to a different query destination
    if (isDifferentRoute || isPushNavigation || isPopWithDifferentQuery) {
      scrollToTop()
    }
  }, [location.pathname, location.search, location.hash, location.key, navType])

  return (
    <LenisContext.Provider value={lenisInstance}>
      {children}
    </LenisContext.Provider>
  )
}
