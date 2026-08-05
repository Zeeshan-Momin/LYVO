import { useState } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { motion } from "framer-motion"
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight } from "react-icons/fi"
import { useAuth } from "../context/AuthContext"
import toast from "react-hot-toast"

export function Login() {
  const { login } = useAuth(), navigate = useNavigate(), location = useLocation()
  const from = location.state?.from?.pathname || "/"
  const [form,setForm]=useState({email:"",password:""}), [show,setShow]=useState(false), [loading,setLoading]=useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (!form.email||!form.password) { toast.error("Fill all fields"); return }
    setLoading(true)
    try { const user=await login(form.email,form.password); toast.success(`Welcome back, ${user.name.split(" ")[0]}! 👋`); navigate(user.role==="admin"?"/admin":from,{replace:true}) }
    catch(e) { toast.error(e.response?.data?.message||"Login failed") } finally { setLoading(false) }
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-20 pb-10 bg-grid-pattern relative overflow-hidden">
      {/* Luxury animated ambient spots */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-acid/10 rounded-full blur-3xl opacity-20 pointer-events-none animate-pulse" style={{ animationDuration: "8s" }}/>
      <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] bg-fire/5 rounded-full blur-3xl opacity-10 pointer-events-none animate-pulse" style={{ animationDuration: "12s" }}/>
      
      <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:.6}} className="relative w-full max-w-md z-10">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center mb-6">
            <img src="/logo.png" alt="LYVO" className="h-10 w-auto object-contain dark:invert-0 invert" />
          </Link>
          <h1 className="font-display text-4xl tracking-wider mb-2">Welcome Back</h1><p className="text-white/40 text-sm">Sign in to continue your journey</p>
        </div>
        <div className="glass p-8 rounded-3xl border border-white/8 shadow-[0_16px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <form onSubmit={submit} className="space-y-5">
            <div><label className="label">Email</label><div className="relative"><FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={16}/><input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} className="input pl-10" placeholder="your@email.com"/></div></div>
            <div><label className="label">Password</label><div className="relative"><FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={16}/><input type={show?"text":"password"} value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} className="input pl-10 pr-10" placeholder="••••••••"/><button type="button" onClick={()=>setShow(p=>!p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">{show?<FiEyeOff size={16}/>:<FiEye size={16}/>}</button></div></div>
            <div className="grid grid-cols-2 gap-2">{[["Demo User","user@lyvo.com","User@123456"],["Demo Admin","admin@lyvo.com","Admin@123456"]].map(([l,e,p])=><button key={l} type="button" onClick={()=>setForm({email:e,password:p})} className="text-xs py-2 px-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/50 hover:text-acid border border-white/5 transition-all">{l}</button>)}</div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(204,255,0,0.25)] hover:scale-[1.01] active:scale-98 transition-all">{loading?<span className="w-5 h-5 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin"/>:<>Sign In <FiArrowRight size={16}/></>}</button>
          </form>
          <p className="text-center text-sm text-white/40 mt-6">Don't have an account? <Link to="/register" className="text-acid hover:underline font-medium">Sign Up</Link></p>
        </div>
      </motion.div>
    </div>
  )
}
export default Login

export function Register() {
  const { register } = useAuth(), navigate = useNavigate()
  const [form,setForm]=useState({name:"",email:"",password:"",phone:""}), [show,setShow]=useState(false), [loading,setLoading]=useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (!form.name||!form.email||!form.password) { toast.error("Fill required fields"); return }
    if (form.password.length<6) { toast.error("Password min 6 characters"); return }
    setLoading(true)
    try { const user=await register(form.name,form.email,form.password,form.phone); toast.success(`Welcome to LYVO, ${user.name.split(" ")[0]}! 🎉`); navigate("/",{replace:true}) }
    catch(e) { toast.error(e.response?.data?.message||"Registration failed") } finally { setLoading(false) }
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-20 pb-10 bg-grid-pattern relative overflow-hidden">
      {/* Luxury animated ambient spots */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-acid/10 rounded-full blur-3xl opacity-20 pointer-events-none animate-pulse" style={{ animationDuration: "8s" }}/>
      <div className="absolute bottom-1/4 left-1/4 w-[450px] h-[450px] bg-fire/5 rounded-full blur-3xl opacity-10 pointer-events-none animate-pulse" style={{ animationDuration: "12s" }}/>
      
      <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:.6}} className="relative w-full max-w-md z-10">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center mb-6">
            <img src="/logo.png" alt="LYVO" className="h-10 w-auto object-contain dark:invert-0 invert" />
          </Link>
          <h1 className="font-display text-4xl tracking-wider mb-2">Join LYVO</h1><p className="text-white/40 text-sm">Live Your Vision Out</p>
        </div>
        <div className="glass p-8 rounded-3xl border border-white/8 shadow-[0_16px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <form onSubmit={submit} className="space-y-4">
            {[["name","Full Name","text","Jordan Miles"],["email","Email","email","your@email.com"],["phone","Phone (optional)","tel","+91 98765 43210"]].map(([k,l,t,ph])=><div key={k}><label className="label">{l}</label><input type={t} value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} className="input" placeholder={ph}/></div>)}
            <div><label className="label">Password</label><div className="relative"><FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={16}/><input type={show?"text":"password"} value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} className="input pl-10 pr-10" placeholder="Min. 6 characters"/><button type="button" onClick={()=>setShow(p=>!p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">{show?<FiEyeOff size={16}/>:<FiEye size={16}/>}</button></div></div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(204,255,0,0.25)] hover:scale-[1.01] active:scale-98 transition-all">{loading?<span className="w-5 h-5 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin"/>:<>Create Account <FiArrowRight size={16}/></>}</button>
          </form>
          <p className="text-center text-sm text-white/40 mt-6">Already have an account? <Link to="/login" className="text-acid hover:underline font-medium">Sign In</Link></p>
        </div>
      </motion.div>
    </div>
  )
}
