import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { FiHome, FiRefreshCw } from "react-icons/fi"

export default function ErrorPage({ code = 404, message }) {
  const errorMap = {
    403: {
      title: "Access Forbidden",
      description: message || "You do not have the credentials required to view this area.",
      action: "Return to Showroom"
    },
    404: {
      title: "Page Not Found",
      description: message || "The premium page you are looking for has been moved or does not exist.",
      action: "Return to Showroom"
    },
    500: {
      title: "System Interruption",
      description: message || "An unexpected server condition occurred. Our developers are investigating.",
      action: "Try Reloading"
    },
    offline: {
      title: "Connection Lost",
      description: "It looks like you are currently offline. Please check your internet connectivity.",
      action: "Try Reconnecting"
    }
  }

  const currentError = errorMap[code] || errorMap[404]

  const handleAction = () => {
    if (code === 500 || code === "offline") {
      window.location.reload()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-dark-900 bg-grid-pattern relative overflow-hidden">
      {/* Luxury ambient spot glow overlays */}
      <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-acid/5 rounded-full blur-3xl opacity-20 pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-fire/5 rounded-full blur-3xl opacity-10 pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 16 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5 }} 
        className="text-center z-10 max-w-md w-full px-6"
      >
        <span className="font-display text-8xl tracking-widest text-acid/80 drop-shadow-[0_0_15px_rgba(204,255,0,0.2)] block mb-4 uppercase">
          {code}
        </span>
        <h1 className="font-display text-3xl tracking-wider uppercase mb-3 text-white">
          {currentError.title}
        </h1>
        <p className="text-white/40 text-sm tracking-wide mb-8 leading-relaxed">
          {currentError.description}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {code === 500 || code === "offline" ? (
            <button
              onClick={handleAction}
              className="btn-primary py-2.5 px-6 flex items-center justify-center gap-2 font-semibold text-xs tracking-wider uppercase hover:shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all bg-gradient-to-r from-acid to-emerald-500 text-dark-900 border-none w-full sm:w-auto"
            >
              <FiRefreshCw size={14} className="animate-spin-slow" />
              {currentError.action}
            </button>
          ) : (
            <Link
              to="/"
              className="btn-primary py-2.5 px-6 flex items-center justify-center gap-2 font-semibold text-xs tracking-wider uppercase hover:shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all bg-gradient-to-r from-acid to-emerald-500 text-dark-900 border-none w-full sm:w-auto"
            >
              <FiHome size={14} />
              {currentError.action}
            </Link>
          )}
        </div>
      </motion.div>
    </div>
  )
}
