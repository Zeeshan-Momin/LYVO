import { useState, useEffect, useRef } from "react"
import { Outlet, NavLink, Link, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { FiGrid, FiShoppingBag, FiPackage, FiUsers, FiBarChart2, FiTag, FiPercent, FiMenu, FiX, FiLogOut, FiBell, FiChevronRight, FiSun, FiMoon, FiAlertTriangle } from "react-icons/fi"
import { useAuth } from "../../context/AuthContext"
import { useTheme } from "../../context/ThemeContext"
import { adminAPI } from "../../api"

const NAV = [
  {to:"/admin",icon:<FiGrid size={18}/>,label:"Dashboard",exact:true},
  {to:"/admin/products",icon:<FiShoppingBag size={18}/>,label:"Products"},
  {to:"/admin/orders",icon:<FiPackage size={18}/>,label:"Orders"},
  {to:"/admin/users",icon:<FiUsers size={18}/>,label:"Users"},
  {to:"/admin/analytics",icon:<FiBarChart2 size={18}/>,label:"Analytics"},
  {to:"/admin/categories",icon:<FiTag size={18}/>,label:"Categories"},
  {to:"/admin/coupons",icon:<FiPercent size={18}/>,label:"Coupons"},
]

function Sidebar({ onClose }) {
  const { user, logout } = useAuth()
  return (
    <div className="flex flex-col h-full bg-dark-800 border-r border-white/5">
      <div className="flex items-center justify-between p-5 border-b border-white/5">
        <Link to="/" className="flex items-center">
          <img src="/logo.png" alt="LYVO" className="h-8 w-auto object-contain dark:invert-0 invert" />
        </Link>
        {onClose && <button onClick={onClose} className="text-white/40 hover:text-white lg:hidden"><FiX size={20}/></button>}
      </div>
      <div className="px-5 py-3 border-b border-white/5"><p className="text-[10px] tracking-widest uppercase text-acid/70 font-mono">Admin Panel</p></div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">{NAV.map(item => <NavLink key={item.to} to={item.to} end={item.exact} className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${isActive?"bg-acid/15 text-acid border-acid/20":"text-white/50 hover:text-white hover:bg-white/5 border-transparent"}`}><span className="shrink-0">{item.icon}</span><span>{item.label}</span></NavLink>)}</nav>
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3 mb-3"><div className="w-8 h-8 rounded-full bg-acid/20 flex items-center justify-center text-acid font-bold text-sm shrink-0">{user?.name?.[0]?.toUpperCase()}</div><div className="min-w-0"><p className="text-sm font-medium truncate">{user?.name}</p><p className="text-xs text-white/30 truncate">{user?.email}</p></div></div>
        <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-fire/70 hover:text-fire hover:bg-fire/10 transition-all"><FiLogOut size={16}/> Logout</button>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [readNotifications, setReadNotifications] = useState([])
  const dropdownRef = useRef(null)

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { data: d } = await adminAPI.getDashboard()
        const dashboard = d.dashboard
        const list = []
        
        // 1. Low stock alerts
        if (dashboard.lowStockProducts) {
          dashboard.lowStockProducts.forEach(p => {
            if (p.totalStock === 0) {
              list.push({
                id: `stock-out-${p._id}`,
                type: "danger",
                title: "Out of Stock",
                message: `${p.name} is completely out of stock!`,
                link: "/admin/products",
                image: p.images?.[0]?.url,
              })
            } else {
              list.push({
                id: `stock-low-${p._id}`,
                type: "warning",
                title: "Low Stock Alert",
                message: `${p.name} is running low (${p.totalStock} left)`,
                link: "/admin/products",
                image: p.images?.[0]?.url,
              })
            }
          })
        }
        
        // 2. Pending orders
        if (dashboard.recentOrders) {
          dashboard.recentOrders
            .filter(o => o.status === "pending")
            .forEach(o => {
              list.push({
                id: `order-pending-${o._id}`,
                type: "info",
                title: "Pending Order",
                message: `Order #${o.orderNumber} is awaiting confirmation`,
                link: `/admin/orders?status=pending`,
                time: new Date(o.createdAt).toLocaleTimeString(),
              })
            })
        }
        
        setNotifications(list)
        const stored = JSON.parse(localStorage.getItem("lyvo_read_notifications") || "[]")
        setReadNotifications(stored)
        const unread = list.filter(n => !stored.includes(n.id)).length
        setUnreadCount(unread)
      } catch (e) {
        console.error("Failed to load notifications:", e)
      }
    }
    
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleNotificationClick = (n) => {
    const stored = JSON.parse(localStorage.getItem("lyvo_read_notifications") || "[]")
    if (!stored.includes(n.id)) {
      stored.push(n.id)
      localStorage.setItem("lyvo_read_notifications", JSON.stringify(stored))
      setReadNotifications(stored)
      setUnreadCount(Math.max(0, unreadCount - 1))
    }
    setShowNotifications(false)
    navigate(n.link)
  }

  const handleMarkAllAsRead = () => {
    const stored = JSON.parse(localStorage.getItem("lyvo_read_notifications") || "[]")
    notifications.forEach(n => {
      if (!stored.includes(n.id)) {
        stored.push(n.id)
      }
    })
    localStorage.setItem("lyvo_read_notifications", JSON.stringify(stored))
    setReadNotifications(stored)
    setUnreadCount(0)
  }

  return (
    <div className="flex h-screen bg-transparent overflow-hidden">
      <div className="hidden lg:flex w-60 shrink-0"><Sidebar/></div>
      <AnimatePresence>
        {sidebarOpen && (<>
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={()=>setSidebarOpen(false)}/>
          <motion.div initial={{x:"-100%"}} animate={{x:0}} exit={{x:"-100%"}} transition={{type:"spring",damping:28,stiffness:300}} className="fixed left-0 top-0 bottom-0 w-64 z-50 lg:hidden"><Sidebar onClose={()=>setSidebarOpen(false)}/></motion.div>
        </>)}
      </AnimatePresence>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-dark-800 border-b border-white/5 flex items-center justify-between px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-3"><button onClick={()=>setSidebarOpen(true)} className="lg:hidden text-white/50 hover:text-white"><FiMenu size={20}/></button><div className="hidden sm:flex items-center gap-1 text-white/30 text-sm"><Link to="/" className="hover:text-acid">Site</Link><FiChevronRight size={12}/><span className="text-white/60">Admin</span></div></div>
          <div className="flex items-center gap-2">
            <Link to="/products" target="_blank" className="text-xs text-white/30 hover:text-acid hidden md:block mr-2">View Store →</Link>
            <button onClick={toggleTheme} className="btn-ghost p-2 rounded-full" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
              {theme === "dark" ? <FiSun size={18}/> : <FiMoon size={18}/>}
            </button>
            
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative btn-ghost p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
                title="Notifications"
              >
                <FiBell size={18}/>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-fire text-[9px] font-bold text-white ring-2 ring-dark-800 animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-80 sm:w-96 bg-dark-700 border border-white/10 rounded-2xl shadow-xl overflow-hidden z-50 origin-top-right"
                  >
                    <div className="flex items-center justify-between p-4 border-b border-white/5 bg-dark-800/50">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="bg-acid/10 text-acid text-[10px] font-bold px-2 py-0.5 rounded-full border border-acid/20">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button 
                          onClick={handleMarkAllAsRead}
                          className="text-xs text-acid hover:underline"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    
                    <div className="max-h-[360px] overflow-y-auto divide-y divide-white/5 text-left">
                      {notifications.length > 0 ? (
                        notifications.map(n => {
                          const isRead = readNotifications.includes(n.id)
                          return (
                            <div 
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              className={`flex gap-3 p-4 cursor-pointer hover:bg-white/3 transition-colors ${!isRead ? "bg-white/[0.01]" : "opacity-60"}`}
                            >
                              {n.image ? (
                                <div className="w-10 h-10 rounded-lg bg-dark-600 overflow-hidden shrink-0">
                                  <img src={n.image} alt="" className="w-full h-full object-cover"/>
                                </div>
                              ) : (
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                                  n.type === "danger" ? "bg-fire/15 text-fire" : 
                                  n.type === "warning" ? "bg-yellow-500/15 text-yellow-400" : 
                                  "bg-blue-500/15 text-blue-400"
                                }`}>
                                  <FiAlertTriangle size={18} />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className={`text-xs font-semibold ${!isRead ? "text-white" : "text-white/70"}`}>
                                    {n.title}
                                  </p>
                                  {!isRead && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-acid shrink-0 mt-1.5 animate-pulse" />
                                  )}
                                </div>
                                <p className="text-xs text-white/50 mt-1 line-clamp-2 leading-relaxed">
                                  {n.message}
                                </p>
                                {n.time && (
                                  <p className="text-[10px] text-white/30 mt-1.5">{n.time}</p>
                                )}
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                          <div className="w-12 h-12 rounded-full bg-acid/10 flex items-center justify-center text-acid mb-3">
                            <FiBell size={20} />
                          </div>
                          <p className="text-sm font-medium text-white/80">All caught up!</p>
                          <p className="text-xs text-white/40 mt-1">No new alerts or low stock items.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6"><Outlet/></main>
      </div>
    </div>
  )
}
