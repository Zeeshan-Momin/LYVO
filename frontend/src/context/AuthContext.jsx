import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { authAPI } from "../api"
import toast from "react-hot-toast"

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user,setUser]=useState(null), [loading,setLoading]=useState(true)
  const navigate = useNavigate()

  const triggerAuthRedirect = useCallback((pendingAction) => {
    toast.error("🔑 Sign in required to complete this action.");
    localStorage.setItem("lyvo_pending_action", JSON.stringify(pendingAction));
    navigate("/login", { state: { from: pendingAction.route } });
  }, [navigate]);

  const checkPendingAction = useCallback((currentUser) => {
    if (!currentUser) return;
    const raw = localStorage.getItem("lyvo_pending_action");
    if (!raw) return;
    try {
      const pending = JSON.parse(raw);
      // Let CartProvider handle add_to_cart, buy_now, quick_add
      if (pending.action === "wishlist") {
        localStorage.removeItem("lyvo_pending_action");
        authAPI.toggleWishlist(pending.payload.productId).then(({ data }) => {
          setUser(prev => ({
            ...prev,
            wishlist: data.action === "added" 
              ? [...(prev.wishlist || []), pending.payload.productId] 
              : (prev.wishlist || []).filter(id => (typeof id === "string" ? id : id?._id) !== pending.payload.productId)
          }));
          toast.success("Item wishlisted! ❤️");
        }).catch(() => {});

        setTimeout(() => {
          if (pending.scroll) window.scrollTo({ top: pending.scroll, behavior: "smooth" });
        }, 400);
        navigate(pending.route || "/");
      } else if (pending.action === "add_review") {
        localStorage.removeItem("lyvo_pending_action");
        setTimeout(() => {
          if (pending.scroll) window.scrollTo({ top: pending.scroll, behavior: "smooth" });
        }, 400);
        navigate(pending.route || "/");
      }
    } catch (e) {
      console.error("Error running pending action:", e);
    }
  }, [navigate]);

  useEffect(() => {
    if (user) {
      checkPendingAction(user);
    }
  }, [user, checkPendingAction]);

  useEffect(()=>{ if(localStorage.getItem("lyvo_token")) fetchMe(); else setLoading(false) },[])

  const fetchMe = async () => { try{ const{data}=await authAPI.getMe(); setUser(data.user) } catch{ localStorage.removeItem("lyvo_token"); localStorage.removeItem("lyvo_refresh") } finally{ setLoading(false) } }

  const login = useCallback(async (email,password) => { const{data}=await authAPI.login({email,password}); localStorage.setItem("lyvo_token",data.token); localStorage.setItem("lyvo_refresh",data.refreshToken); setUser(data.user); return data.user },[])

  const loginGoogle = useCallback(async (idToken) => { const{data}=await authAPI.loginGoogle({idToken}); localStorage.setItem("lyvo_token",data.token); localStorage.setItem("lyvo_refresh",data.refreshToken); setUser(data.user); return data.user },[])

  const register = useCallback(async (name,email,password,phone) => { const{data}=await authAPI.register({name,email,password,phone}); localStorage.setItem("lyvo_token",data.token); localStorage.setItem("lyvo_refresh",data.refreshToken); setUser(data.user); return data.user },[])

  const logout = useCallback(async () => { try{ await authAPI.logout() }catch{}; localStorage.removeItem("lyvo_token"); localStorage.removeItem("lyvo_refresh"); setUser(null); toast.success("Logged out") },[])

  const updateProfile = useCallback(async (u) => { const{data}=await authAPI.updateProfile(u); setUser(data.user); toast.success("Profile updated"); return data.user },[])

  const toggleWishlist = useCallback(async (productId) => {
    if (!user) {
      triggerAuthRedirect({
        action: "wishlist",
        route: window.location.pathname + window.location.search,
        scroll: window.scrollY,
        payload: { productId }
      });
      return false
    }
    const{data}=await authAPI.toggleWishlist(productId)
    setUser(prev=>({...prev, wishlist: data.action==="added" ? [...(prev.wishlist||[]),productId] : (prev.wishlist||[]).filter(id=>(typeof id==="string"?id:id?._id)!==productId)}))
    toast.success(data.message); return data.action
  },[user, triggerAuthRedirect])

  const isWishlisted = useCallback((productId) => user?.wishlist?.some(id=>(typeof id==="string"?id:id?._id)===productId)||false,[user])

  return <Ctx.Provider value={{user,loading,isAdmin:user?.role==="admin",login,loginGoogle,register,logout,updateProfile,toggleWishlist,isWishlisted,fetchMe,triggerAuthRedirect}}>{children}</Ctx.Provider>
}

export const useAuth = () => { const ctx=useContext(Ctx); if(!ctx) throw new Error("useAuth must be inside AuthProvider"); return ctx }
