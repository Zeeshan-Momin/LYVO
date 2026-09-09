import { useEffect } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { FiX, FiTrash2, FiPlus, FiMinus, FiShoppingBag, FiArrowRight } from "react-icons/fi"
import { useCart } from "../../context/CartContext"
import { getOptimizedImageUrl } from "../../utils/image"

export default function CartDrawer() {
  const { items, isOpen, setIsOpen, removeItem, updateQty, itemCount, subtotal, shippingCost, tax, total } = useCart()
  const navigate = useNavigate()
  const location = useLocation()

  // Close drawer on route change
  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname, setIsOpen])

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div key="bd" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={()=>setIsOpen(false)}/>
      )}
      {isOpen && (
        <motion.div key="dr" initial={{x:"100%"}} animate={{x:0}} exit={{x:"100%"}} transition={{type:"spring",damping:28,stiffness:300}}
          className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-dark-800 border-l border-white/8 z-50 flex flex-col shadow-2xl">
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
            <div className="flex items-center gap-3"><FiShoppingBag size={20} className="text-acid"/><h2 className="font-semibold text-lg">Cart {itemCount>0 && <span className="ml-2 px-2 py-0.5 bg-acid/15 text-acid rounded-full text-sm">{itemCount}</span>}</h2></div>
            <button onClick={()=>setIsOpen(false)} className="btn-ghost p-2 rounded-full"><FiX size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {items.length===0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-20">
                <div className="w-20 h-20 rounded-full bg-dark-700 flex items-center justify-center"><FiShoppingBag size={32} className="text-white/20"/></div>
                <div><p className="font-semibold text-white/60 mb-1">Cart is empty</p><p className="text-sm text-white/30">Add some sneakers!</p></div>
                <Link to="/products" onClick={()=>setIsOpen(false)} className="btn-primary mt-2">Shop Now</Link>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {items.map(item => (
                  <motion.div key={`${item.productId}-${item.size}-${item.color}`} initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}}>
                    <div className="flex gap-4 p-4 bg-dark-700/30 hover:bg-dark-700/50 rounded-2xl border border-white/5 hover:border-acid/20 transition-all duration-300">
                      <Link to={`/products/${item.slug}`} onClick={()=>setIsOpen(false)}><div className="w-20 h-20 rounded-xl overflow-hidden bg-dark-600 shrink-0"><img src={getOptimizedImageUrl(item.image, 150)} alt={item.name} className="w-full h-full object-cover"/></div></Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`/products/${item.slug}`} onClick={()=>setIsOpen(false)}><h4 className="font-semibold text-sm hover:text-acid transition-colors line-clamp-1">{item.name}</h4></Link>
                        <p className="text-white/40 text-xs mt-0.5 mb-2">Size: {item.size}{item.color && ` · ${item.color}`}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center bg-dark-600 rounded-lg overflow-hidden border border-white/5">
                            <button onClick={()=>updateQty(item.productId,item.size,item.color,item.quantity-1)} className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"><FiMinus size={12}/></button>
                            <span className="w-7 h-7 flex items-center justify-center text-sm font-medium">{item.quantity}</span>
                            <button onClick={()=>updateQty(item.productId,item.size,item.color,item.quantity+1)} className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"><FiPlus size={12}/></button>
                          </div>
                          <span className="font-semibold text-acid text-sm">₹{(item.price*item.quantity).toLocaleString()}</span>
                        </div>
                      </div>
                      <button onClick={()=>removeItem(item.productId,item.size,item.color)} className="text-white/20 hover:text-fire transition-colors self-start mt-1"><FiTrash2 size={15}/></button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
          {items.length>0 && (
            <div className="px-6 py-5 border-t border-white/8 bg-dark-800 space-y-4">
              <div className="space-y-2 text-sm">
                {[["Subtotal",`₹${subtotal.toLocaleString()}`,false],["Shipping",shippingCost===0?"Free 🎉":`₹${shippingCost}`,shippingCost===0],["GST (18%)",`₹${tax.toLocaleString()}`,false]].map(([l,v,accent]) => (
                  <div key={l} className="flex justify-between"><span className="text-white/50">{l}</span><span className={accent?"text-acid":"text-white/80"}>{v}</span></div>
                ))}
                <div className="flex justify-between font-semibold text-base pt-2 border-t border-white/8"><span>Total</span><span className="text-acid text-lg">₹{total.toLocaleString()}</span></div>
              </div>
              {shippingCost>0 && <p className="text-xs text-white/30 text-center">Add ₹{(999-subtotal).toLocaleString()} more for free shipping</p>}
              <button onClick={()=>{setIsOpen(false);navigate("/checkout")}} className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 hover:shadow-[0_0_20px_rgba(204,255,0,0.25)] hover:scale-[1.01] active:scale-98 transition-all">Checkout <FiArrowRight size={16}/></button>
              <Link to="/cart" onClick={()=>setIsOpen(false)} className="block text-center text-sm text-white/40 hover:text-acid transition-colors">View full cart</Link>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
