import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { FiPackage, FiArrowRight } from "react-icons/fi"
import { orderAPI } from "../api"
import Loading from "../components/common/Loading"

const SC = {pending:"bg-yellow-500/15 text-yellow-400 border-yellow-500/25",confirmed:"bg-blue-500/15 text-blue-400 border-blue-500/25",processing:"bg-purple-500/15 text-purple-400 border-purple-500/25",shipped:"bg-cyan-500/15 text-cyan-400 border-cyan-500/25",delivered:"bg-acid/15 text-acid border-acid/25",cancelled:"bg-fire/15 text-fire border-fire/25"}

export function OrderHistory() {
  const [orders,setOrders]=useState([]), [loading,setLoading]=useState(true)
  useEffect(() => { orderAPI.getMyOrders({limit:20}).then(({data})=>setOrders(data.orders||[])).catch(()=>{}).finally(()=>setLoading(false)) }, [])
  if (loading) return <div className="pt-20"><Loading/></div>
  return (
    <div className="pt-20 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-display text-4xl tracking-wider mb-8">My Orders</h1>
        {orders.length===0 ? (
          <div className="text-center py-20"><FiPackage size={48} className="mx-auto text-white/20 mb-4"/><h2 className="font-semibold text-xl mb-2">No orders yet</h2><p className="text-white/40 mb-6">Start shopping!</p><Link to="/products" className="btn-primary">Shop Now</Link></div>
        ) : (
          <div className="space-y-4">{orders.map(o => (
            <Link key={o._id} to={`/orders/${o._id}`} className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-acid/30 group">
              <div className="flex items-center gap-4 flex-1"><div className="w-14 h-14 rounded-xl bg-dark-600 overflow-hidden shrink-0"><img src={o.items?.[0]?.image} alt="" className="w-full h-full object-cover"/></div><div><p className="font-mono text-xs text-acid mb-1">#{o.orderNumber}</p><p className="font-semibold text-sm">{o.items?.length} item{o.items?.length!==1?"s":""}</p><p className="text-white/40 text-xs">{new Date(o.createdAt).toLocaleDateString("en-IN",{dateStyle:"medium"})}</p></div></div>
              <div className="flex items-center gap-6"><span className={`badge border ${SC[o.status]||SC.pending} capitalize`}>{o.status}</span><span className="font-semibold text-acid">₹{o.pricing?.total?.toLocaleString()}</span><FiArrowRight size={16} className="text-white/20 group-hover:text-acid transition-colors"/></div>
            </Link>
          ))}</div>
        )}
      </div>
    </div>
  )
}
export default OrderHistory
