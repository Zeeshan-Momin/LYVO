import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { FiShoppingBag, FiUsers, FiPackage, FiDollarSign, FiAlertTriangle, FiArrowRight, FiClock, FiEye } from "react-icons/fi"
import { adminAPI } from "../../api"
import Loading from "../../components/common/Loading"

const SC = {pending:"#FFD166",confirmed:"#60a5fa",processing:"#a78bfa",shipped:"#22d3ee",delivered:"#10B981",cancelled:"#FF3A1A"}
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

const Tip = ({active,payload,label}) => { if(!active||!payload?.length) return null; return <div className="bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-xs shadow-xl"><p className="text-white/50 mb-1">{label}</p>{payload.map((p,i)=><p key={i} style={{color:p.color}} className="font-semibold">{p.name}: {p.name==="Revenue"?"₹"+p.value?.toLocaleString():p.value}</p>)}</div> }

function StatCard({icon,label,value,color="acid",delay=0}) {
  const cs={acid:"text-acid bg-acid/10",fire:"text-fire bg-fire/10",blue:"text-blue-400 bg-blue-400/10",purple:"text-purple-400 bg-purple-400/10"}
  return <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay,duration:.4}} className="card p-5"><div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${cs[color]}`}>{icon}</div><p className="font-display text-3xl tracking-wide">{value}</p><p className="text-white/40 text-sm mt-1">{label}</p></motion.div>
}

export default function Dashboard() {
  const [data,setData]=useState(null), [loading,setLoading]=useState(true)
  useEffect(() => { adminAPI.getDashboard().then(({data:d})=>setData(d.dashboard)).catch(()=>{}).finally(()=>setLoading(false)) }, [])
  if (loading) return <Loading/>
  if (!data) return <div className="text-center py-20 text-white/40">Failed to load dashboard</div>
  const { stats, lowStockProducts, recentOrders, recentUsers, ordersByStatus, monthlyRevenue } = data
  const revenueData = monthlyRevenue?.map(m=>({month:MONTHS[(m._id.month||1)-1],Revenue:m.revenue,Orders:m.orders})) || []
  const pieData = ordersByStatus?.map(s=>({name:s._id,value:s.count,color:SC[s._id]||"#666"})) || []
  return (
    <div className="space-y-6 pb-6">
      <div><h1 className="font-display text-3xl tracking-wider">Dashboard</h1><p className="text-white/40 text-sm mt-1">{new Date().toLocaleDateString("en-IN",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<FiDollarSign size={20}/>} label="Monthly Revenue" value={`₹${(stats.monthRevenue||0).toLocaleString()}`} color="acid"/>
        <StatCard icon={<FiPackage size={20}/>} label="Total Orders" value={stats.totalOrders||0} color="blue" delay={.05}/>
        <StatCard icon={<FiUsers size={20}/>} label="Total Users" value={stats.totalUsers||0} color="purple" delay={.1}/>
        <StatCard icon={<FiShoppingBag size={20}/>} label="Active Products" value={stats.totalProducts||0} color="fire" delay={.15}/>
        <StatCard icon={<FiEye size={20}/>} label="Total Site Visits" value={(stats.totalVisits||0).toLocaleString()} color="blue" delay={.2}/>
      </div>
      {stats.pendingOrders>0 && <div className="flex items-center justify-between p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl"><div className="flex items-center gap-3"><FiClock className="text-yellow-400" size={18}/><span className="text-sm font-medium">{stats.pendingOrders} orders awaiting confirmation</span></div><Link to="/admin/orders?status=pending" className="text-yellow-400 text-xs hover:underline flex items-center gap-1">View <FiArrowRight size={12}/></Link></div>}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6"><h2 className="font-semibold">Revenue Overview</h2><span className="text-white/30 text-xs">This Year</span></div>
          {revenueData.length>0 ? (
            <ResponsiveContainer width="100%" height={240}><LineChart data={revenueData}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/><XAxis dataKey="month" tick={{fill:"rgba(255,255,255,0.35)",fontSize:11}} axisLine={false} tickLine={false}/><YAxis tick={{fill:"rgba(255,255,255,0.35)",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/><Tooltip content={<Tip/>}/><Line type="monotone" dataKey="Revenue" stroke="var(--color-acid)" strokeWidth={2.5} dot={{fill:"var(--color-acid)",r:4,strokeWidth:0}}/><Line type="monotone" dataKey="Orders" stroke="#60a5fa" strokeWidth={2} dot={{fill:"#60a5fa",r:3,strokeWidth:0}}/></LineChart></ResponsiveContainer>
          ) : <div className="h-60 flex items-center justify-center text-white/20 text-sm">No revenue data yet</div>}
        </div>
        <div className="card p-6">
          <h2 className="font-semibold mb-6">Orders by Status</h2>
          {pieData.length>0 ? (
            <ResponsiveContainer width="100%" height={180}><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">{pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip contentStyle={{background:"#16161f",border:"1px solid rgba(255,255,255,.1)",borderRadius:"12px",fontSize:"12px"}}/></PieChart></ResponsiveContainer>
          ) : <div className="h-44 flex items-center justify-center text-white/20 text-sm">No data</div>}
          <div className="space-y-2 mt-2">{pieData.slice(0,5).map(s=><div key={s.name} className="flex items-center justify-between text-xs"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{background:s.color}}/><span className="text-white/50 capitalize">{s.name}</span></div><span className="font-medium">{s.value}</span></div>)}</div>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6"><div className="flex items-center justify-between mb-4"><h2 className="font-semibold">Recent Orders</h2><Link to="/admin/orders" className="text-acid text-xs hover:underline flex items-center gap-1">View all <FiArrowRight size={11}/></Link></div><div className="space-y-3">{recentOrders?.slice(0,6).map(o=><Link key={o._id} to={`/orders/${o._id}`} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0 hover:bg-white/3 -mx-2 px-2 rounded-lg transition-colors"><div><p className="text-sm font-medium">#{o.orderNumber}</p><p className="text-white/40 text-xs">{o.user?.name} · {new Date(o.createdAt).toLocaleDateString()}</p></div><div className="text-right"><p className="text-acid text-sm font-semibold">₹{o.pricing?.total?.toLocaleString()}</p><span className="text-[10px] capitalize" style={{color:SC[o.status]||"#666"}}>{o.status}</span></div></Link>)}</div></div>
        <div className="space-y-6">
          {lowStockProducts?.length>0 && <div className="card p-5"><div className="flex items-center gap-2 mb-4"><FiAlertTriangle className="text-yellow-400" size={16}/><h2 className="font-semibold text-sm">Low Stock Alert</h2><span className="badge bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">{lowStockProducts.length}</span></div><div className="space-y-2.5">{lowStockProducts.slice(0,5).map(p=><Link key={p._id} to="/admin/products" className="flex items-center gap-3 hover:bg-white/3 rounded-lg p-1.5 -mx-1.5 transition-colors"><div className="w-9 h-9 rounded-lg bg-dark-600 overflow-hidden shrink-0"><img src={p.images?.[0]?.url} alt="" className="w-full h-full object-cover"/></div><div className="flex-1 min-w-0"><p className="text-sm font-medium line-clamp-1">{p.name}</p></div><span className={`text-xs font-bold px-2 py-1 rounded-lg ${p.totalStock===0?"bg-fire/15 text-fire":"bg-yellow-500/15 text-yellow-400"}`}>{p.totalStock===0?"Out":`${p.totalStock} left`}</span></Link>)}</div></div>}
          <div className="card p-5"><div className="flex items-center justify-between mb-4"><h2 className="font-semibold text-sm">New Users</h2><Link to="/admin/users" className="text-acid text-xs hover:underline">View all</Link></div><div className="space-y-2.5">{recentUsers?.slice(0,5).map(u=><div key={u._id} className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-acid/20 flex items-center justify-center text-acid text-sm font-bold shrink-0">{u.name?.[0]?.toUpperCase()}</div><div className="flex-1 min-w-0"><p className="text-sm font-medium line-clamp-1">{u.name}</p><p className="text-white/30 text-xs truncate">{u.email}</p></div><p className="text-white/25 text-xs shrink-0">{new Date(u.createdAt).toLocaleDateString()}</p></div>)}</div></div>
        </div>
      </div>
    </div>
  )
}
