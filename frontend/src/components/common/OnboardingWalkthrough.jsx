import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FiArrowRight, FiCheck } from "react-icons/fi"

const STEPS = [
  { title: "Welcome to LYVO", text: "Discover our premium high-street sneaker releases, designed with progressive comfort." },
  { title: "Smart Filters & Sizing", text: "Easily filter by brand, colorways, ratings, and true UK shoe sizing." },
  { title: "Secure Checkout & VIP Points", text: "Every order yields loyalty points. Enjoy quick UPI, Razorpay, or COD shipping." }
]

export default function OnboardingWalkthrough() {
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    // Only show to first-time visitors
    if (!localStorage.getItem("lyvo_onboarding_completed")) {
      setIsOpen(true)
    }
  }, [])

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
    } else {
      localStorage.setItem("lyvo_onboarding_completed", "true")
      setIsOpen(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="max-w-md w-full glass rounded-3xl border border-white/10 shadow-card p-6 text-center space-y-6"
        >
          {/* Progress Indicators */}
          <div className="flex justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === step ? "w-6 bg-acid" : "w-2 bg-white/15"
                }`}
              />
            ))}
          </div>

          <div className="space-y-2">
            <h3 className="font-display text-2xl tracking-wider uppercase text-white">
              {STEPS[step].title}
            </h3>
            <p className="text-white/50 text-xs tracking-wide leading-relaxed">
              {STEPS[step].text}
            </p>
          </div>

          <button
            onClick={handleNext}
            className="btn-primary py-2.5 px-6 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider bg-acid text-dark-900 border-none mx-auto hover:shadow-[0_0_15px_rgba(204,255,0,0.25)] hover:scale-105 transition-all"
          >
            {step === STEPS.length - 1 ? (
              <>Let's Shop <FiCheck size={14} /></>
            ) : (
              <>Next Step <FiArrowRight size={14} /></>
            )}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
