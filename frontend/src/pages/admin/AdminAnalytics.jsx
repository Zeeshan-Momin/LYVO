import { useState, useEffect } from "react"
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { FiShoppingBag } from "react-icons/fi"
import { adminAPI } from "../../api"
import Loading from "../../components/common/Loading"

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const COLORS = ["var(--color-acid)","#FF3A1A","#FFD166","#60a5fa","#a78bfa","#22d3ee"]
const Tip = ({active,payload,label}) => { if(!active||!payload?.length) return null; return <div className="bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-xs shadow-xl"><p className="text-white/50 mb-1">{label}</p>{payload.map((p,i)=><p key={i} style={{color:p.color}} className="font-semibold">{p.name}: {p.name.toLowerCase().includes("revenue")?"₹"+Number(p.value).toLocaleString():p.value}</p>)}</div> }

export function AdminAnalytics() {
  const [data,setData]=useState(null), [loading,setLoading]=useState(true), [year,setYear]=useState(new Date().getFullYear())
  useEffect(() => { adminAPI.getSalesAnalytics({year}).then(({data:d})=>setData(d.analytics)).catch(()=>{}).finally(()=>setLoading(false)) }, [year])
  if (loading) return <Loading/>
  const monthly = data?.monthly?.map(m=>({month:MONTHS[(m._id||1)-1],Revenue:m.revenue,Orders:m.orders}))||[]
  const catData = data?.categoryRevenue||[], topProds = data?.topProducts||[], genders = data?.genderSplit||[]
  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-between flex-wrap gap-4"><div><h1 className="font-display text-3xl tracking-wider">Analytics</h1><p className="text-white/40 text-sm">Sales performance</p></div><select value={year} onChange={e=>setYear(+e.target.value)} className="input w-auto py-2.5 text-sm">{[2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}</select></div>
      <div className="card p-6">
        <h2 className="font-semibold mb-5">Monthly Performance {year}</h2>
        <ResponsiveContainer width="100%" height={280}><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/><XAxis dataKey="month" tick={{fill:"rgba(255,255,255,0.35)",fontSize:11}} axisLine={false} tickLine={false}/><YAxis yAxisId="l" tick={{fill:"rgba(255,255,255,0.35)",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/><YAxis yAxisId="r" orientation="right" tick={{fill:"rgba(255,255,255,0.35)",fontSize:11}} axisLine={false} tickLine={false}/><Tooltip content={<Tip/>}/><Legend wrapperStyle={{paddingTop:"16px",fontSize:"12px"}}/><Bar yAxisId="l" dataKey="Revenue" fill="var(--color-acid)" radius={[4,4,0,0]} fillOpacity={0.85}/><Bar yAxisId="r" dataKey="Orders" fill="#60a5fa" radius={[4,4,0,0]} fillOpacity={0.7}/></BarChart></ResponsiveContainer>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6"><h2 className="font-semibold mb-5">Revenue by Category</h2>{catData.length>0?<ResponsiveContainer width="100%" height={220}><BarChart data={catData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false}/><XAxis type="number" tick={{fill:"rgba(255,255,255,0.35)",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/><YAxis type="category" dataKey="_id" tick={{fill:"rgba(255,255,255,0.5)",fontSize:11}} axisLine={false} tickLine={false} width={80}/><Tooltip content={<Tip/>}/><Bar dataKey="revenue" name="Revenue" fill="var(--color-acid)" radius={[0,4,4,0]} fillOpacity={0.85}/></BarChart></ResponsiveContainer>:<div className="h-52 flex items-center justify-center text-white/20 text-sm">No data</div>}</div>
        <div className="card p-6">
          <h2 className="font-semibold mb-5">Products by Gender</h2>
          <div className="flex items-center gap-8">
            <ResponsiveContainer width="60%" height={180}><PieChart><Pie data={genders} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="count">{genders.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip contentStyle={{background:"#16161f",border:"1px solid rgba(255,255,255,.1)",borderRadius:"12px",fontSize:"12px"}}/></PieChart></ResponsiveContainer>
            <div className="space-y-3 flex-1">{genders.map((g,i)=><div key={g._id} className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{background:COLORS[i%COLORS.length]}}/><span className="text-sm capitalize text-white/60">{g._id}</span></div><span className="text-sm font-semibold">{g.count}</span></div>)}</div>
          </div>
        </div>
      </div>
      <div className="card p-6">
        <h2 className="font-semibold mb-5 flex items-center gap-2"><FiShoppingBag size={16} className="text-acid"/> Top Products</h2>
        <div className="space-y-3">{topProds.slice(0,8).map((p,i)=>(
          <div key={p._id} className="flex items-center gap-4">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i===0?"bg-gold text-dark-900":i===1?"bg-white/20 text-white":i===2?"bg-acid/20 text-acid":"bg-dark-700 text-white/30"}`}>{i+1}</span>
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-dark-600 shrink-0"><img src={p.images?.[0]?.url} alt="" className="w-full h-full object-cover" onError={e=>{e.target.style.display="none"}}/></div>
            <div className="flex-1 min-w-0"><p className="font-medium text-sm line-clamp-1">{p.name}</p><div className="flex-1 h-1.5 bg-dark-600 rounded-full overflow-hidden mt-1"><div className="h-full bg-acid rounded-full" style={{width:`${Math.min(100,(p.soldCount||0)/(topProds[0]?.soldCount||1)*100)}%`}}/></div></div>
            <div className="text-right shrink-0"><p className="text-sm font-semibold text-acid">{p.soldCount||0} sold</p><p className="text-xs text-white/30">₹{p.price?.toLocaleString()}</p></div>
          </div>
        ))}{topProds.length===0&&<p className="text-center text-white/20 py-8">No sales data yet</p>}</div>
      </div>
    </div>
  )
}
export default AdminAnalytics
