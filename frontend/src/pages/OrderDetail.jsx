import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { FiArrowLeft, FiMapPin, FiCheck } from "react-icons/fi"
import { orderAPI } from "../api"
import Loading from "../components/common/Loading"
import CancelReturnModal from "../components/common/CancelReturnModal"
import toast from "react-hot-toast"

const SC = {pending:"bg-yellow-500/15 text-yellow-400 border-yellow-500/25",confirmed:"bg-blue-500/15 text-blue-400 border-blue-500/25",processing:"bg-purple-500/15 text-purple-400 border-purple-500/25",shipped:"bg-cyan-500/15 text-cyan-400 border-cyan-500/25",delivered:"bg-acid/15 text-acid border-acid/25",cancelled:"bg-fire/15 text-fire border-fire/25",return_requested:"bg-purple-500/15 text-purple-400 border-purple-500/25",returned:"bg-white/10 text-white/50 border-white/15",refunded:"bg-white/10 text-white/50 border-white/15"}
const PROG = ["pending","confirmed","processing","shipped","delivered"]
const RETURN_WINDOW_DAYS = 7

export default function OrderDetail() {
  const { id } = useParams()
  const [order,setOrder]=useState(null), [loading,setLoading]=useState(true), [submitting,setSubmitting]=useState(false), [modal,setModal]=useState(null) // "cancel" | "return" | null
  useEffect(() => { orderAPI.getOne(id).then(({data})=>setOrder(data.order)).catch(()=>toast.error("Order not found")).finally(()=>setLoading(false)) }, [id])

  const handleSubmit = async ({ reason, comment }) => {
    setSubmitting(true)
    try {
      const { data } = modal==="cancel"
        ? await orderAPI.cancel(id,{reason: comment ? `${reason}: ${comment}` : reason})
        : await orderAPI.requestReturn(id,{reason, comment})
      setOrder(data.order); setModal(null)
      toast.success(modal==="cancel" ? "Order cancelled" : "Return requested — we'll review it shortly")
    } catch(e) { toast.error(e.response?.data?.message||"Failed") } finally { setSubmitting(false) }
  }

  if (loading) return <div className="pt-20"><Loading/></div>
  if (!order) return <div className="pt-20 text-center py-20"><h2 className="font-display text-3xl mb-4">Order not found</h2><Link to="/orders" className="btn-primary">Back to Orders</Link></div>
  const curIdx = PROG.indexOf(order.status)
  const canCancel = ["pending","confirmed"].includes(order.status)
  const withinReturnWindow = order.deliveredAt && (Date.now()-new Date(order.deliveredAt).getTime()) <= RETURN_WINDOW_DAYS*24*60*60*1000
  const canReturn = order.status==="delivered" && withinReturnWindow
  return (
    <div className="pt-20 min-h-screen">
      {modal && <CancelReturnModal type={modal} onClose={()=>setModal(null)} onSubmit={handleSubmit} submitting={submitting}/>}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div><Link to="/orders" className="text-white/40 text-sm hover:text-acid mb-2 inline-flex items-center gap-1.5"><FiArrowLeft size={14}/> My Orders</Link><h1 className="font-display text-3xl tracking-wider">#{order.orderNumber}</h1><p className="text-white/40 text-sm mt-1">Placed on {new Date(order.createdAt).toLocaleDateString("en-IN",{dateStyle:"long"})}</p></div>
          <div className="flex items-center gap-3">
            <span className={`badge border text-sm ${SC[order.status]} capitalize`}>{order.status.replace("_"," ")}</span>
            {canCancel && <button onClick={()=>setModal("cancel")} className="btn-outline py-2 px-4 text-sm border-fire/30 text-fire hover:bg-fire/10">Cancel Order</button>}
            {canReturn && <button onClick={()=>setModal("return")} className="btn-outline py-2 px-4 text-sm border-acid/30 text-acid hover:bg-acid/10">Return Order</button>}
          </div>
        </div>
        {order.status==="return_requested" && <div className="mb-6 p-4 rounded-xl border border-purple-500/25 bg-purple-500/10 text-sm text-purple-300">Your return request ({order.returnRequest?.reason}) is under review.</div>}
        {!["cancelled","refunded","return_requested","returned"].includes(order.status) && (
          <div className="card p-6 mb-6">
            <p className="text-white/40 text-xs tracking-wider uppercase mb-5">Order Progress</p>
            <div className="flex items-start justify-between">
              {PROG.map((s,i)=>(
                <div key={s} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-2"><div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${i<curIdx?"bg-acid border-acid text-dark-900":i===curIdx?"border-acid text-acid":"border-white/15 text-white/20"}`}>{i<curIdx?<FiCheck size={15}/>:<span className="text-xs font-medium">{i+1}</span>}</div><span className={`text-[10px] capitalize text-center hidden sm:block ${i<=curIdx?"text-white/70":"text-white/25"}`}>{s}</span></div>
                  {i<PROG.length-1 && <div className={`flex-1 h-px mx-2 mb-5 transition-all ${i<curIdx?"bg-acid":"bg-white/10"}`}/>}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="card p-6"><h3 className="font-semibold mb-4">Items Ordered</h3><div className="space-y-4">{order.items?.map((item,i)=><div key={i} className="flex items-center gap-4"><div className="w-16 h-16 rounded-xl overflow-hidden bg-dark-600 shrink-0"><img src={item.image} alt="" className="w-full h-full object-cover"/></div><div className="flex-1 min-w-0"><p className="font-medium text-sm line-clamp-1">{item.name}</p><p className="text-white/40 text-xs mt-0.5">Size: {item.size} · Qty: {item.quantity}</p></div><p className="font-semibold text-acid shrink-0">₹{(item.price*item.quantity)?.toLocaleString()}</p></div>)}</div></div>
            <div className="card p-6"><h3 className="font-semibold mb-3 flex items-center gap-2"><FiMapPin size={15} className="text-acid"/> Delivery Address</h3><p className="font-medium">{order.shippingAddress?.fullName}</p><p className="text-white/50 text-sm mt-0.5">{order.shippingAddress?.phone}</p><p className="text-white/50 text-sm mt-1">{order.shippingAddress?.address}, {order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.zipCode}</p></div>
          </div>
          <div className="card p-5 space-y-3 h-fit">
            <h3 className="font-semibold">Payment Summary</h3>
            {[["Subtotal",`₹${order.pricing?.subtotal?.toLocaleString()}`],["Shipping",order.pricing?.shippingCost===0?"Free":`₹${order.pricing?.shippingCost}`],["Tax",`₹${order.pricing?.tax?.toLocaleString()}`],...(order.pricing?.couponDiscount>0?[["Coupon",`-₹${order.pricing.couponDiscount.toLocaleString()}`]]:[])].map(([l,v])=><div key={l} className="flex justify-between text-sm"><span className="text-white/50">{l}</span><span className={l==="Coupon"?"text-acid":"text-white/80"}>{v}</span></div>)}
            <div className="border-t border-white/8 pt-3 flex justify-between font-bold"><span>Total</span><span className="text-acid text-xl">₹{order.pricing?.total?.toLocaleString()}</span></div>
            <p className="text-xs text-white/30 pt-1">Via: <span className="text-white/60 capitalize">{order.paymentMethod}</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}
