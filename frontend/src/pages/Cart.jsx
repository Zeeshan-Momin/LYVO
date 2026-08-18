import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { FiTrash2, FiPlus, FiMinus, FiArrowRight, FiShoppingBag, FiTag } from "react-icons/fi"
import { useCart } from "../context/CartContext"
import { getOptimizedImageUrl } from "../utils/image"
import { adminAPI } from "../api"
import toast from "react-hot-toast"

export default function Cart() {
  const { items, removeItem, updateQty, subtotal, shippingCost, tax, total, itemCount, couponCode, setCouponCode, couponDiscount, setCouponDiscount } = useCart()
  const navigate = useNavigate()
  const [coupon,setCoupon]=useState(couponCode), [discount,setDiscount]=useState(couponDiscount), [msg,setMsg]=useState(couponCode ? "✓ Coupon applied!" : ""), [applying,setApplying]=useState(false)

  const applyCoupon = async () => {
    if (!coupon.trim()) return
    setApplying(true)
    try {
      const{data}=await adminAPI.validateCoupon({code:coupon,cartTotal:subtotal});
      setDiscount(data.discount);
      setCouponDiscount(data.discount);
      setCouponCode(coupon);
      setMsg(`✓ ${data.coupon.description||"Discount applied!"}`);
      toast.success("Coupon applied!")
    }
    catch(e) {
      setMsg(e.response?.data?.message||"Invalid coupon");
      setDiscount(0);
      setCouponDiscount(0);
      setCouponCode("");
    } finally { setApplying(false) }
  }

  if (itemCount===0) return (
    <div className="page-top min-h-screen flex flex-col items-center justify-center gap-6 text-center px-4">
      <div className="w-24 h-24 rounded-full bg-dark-700 flex items-center justify-center"><FiShoppingBag size={40} className="text-white/20"/></div>
      <div><h2 className="font-display text-4xl tracking-wider mb-2">Cart is Empty</h2><p className="text-white/40">Add some sneakers and start your journey</p></div>
      <Link to="/products" className="btn-primary flex items-center gap-2">Shop Now <FiArrowRight size={16}/></Link>
    </div>
  )

  return (
    <div className="page-top min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-8"><h1 className="font-display text-4xl tracking-wider">Your Cart</h1><span className="text-white/40 text-sm">{itemCount} item{itemCount!==1?"s":""}</span></div>
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence>
              {items.map(item => (
                <motion.div key={`${item.productId}-${item.size}`} initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}}>
                  <div className="card p-5 flex gap-5 border border-white/5 bg-dark-700/30 hover:bg-dark-700/50 hover:border-acid/20 transition-all duration-300">
                    <Link to={`/products/${item.slug}`}><div className="w-24 h-24 rounded-xl overflow-hidden bg-dark-600 shrink-0"><img src={getOptimizedImageUrl(item.image, 150)} alt={item.name} className="w-full h-full object-cover"/></div></Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2 mb-1"><Link to={`/products/${item.slug}`}><h3 className="font-semibold hover:text-acid transition-colors line-clamp-1">{item.name}</h3></Link><button onClick={()=>removeItem(item.productId,item.size,item.color)} className="text-white/20 hover:text-fire transition-colors shrink-0"><FiTrash2 size={16}/></button></div>
                      <p className="text-white/40 text-sm mb-3">Size: {item.size}{item.color?` · ${item.color}`:""}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center bg-dark-700 rounded-xl overflow-hidden border border-white/5">
                          <button onClick={()=>updateQty(item.productId,item.size,item.color,item.quantity-1)} className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"><FiMinus size={12}/></button>
                          <span className="w-10 text-center text-sm font-medium">{item.quantity}</span>
                          <button onClick={()=>updateQty(item.productId,item.size,item.color,item.quantity+1)} className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"><FiPlus size={12}/></button>
                        </div>
                        <span className="font-semibold text-acid">₹{(item.price*item.quantity).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="card p-6 sticky top-22 space-y-5 h-fit border border-white/5 bg-dark-700/40 shadow-xl">
            <h2 className="font-semibold text-lg">Order Summary</h2>
            <div>
              <div className="flex gap-2"><div className="relative flex-1"><FiTag className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14}/><input value={coupon} onChange={e=>setCoupon(e.target.value.toUpperCase())} className="input pl-9 py-2.5 text-sm uppercase" placeholder="PROMO CODE"/></div><button onClick={applyCoupon} disabled={applying} className="btn-outline px-4 py-2.5 text-sm shrink-0 active:scale-95 hover:shadow-[0_0_12px_rgba(204,255,0,0.15)]">Apply</button></div>
              {msg && <p className={`text-xs mt-1.5 ${msg.startsWith("✓")?"text-acid":"text-fire"}`}>{msg}</p>}
              <p className="text-white/25 text-xs mt-1">Try: LYVO10 · VISION20 · HUSTLE15</p>
            </div>
            <div className="space-y-3 text-sm">
              {[["Subtotal",`₹${subtotal.toLocaleString()}`,false],["Shipping",shippingCost===0?"Free 🎉":`₹${shippingCost}`,shippingCost===0],["GST (18%)",`₹${tax.toLocaleString()}`,false],...(discount>0?[["Coupon",`-₹${discount.toLocaleString()}`,true]]:[])].map(([l,v,accent]) => <div key={l} className="flex justify-between"><span className="text-white/50">{l}</span><span className={accent?"text-acid":"text-white/80"}>{v}</span></div>)}
              <div className="border-t border-white/8 pt-3 flex justify-between font-semibold text-base"><span>Total</span><span className="text-acid text-xl">₹{(total-discount).toLocaleString()}</span></div>
            </div>
            {shippingCost>0 && <p className="text-xs text-white/25 text-center bg-acid/5 rounded-lg py-2">Add ₹{(999-subtotal).toLocaleString()} more for free shipping</p>}
            <button onClick={()=>navigate("/checkout")} className="btn-primary w-full py-4 flex items-center justify-center gap-2 text-base hover:shadow-[0_0_25px_rgba(204,255,0,0.25)] hover:scale-[1.01] active:scale-98 transition-all">Checkout <FiArrowRight size={18}/></button>
            <Link to="/products" className="block text-center text-sm text-white/30 hover:text-acid transition-colors">← Continue Shopping</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
