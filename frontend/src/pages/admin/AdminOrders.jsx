import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FiSearch, FiX, FiCheck, FiPackage, FiEye } from "react-icons/fi"
import { orderAPI } from "../../api"
import Loading from "../../components/common/Loading"
import toast from "react-hot-toast"

const SO = ["pending","confirmed","processing","shipped","delivered","cancelled","return_requested","returned","refunded"]
const SC = {pending:"bg-yellow-500/15 text-yellow-400 border-yellow-500/25",confirmed:"bg-blue-500/15 text-blue-400 border-blue-500/25",processing:"bg-purple-500/15 text-purple-400 border-purple-500/25",shipped:"bg-cyan-500/15 text-cyan-400 border-cyan-500/25",delivered:"bg-acid/15 text-acid border-acid/25",cancelled:"bg-fire/15 text-fire border-fire/25",return_requested:"bg-purple-500/15 text-purple-400 border-purple-500/25",returned:"bg-white/10 text-white/50 border-white/15",refunded:"bg-white/10 text-white/50 border-white/15"}

function OrderModal({ order, onClose, onUpdate }) {
  const [status,setStatus]=useState(order.status), [note,setNote]=useState(""), [tracking,setTracking]=useState(order.trackingNumber||""), [saving,setSaving]=useState(false)
  const save = async () => { setSaving(true); try { await orderAPI.updateStatus(order._id,{status,note,trackingNumber:tracking}); toast.success("Updated"); onUpdate(); onClose() } catch(e) { toast.error(e.response?.data?.message||"Failed") } finally { setSaving(false) } }
  const resolveReturn = async (decision) => { setSaving(true); try { await orderAPI.updateReturnStatus(order._id,{decision}); toast.success(`Return ${decision}`); onUpdate(); onClose() } catch(e) { toast.error(e.response?.data?.message||"Failed") } finally { setSaving(false) } }
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{scale:.95}} animate={{scale:1}} className="bg-dark-800 border border-white/10 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-white/8"><h2 className="font-semibold text-lg">Order #{order.orderNumber}</h2><button onClick={onClose} className="btn-ghost p-2 rounded-full"><FiX size={20}/></button></div>
        <div className="p-6 space-y-5">
          <div className="bg-dark-700/50 rounded-xl p-4"><p className="text-white/40 text-xs uppercase mb-2">Customer</p><p className="font-medium">{order.user?.name}</p><p className="text-white/50 text-sm">{order.user?.email}</p></div>
          <div><p className="text-white/40 text-xs uppercase mb-3">Items</p><div className="space-y-2">{order.items?.map((item,i)=><div key={i} className="flex items-center gap-3 bg-dark-700/30 rounded-xl p-3"><div className="w-12 h-12 rounded-lg overflow-hidden bg-dark-600 shrink-0"><img src={item.image} alt="" className="w-full h-full object-cover"/></div><div className="flex-1 min-w-0"><p className="text-sm font-medium line-clamp-1">{item.name}</p><p className="text-white/40 text-xs">Size: {item.size} · Qty: {item.quantity}</p></div><p className="text-acid text-sm font-semibold shrink-0">₹{(item.price*item.quantity).toLocaleString()}</p></div>)}</div></div>
          <div className="bg-dark-700/50 rounded-xl p-4"><div className="space-y-2 text-sm">{[["Subtotal",`₹${order.pricing?.subtotal?.toLocaleString()}`],["Shipping",order.pricing?.shippingCost===0?"Free":`₹${order.pricing?.shippingCost}`],["Tax",`₹${order.pricing?.tax?.toLocaleString()}`]].map(([l,v])=><div key={l} className="flex justify-between"><span className="text-white/50">{l}</span><span>{v}</span></div>)}<div className="border-t border-white/8 pt-2 flex justify-between font-bold"><span>Total</span><span className="text-acid">₹{order.pricing?.total?.toLocaleString()}</span></div></div></div>
          {order.status==="return_requested" && order.returnRequest?.status==="pending" && (
            <div className="bg-purple-500/10 border border-purple-500/25 rounded-xl p-4 space-y-3">
              <p className="text-white/40 text-xs uppercase">Return Requested</p>
              <p className="text-sm"><span className="font-medium">{order.returnRequest.reason}</span>{order.returnRequest.comment && <span className="text-white/50"> — {order.returnRequest.comment}</span>}</p>
              <div className="flex gap-3">
                <button onClick={()=>resolveReturn("approved")} disabled={saving} className="btn-primary py-2.5 px-5 text-sm">Approve &amp; Refund</button>
                <button onClick={()=>resolveReturn("rejected")} disabled={saving} className="btn-outline py-2.5 px-5 text-sm border-fire/30 text-fire hover:bg-fire/10">Reject</button>
              </div>
            </div>
          )}
          <div className="space-y-4 border-t border-white/8 pt-5">
            <h3 className="font-semibold">Update Order</h3>
            <div><label className="label">Status</label><div className="flex flex-wrap gap-2">{SO.map(s=><button key={s} type="button" onClick={()=>setStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize border transition-all ${status===s?SC[s]:"border-white/10 text-white/40 hover:border-white/25 hover:text-white"}`}>{s.replace("_"," ")}</button>)}</div></div>
            <div><label className="label">Tracking Number</label><input value={tracking} onChange={e=>setTracking(e.target.value)} className="input" placeholder="e.g. DTDC1234567890"/></div>
            <div><label className="label">Note</label><input value={note} onChange={e=>setNote(e.target.value)} className="input" placeholder="Add a note…"/></div>
            <div className="flex gap-3"><button onClick={onClose} className="btn-ghost px-5 py-3">Cancel</button><button onClick={save} disabled={saving} className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">{saving?<span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin"/>:<><FiCheck size={15}/> Update Order</>}</button></div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function AdminOrders() {
  const [orders,setOrders]=useState([]), [loading,setLoading]=useState(true), [search,setSearch]=useState(""), [statusFilter,setStatusFilter]=useState("")
  const [page,setPage]=useState(1), [pagination,setPagination]=useState({}), [selected,setSelected]=useState(null)
  const fetch = async () => { setLoading(true); try { const{data}=await orderAPI.getAll({page,limit:15,status:statusFilter||undefined,search:search||undefined}); setOrders(data.orders||[]); setPagination(data.pagination||{}) } catch {} finally { setLoading(false) } }
  useEffect(()=>{ fetch() },[page,statusFilter,search])
  return (
    <div className="space-y-5 pb-6">
      <div><h1 className="font-display text-3xl tracking-wider">Orders</h1><p className="text-white/40 text-sm">{pagination.total||0} total</p></div>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48"><FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} className="input pl-10 py-2.5 text-sm w-full" placeholder="Search by order #…"/></div>
        <div className="flex gap-2 flex-wrap"><button onClick={()=>setStatusFilter("")} className={`px-4 py-2.5 rounded-xl text-xs font-medium border transition-all ${!statusFilter?"bg-acid/15 text-acid border-acid/25":"border-white/10 text-white/40 hover:border-white/25"}`}>All</button>{SO.map(s=><button key={s} onClick={()=>setStatusFilter(s)} className={`px-4 py-2.5 rounded-xl text-xs font-medium capitalize border transition-all ${statusFilter===s?SC[s]:"border-white/10 text-white/40 hover:border-white/25 hover:text-white"}`}>{s.replace("_"," ")}</button>)}</div>
      </div>
      {loading ? <Loading/> : (
        <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full">
          <thead><tr className="border-b border-white/8">{["Order","Customer","Items","Total","Status","Date","Action"].map(h=><th key={h} className="text-left px-5 py-3.5 text-xs font-medium tracking-wider uppercase text-white/40">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-white/5">{orders.map(o=>(
            <tr key={o._id} className="hover:bg-white/2 transition-colors">
              <td className="px-5 py-4"><p className="font-mono text-xs text-acid font-semibold">#{o.orderNumber}</p></td>
              <td className="px-5 py-4"><p className="text-sm font-medium">{o.user?.name||"—"}</p><p className="text-white/30 text-xs">{o.user?.email}</p></td>
              <td className="px-5 py-4 text-sm text-white/60">{o.items?.length} item{o.items?.length!==1?"s":""}</td>
              <td className="px-5 py-4"><p className="text-sm font-semibold text-acid">₹{o.pricing?.total?.toLocaleString()}</p></td>
              <td className="px-5 py-4"><span className={`badge border capitalize ${SC[o.status]}`}>{o.status.replace("_"," ")}</span></td>
              <td className="px-5 py-4 text-white/40 text-xs">{new Date(o.createdAt).toLocaleDateString("en-IN")}</td>
              <td className="px-5 py-4"><button onClick={()=>setSelected(o)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-acid/10 hover:text-acid flex items-center justify-center transition-colors"><FiEye size={14}/></button></td>
            </tr>
          ))}</tbody>
        </table>{orders.length===0&&<div className="text-center py-16 text-white/30"><FiPackage size={36} className="mx-auto mb-3"/><p>No orders found</p></div>}</div></div>
      )}
      {pagination.pages>1 && <div className="flex items-center justify-center gap-2"><button disabled={!pagination.hasPrev} onClick={()=>setPage(p=>p-1)} className="btn-outline px-4 py-2 text-sm disabled:opacity-30">← Prev</button><span className="text-white/40 text-sm">Page {page} of {pagination.pages}</span><button disabled={!pagination.hasNext} onClick={()=>setPage(p=>p+1)} className="btn-outline px-4 py-2 text-sm disabled:opacity-30">Next →</button></div>}
      <AnimatePresence>{selected&&<OrderModal order={selected} onClose={()=>setSelected(null)} onUpdate={fetch}/>}</AnimatePresence>
    </div>
  )
}
