import { createContext, useContext, useState, useEffect, useCallback } from "react"

const Ctx = createContext(null)
const KEY = "lyvo_theme"

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(KEY)
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    }
    return "light"
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove("dark", "light")
    root.classList.add(theme)
    localStorage.setItem(KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(t => (t === "dark" ? "light" : "dark"))
  }, [])

  return (
    <Ctx.Provider value={{ theme, setTheme, toggleTheme, isDark: theme === "dark" }}>
      {children}
    </Ctx.Provider>
  )
}

export const useTheme = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider")
  return ctx
}
