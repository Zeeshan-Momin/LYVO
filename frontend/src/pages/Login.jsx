import { useState } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { motion } from "framer-motion"
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight, FiUser, FiShield } from "react-icons/fi"
import { useAuth } from "../context/AuthContext"
import { auth, googleProvider, signInWithPopup } from "../config/firebase"
import toast from "react-hot-toast"

/* ─── Auth pages always use a dark cinematic backdrop ─────────
   (same approach as Nike / Apple / Adidas login pages)
   We own the overlay ourselves so light-mode body color
   cannot wash out the card.
───────────────────────────────────────────────────────────── */

const cardStyle = {
  background: "rgba(12, 12, 16, 0.72)",
  backdropFilter: "blur(32px)",
  WebkitBackdropFilter: "blur(32px)",
  border: "1px solid rgba(255, 255, 255, 0.10)",
  boxShadow: "0 28px 60px rgba(0, 0, 0, 0.70), inset 0 1px 0 rgba(255,255,255,0.06)",
}

const inputStyle = {
  background: "rgba(255, 255, 255, 0.06)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  color: "#ffffff",
  outline: "none",
}

const inputFocusClass = "focus:!border-[#ccff00] focus:!shadow-[0_0_16px_rgba(204,255,0,0.28)]"

/* ═══════════════════════════════════════════════════════════ */
/*  LOGIN                                                      */
/* ═══════════════════════════════════════════════════════════ */
export function Login() {
  const { login, loginGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from =
    typeof location.state?.from === "string"
      ? location.state.from
      : location.state?.from?.pathname || "/"

  const [form, setForm] = useState({ email: "", password: "" })
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  const isGoogleConfigured = !!(
    import.meta.env.VITE_FIREBASE_API_KEY &&
    !import.meta.env.VITE_FIREBASE_API_KEY.includes("dummy")
  )
  const isGoogleDisabled = !isGoogleConfigured && import.meta.env.PROD

  const submit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) { toast.error("Fill all fields"); return }
    setLoading(true)
    try {
      const user = await login(form.email, form.password)
      toast.success(`Welcome back, ${user.name.split(" ")[0]}! 👋`)
      navigate(user.role === "admin" ? "/admin" : from, { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setLoading(true)
    try {
      let idToken
      const isDummy =
        !import.meta.env.VITE_FIREBASE_API_KEY ||
        import.meta.env.VITE_FIREBASE_API_KEY.includes("dummy")
      if (isDummy) {
        idToken = "mock-google-id-token"
      } else {
        const result = await signInWithPopup(auth, googleProvider)
        idToken = await result.user.getIdToken()
      }
      const user = await loginGoogle(idToken)
      toast.success(`Authenticated as ${user.name.split(" ")[0]}! 🚀`)
      navigate(user.role === "admin" ? "/admin" : from, { replace: true })
    } catch (err) {
      toast.error(err.message || "Google authentication failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 pt-[116px] pb-10 overflow-hidden">

      {/* ── Full-screen dark overlay (owns z-index so body color can't bleed) */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(135deg, rgba(0,0,0,0.92) 0%, rgba(10,10,14,0.88) 100%)",
          zIndex: 0,
        }}
      />

      {/* ── Subtle grid texture on top of overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.018) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          zIndex: 1,
        }}
      />

      {/* ── Ambient glow spots */}
      <div
        className="fixed pointer-events-none rounded-full blur-3xl opacity-25 animate-pulse"
        style={{
          width: 420, height: 420,
          top: "10%", left: "5%",
          background: "radial-gradient(circle, rgba(204,255,0,0.18) 0%, transparent 70%)",
          animationDuration: "9s",
          zIndex: 1,
        }}
      />
      <div
        className="fixed pointer-events-none rounded-full blur-3xl opacity-15 animate-pulse"
        style={{
          width: 360, height: 360,
          bottom: "10%", right: "5%",
          background: "radial-gradient(circle, rgba(255,88,0,0.15) 0%, transparent 70%)",
          animationDuration: "13s",
          zIndex: 1,
        }}
      />

      {/* ── Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
        style={{ zIndex: 10 }}
      >
        {/* Logo + Heading */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-5 transition-transform hover:scale-105">
            <img src="/logo.png" alt="LYVO" className="h-9 w-auto object-contain" />
          </Link>
          <h1
            className="font-display text-4xl tracking-[0.2em] uppercase mb-2"
            style={{ color: "#ffffff", textShadow: "0 0 24px rgba(255,255,255,0.20)" }}
          >
            Welcome Back
          </h1>
          <p style={{ color: "rgba(255,255,255,0.48)", fontSize: "0.72rem", letterSpacing: "0.1em" }}>
            Sign in to continue your luxury journey
          </p>
        </div>

        {/* Glassmorphism Card */}
        <div className="rounded-2xl p-8 w-full" style={cardStyle}>
          <form onSubmit={submit} className="space-y-5">

            {/* Email */}
            <div>
              <label
                className="block mb-2 text-[10px] font-semibold tracking-[0.16em] uppercase"
                style={{ color: "rgba(255,255,255,0.42)" }}
              >
                Email
              </label>
              <div className="relative">
                <FiMail
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "rgba(255,255,255,0.28)" }}
                />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="your@email.com"
                  className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm transition-all duration-200 placeholder-white/25 ${inputFocusClass}`}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                className="block mb-2 text-[10px] font-semibold tracking-[0.16em] uppercase"
                style={{ color: "rgba(255,255,255,0.42)" }}
              >
                Password
              </label>
              <div className="relative">
                <FiLock
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "rgba(255,255,255,0.28)" }}
                />
                <input
                  type={show ? "text" : "password"}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-11 py-3 rounded-xl text-sm transition-all duration-200 placeholder-white/25 ${inputFocusClass}`}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setShow(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-100"
                  style={{ color: "rgba(255,255,255,0.30)" }}
                >
                  {show ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold tracking-[0.14em] uppercase transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] group disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #ccff00 0%, #88e000 100%)",
                color: "#0a0a0a",
                boxShadow: "0 6px 24px rgba(204,255,0,0.32)",
              }}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-black/20 border-t-black/80 rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <FiArrowRight size={14} className="group-hover:translate-x-1 transition-transform duration-200" />
                </>
              )}
            </button>
          </form>

          {/* OR Divider */}
          <div className="relative my-6 flex items-center">
            <div className="flex-1 border-t" style={{ borderColor: "rgba(255,255,255,0.10)" }} />
            <span
              className="mx-4 text-[10px] font-semibold tracking-[0.14em] uppercase"
              style={{ color: "rgba(255,255,255,0.30)" }}
            >
              or
            </span>
            <div className="flex-1 border-t" style={{ borderColor: "rgba(255,255,255,0.10)" }} />
          </div>

          {/* Google Button */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading || isGoogleDisabled}
            className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-3 text-xs font-semibold tracking-wide transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
            style={
              isGoogleDisabled
                ? { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.25)", cursor: "not-allowed", border: "1px solid rgba(255,255,255,0.06)" }
                : { background: "#ffffff", color: "#0a0a0a", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.30)" }
            }
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Continue with Google
          </button>
          {isGoogleDisabled && (
            <p className="text-[10px] text-center mt-1.5 tracking-widest uppercase" style={{ color: "rgba(255,120,50,0.65)" }}>
              Google sign-in unavailable in production
            </p>
          )}

          {/* Demo Credentials */}
          <div className="grid grid-cols-2 gap-3 mt-5">
            {[
              ["Demo User",  "user@lyvo.com",  "User@123456",  <FiUser  key="u" size={12} />],
              ["Demo Admin", "admin@lyvo.com", "Admin@123456", <FiShield key="a" size={12} />],
            ].map(([label, email, password, icon]) => (
              <button
                key={label}
                type="button"
                onClick={() => setForm({ email, password })}
                className="flex items-center justify-center gap-2 text-[10px] font-bold tracking-[0.14em] uppercase py-3 px-3 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.55)",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "rgba(204,255,0,0.45)"
                  e.currentTarget.style.color = "#ccff00"
                  e.currentTarget.style.background = "rgba(204,255,0,0.07)"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"
                  e.currentTarget.style.color = "rgba(255,255,255,0.55)"
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)"
                }}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div
            className="mt-6 pt-5 text-center text-xs"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.35)" }}
          >
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-semibold ml-1 transition-opacity hover:opacity-80"
              style={{ color: "#ccff00" }}
            >
              Sign Up
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ */
/*  REGISTER                                                   */
/* ═══════════════════════════════════════════════════════════ */
export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" })
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) { toast.error("Fill required fields"); return }
    if (form.password.length < 6) { toast.error("Password must be at least 6 characters"); return }
    setLoading(true)
    try {
      const user = await register(form.name, form.email, form.password, form.phone)
      toast.success(`Welcome to LYVO, ${user.name.split(" ")[0]}! 🎉`)
      navigate("/", { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 pt-[116px] pb-10 overflow-hidden">

      {/* ── Full-screen dark overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(135deg, rgba(0,0,0,0.92) 0%, rgba(10,10,14,0.88) 100%)",
          zIndex: 0,
        }}
      />

      {/* ── Grid texture */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.018) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          zIndex: 1,
        }}
      />

      {/* ── Glow spots */}
      <div
        className="fixed pointer-events-none rounded-full blur-3xl opacity-20 animate-pulse"
        style={{
          width: 420, height: 420,
          top: "5%", right: "5%",
          background: "radial-gradient(circle, rgba(204,255,0,0.18) 0%, transparent 70%)",
          animationDuration: "9s",
          zIndex: 1,
        }}
      />
      <div
        className="fixed pointer-events-none rounded-full blur-3xl opacity-12 animate-pulse"
        style={{
          width: 360, height: 360,
          bottom: "5%", left: "5%",
          background: "radial-gradient(circle, rgba(100,80,255,0.12) 0%, transparent 70%)",
          animationDuration: "11s",
          zIndex: 1,
        }}
      />

      {/* ── Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
        style={{ zIndex: 10 }}
      >
        {/* Logo + Heading */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-5 transition-transform hover:scale-105">
            <img src="/logo.png" alt="LYVO" className="h-9 w-auto object-contain" />
          </Link>
          <h1
            className="font-display text-4xl tracking-[0.2em] uppercase mb-2"
            style={{ color: "#ffffff", textShadow: "0 0 24px rgba(255,255,255,0.20)" }}
          >
            Join LYVO
          </h1>
          <p style={{ color: "rgba(255,255,255,0.48)", fontSize: "0.72rem", letterSpacing: "0.1em" }}>
            Live Your Vision Out
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 w-full" style={cardStyle}>
          <form onSubmit={submit} className="space-y-4">

            {[
              ["name",  "Full Name",         "text",  "Jordan Miles"],
              ["email", "Email",             "email", "your@email.com"],
              ["phone", "Phone (optional)",  "tel",   "+91 98765 43210"],
            ].map(([k, l, t, ph]) => (
              <div key={k}>
                <label
                  className="block mb-2 text-[10px] font-semibold tracking-[0.16em] uppercase"
                  style={{ color: "rgba(255,255,255,0.42)" }}
                >
                  {l}
                </label>
                <input
                  type={t}
                  value={form[k]}
                  onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                  placeholder={ph}
                  className={`w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 placeholder-white/25 ${inputFocusClass}`}
                  style={inputStyle}
                  required={k !== "phone"}
                />
              </div>
            ))}

            {/* Password */}
            <div>
              <label
                className="block mb-2 text-[10px] font-semibold tracking-[0.16em] uppercase"
                style={{ color: "rgba(255,255,255,0.42)" }}
              >
                Password
              </label>
              <div className="relative">
                <FiLock
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "rgba(255,255,255,0.28)" }}
                />
                <input
                  type={show ? "text" : "password"}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Min. 6 characters"
                  className={`w-full pl-10 pr-11 py-3 rounded-xl text-sm transition-all duration-200 placeholder-white/25 ${inputFocusClass}`}
                  style={inputStyle}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-100"
                  style={{ color: "rgba(255,255,255,0.30)" }}
                >
                  {show ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                </button>
              </div>
            </div>

            {/* Create Account Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold tracking-[0.14em] uppercase transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] group disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #ccff00 0%, #88e000 100%)",
                color: "#0a0a0a",
                boxShadow: "0 6px 24px rgba(204,255,0,0.32)",
              }}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-black/20 border-t-black/80 rounded-full animate-spin" />
              ) : (
                <>
                  Create Account
                  <FiArrowRight size={14} className="group-hover:translate-x-1 transition-transform duration-200" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div
            className="mt-6 pt-5 text-center text-xs"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.35)" }}
          >
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold ml-1 transition-opacity hover:opacity-80"
              style={{ color: "#ccff00" }}
            >
              Sign In
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default Login
