import { useState, useEffect, useRef } from "react"
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { FiSearch, FiShoppingBag, FiHeart, FiUser, FiMenu, FiX, FiChevronDown, FiLogOut, FiPackage, FiSettings, FiSun, FiMoon } from "react-icons/fi"
import { useAuth } from "../../context/AuthContext"
import { useCart } from "../../context/CartContext"
import { useTheme } from "../../context/ThemeContext"
import { productAPI } from "../../api"
import CartDrawer from "../cart/CartDrawer"

const NAV = [
  { to:"/products", label:"Shop" },
  { to:"/products?isNew=true", label:"New Drops" },
  { to:"/products?isFeatured=true", label:"Featured" },
  { to:"/products?gender=men", label:"Men" },
  { to:"/products?gender=women", label:"Women" },
]

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth()
  const { itemCount, setIsOpen: openCart } = useCart()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)

  const isActiveLink = (to) => {
    const currentPath = location.pathname + location.search
    if (to === "/products") {
      return currentPath === "/products" || currentPath === "/products/";
    }
    return currentPath.includes(to);
  }
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState([])
  const debRef = useRef(null)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", fn, { passive: true })
    return () => window.removeEventListener("scroll", fn)
  }, [])

  useEffect(() => {
    clearTimeout(debRef.current)
    if (query.length < 2) { setSuggestions([]); return }
    debRef.current = setTimeout(async () => {
      try { const { data } = await productAPI.search({ q: query }); setSuggestions(data.suggestions || []) }
      catch { setSuggestions([]) }
    }, 300)
  }, [query])

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) { navigate(`/products?keyword=${encodeURIComponent(query.trim())}`); setSearchOpen(false); setQuery("") }
  }

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-dark-900/90 backdrop-blur-xl border-b border-white/5 shadow-lg" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-20">
              <Link to="/" className="flex items-center shrink-0">
                <img src="/logo.png" alt="LYVO" className="h-9 w-auto object-contain dark:invert-0 invert" />
              </Link>
              <div className="hidden md:flex items-center gap-8">
                {NAV.map(l => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    className={() => `nav-link text-[11.5px] relative py-1.5 transition-all ${
                      isActiveLink(l.to)
                        ? "text-acid font-semibold after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-px after:bg-acid"
                        : "after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-px after:bg-acid hover:after:w-full after:transition-all after:duration-300"
                    }`}
                  >
                    {l.label}
                  </NavLink>
                ))}
              </div>
            <div className="flex items-center gap-1">
              <button onClick={toggleTheme} className="btn-ghost p-2 rounded-full relative overflow-hidden" aria-label="Toggle theme" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
                <motion.div animate={{ rotate: theme === "dark" ? 0 : 360, scale: [0.8, 1.1, 1] }} transition={{ duration: 0.5, ease: "easeOut" }}>
                  {theme === "dark" ? <FiSun size={19} className="text-acid"/> : <FiMoon size={19} className="text-acid"/>}
                </motion.div>
              </button>
              <button onClick={() => setSearchOpen(p=>!p)} className="btn-ghost p-2 rounded-full hover:text-acid transition-colors"><FiSearch size={19}/></button>
              {user && <Link to="/wishlist" className="btn-ghost p-2 rounded-full hover:text-acid transition-colors"><FiHeart size={19}/></Link>}
              <button onClick={() => openCart(true)} className="btn-ghost p-2 rounded-full relative hover:text-acid transition-colors">
                <FiShoppingBag size={19}/>
                {itemCount>0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-acid text-dark-900 rounded-full text-[10px] font-bold flex items-center justify-center shadow-md">{itemCount>9?"9+":itemCount}</span>}
              </button>
              {user ? (
                <div className="relative">
                  <button onClick={()=>setUserMenu(p=>!p)} className="flex items-center gap-1.5 btn-ghost px-2 py-1.5 rounded-xl">
                    <div className="w-7 h-7 rounded-full bg-acid/15 border border-acid/30 flex items-center justify-center text-acid text-xs font-bold shadow-sm">{user.name?.[0]?.toUpperCase()}</div>
                    <FiChevronDown size={13} className={`transition-transform ${userMenu?"rotate-180":""}`}/>
                  </button>
                  <AnimatePresence>
                    {userMenu && (
                      <motion.div initial={{opacity:0,y:8,scale:.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:8,scale:.95}} transition={{duration:.15}}
                        className="absolute right-0 top-full mt-2 w-52 glass rounded-2xl border border-white/10 shadow-card overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/8"><p className="font-semibold text-sm truncate">{user.name}</p><p className="text-white/40 text-xs truncate">{user.email}</p></div>
                        {[["/profile",<FiSettings size={14}/>,"Profile"],["/orders",<FiPackage size={14}/>,"Orders"],["/wishlist",<FiHeart size={14}/>,"Wishlist"],...(isAdmin?[["/admin",<FiUser size={14}/>,"Admin Panel"]]:[])].map(([to,icon,label]) => (
                          <Link key={to} to={to} onClick={()=>setUserMenu(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/70 hover:text-acid hover:bg-white/5 transition-colors">{icon}{label}</Link>
                        ))}
                        <button onClick={()=>{logout();setUserMenu(false)}} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-fire hover:bg-fire/10 transition-colors border-t border-white/8"><FiLogOut size={14}/> Logout</button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : <Link to="/login" className="btn-primary py-2 px-4 text-sm hidden md:flex items-center gap-1 hover:shadow-[0_0_15px_rgba(204,255,0,0.25)] hover:scale-[1.02] active:scale-95 transition-all"><FiUser size={14}/> Login</Link>}
              <button onClick={()=>setMobileOpen(p=>!p)} className="md:hidden btn-ghost p-2 rounded-full">{mobileOpen?<FiX size={20}/>:<FiMenu size={20}/>}</button>
            </div>
          </div>
        </div>
        <AnimatePresence>
          {searchOpen && (
            <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="border-t border-white/8 bg-dark-800/95 backdrop-blur-xl overflow-hidden">
              <form onSubmit={handleSearch} className="max-w-2xl mx-auto px-4 py-3">
                <div className="flex items-center gap-3">
                  <FiSearch className="text-acid shrink-0" size={18}/>
                  <input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search sneakers, brands, styles…" className="flex-1 bg-transparent outline-none text-white placeholder-white/30 text-sm"/>
                  {query && <button type="button" onClick={()=>setQuery("")} className="text-white/30 hover:text-white"><FiX size={16}/></button>}
                </div>
                {suggestions.length>0 && (
                  <div className="mt-2 space-y-1">
                    {suggestions.map(s => (
                      <Link key={s._id} to={`/products/${s.slug||s._id}`} onClick={()=>{setSearchOpen(false);setQuery("")}} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-white/5 transition-colors">
                        <img src={s.images?.[0]?.url} alt={s.name} className="w-9 h-9 rounded-lg object-cover bg-dark-600"/>
                        <div><p className="text-sm font-medium">{s.name}</p><p className="text-xs text-acid">₹{(s.discountPrice||s.price)?.toLocaleString()}</p></div>
                      </Link>
                    ))}
                  </div>
                )}
              </form>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} className="md:hidden border-t border-white/8 bg-dark-900/98 backdrop-blur-xl">
              <div className="px-4 py-4 space-y-1">
                {NAV.map(l => <NavLink key={l.to} to={l.to} onClick={()=>setMobileOpen(false)} className={()=>`block py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${isActiveLink(l.to)?"text-acid bg-acid/10":"text-white/70 hover:text-white hover:bg-white/5"}`}>{l.label}</NavLink>)}
                {!user && <div className="pt-3 flex gap-2"><Link to="/login" onClick={()=>setMobileOpen(false)} className="btn-primary flex-1 text-center py-2.5">Login</Link><Link to="/register" onClick={()=>setMobileOpen(false)} className="btn-outline flex-1 text-center py-2.5">Sign Up</Link></div>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
      <CartDrawer />
    </>
  )
}
