import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { authAPI } from "../api"
import toast from "react-hot-toast"
const Ctx = createContext(null)
export function AuthProvider({ children }) {
  const [user,setUser]=useState(null), [loading,setLoading]=useState(true)
  useEffect(()=>{ if(localStorage.getItem("lyvo_token")) fetchMe(); else setLoading(false) },[])
  const fetchMe = async () => { try{ const{data}=await authAPI.getMe(); setUser(data.user) } catch{ localStorage.removeItem("lyvo_token"); localStorage.removeItem("lyvo_refresh") } finally{ setLoading(false) } }
  const login = useCallback(async (email,password) => { const{data}=await authAPI.login({email,password}); localStorage.setItem("lyvo_token",data.token); localStorage.setItem("lyvo_refresh",data.refreshToken); setUser(data.user); return data.user },[])
  const register = useCallback(async (name,email,password,phone) => { const{data}=await authAPI.register({name,email,password,phone}); localStorage.setItem("lyvo_token",data.token); localStorage.setItem("lyvo_refresh",data.refreshToken); setUser(data.user); return data.user },[])
  const logout = useCallback(async () => { try{ await authAPI.logout() }catch{}; localStorage.removeItem("lyvo_token"); localStorage.removeItem("lyvo_refresh"); setUser(null); toast.success("Logged out") },[])
  const updateProfile = useCallback(async (u) => { const{data}=await authAPI.updateProfile(u); setUser(data.user); toast.success("Profile updated"); return data.user },[])
  const toggleWishlist = useCallback(async (productId) => {
    if (!user) { toast.error("Please login"); return false }
    const{data}=await authAPI.toggleWishlist(productId)
    setUser(prev=>({...prev, wishlist: data.action==="added" ? [...(prev.wishlist||[]),productId] : (prev.wishlist||[]).filter(id=>(typeof id==="string"?id:id?._id)!==productId)}))
    toast.success(data.message); return data.action
  },[user])
  const isWishlisted = useCallback((productId) => user?.wishlist?.some(id=>(typeof id==="string"?id:id?._id)===productId)||false,[user])
  return <Ctx.Provider value={{user,loading,isAdmin:user?.role==="admin",login,register,logout,updateProfile,toggleWishlist,isWishlisted,fetchMe}}>{children}</Ctx.Provider>
}
export const useAuth = () => { const ctx=useContext(Ctx); if(!ctx) throw new Error("useAuth must be inside AuthProvider"); return ctx }
