import { useEffect, useRef, useState, createContext, useContext } from "react"
import { useLocation } from "react-router-dom"
import Lenis from "lenis"
import "lenis/dist/lenis.css"

const LenisContext = createContext(null)

export const useLenis = () => useContext(LenisContext)
export const useSmoothScroll = () => useContext(LenisContext)

export default function SmoothScroll({ children }) {
  const location = useLocation()
  const lenisRef = useRef(null)
  const [lenisInstance, setLenisInstance] = useState(null)

  useEffect(() => {
    if (typeof window === "undefined") return

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
      if (rafId) cancelAnimationFrame(rafId)
      if (observer) observer.disconnect()
      if (motionQuery?.removeEventListener) {
        motionQuery.removeEventListener("change", handleMotionChange)
      } else if (motionQuery?.removeListener) {
        motionQuery.removeListener(handleMotionChange)
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
    if (!lenis) return

    if (location.hash) {
      const timer = setTimeout(() => {
        try {
          const target = document.querySelector(location.hash)
          if (target) {
            lenis.scrollTo(target, { offset: -80, duration: 0.8 })
          }
        } catch {
          // ignore invalid selector
        }
      }, 50)
      return () => clearTimeout(timer)
    } else {
      lenis.scrollTo(0, { immediate: true })
    }
  }, [location.pathname])

  return (
    <LenisContext.Provider value={lenisInstance}>
      {children}
    </LenisContext.Provider>
  )
}
