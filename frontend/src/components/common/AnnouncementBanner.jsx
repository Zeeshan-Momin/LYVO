import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

const PROMOS = [
  "⚡ FREE SHIPPING ON DOMESTIC ORDERS OVER ₹999",
  "👑 JOIN THE CLUB: EXTRA 10% OFF YOUR FIRST PURCHASE",
  "🔥 NEW DROP ACTIVE: EXPLORE HIGH-STREET STREETWEAR KICKS",
]

export default function AnnouncementBanner() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % PROMOS.length)
    }, 4500)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="w-full bg-dark-950 border-b border-white/5 h-9 flex items-center justify-center relative overflow-hidden z-50">
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -15, opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="text-[10px] font-mono tracking-widest text-acid/80 uppercase px-4 font-semibold text-center select-none"
        >
          {PROMOS[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
