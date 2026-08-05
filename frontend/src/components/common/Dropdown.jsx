import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FiChevronDown } from "react-icons/fi"

export default function Dropdown({ value, onChange, options, className = "" }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  // Find the active label
  const activeOpt = options.find(opt => Array.isArray(opt) ? opt[0] === value : opt.value === value)
  const activeLabel = activeOpt ? (Array.isArray(activeOpt) ? activeOpt[1] : activeOpt.label) : ""

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (val) => {
    onChange(val)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-3 bg-dark-600 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white hover:border-white/20 focus:border-acid focus:ring-1 focus:ring-acid/30 transition-all duration-200 w-full"
      >
        <span className="truncate">{activeLabel}</span>
        <FiChevronDown
          size={16}
          className={`text-white/40 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.ul
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 z-50 mt-2 w-full min-w-[160px] bg-dark-700/90 border border-white/10 rounded-xl py-1.5 shadow-xl backdrop-blur-xl overflow-hidden"
          >
            {options.map((opt) => {
              const val = Array.isArray(opt) ? opt[0] : opt.value
              const label = Array.isArray(opt) ? opt[1] : opt.label
              const isSelected = val === value

              return (
                <li key={val}>
                  <button
                    type="button"
                    onClick={() => handleSelect(val)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-150 ${
                      isSelected
                        ? "bg-acid text-dark-900 font-semibold"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
