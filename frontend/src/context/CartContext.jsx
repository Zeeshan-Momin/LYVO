import { createContext, useContext, useState, useEffect, useCallback } from "react"
import toast from "react-hot-toast"
const Ctx = createContext(null), KEY = "lyvo_cart"
export function CartProvider({ children }) {
  const [items,setItems]=useState(()=>{ try{ return JSON.parse(localStorage.getItem(KEY))||[] }catch{ return [] } })
  const [isOpen,setIsOpen]=useState(false)
  const [couponCode, setCouponCode] = useState("")
  const [couponDiscount, setCouponDiscount] = useState(0)
  useEffect(()=>{ localStorage.setItem(KEY,JSON.stringify(items)) },[items])
  const addItem = useCallback((product,size,color="",quantity=1) => {
    setItems(prev=>{
      const idx=prev.findIndex(i=>i.productId===product._id&&i.size===size&&i.color===color)
      if(idx>-1){ const u=[...prev]; u[idx]={...u[idx],quantity:u[idx].quantity+quantity}; return u }
      return [...prev,{productId:product._id,name:product.name,price:product.discountPrice||product.price,image:product.images?.[0]?.url||"",size,color,quantity,slug:product.slug}]
    })
    toast.success(`${product.name} added to cart 🛒`); setIsOpen(true)
  },[])
  const removeItem = useCallback((productId,size,color="") => setItems(prev=>prev.filter(i=>!(i.productId===productId&&i.size===size&&i.color===color))),[])
  const updateQty = useCallback((productId,size,color="",qty) => {
    if (qty<1) { removeItem(productId,size,color); return }
    setItems(prev=>prev.map(i=>i.productId===productId&&i.size===size&&i.color===color?{...i,quantity:qty}:i))
  },[removeItem])
  const clearCart = useCallback(()=>{setItems([]); setCouponCode(""); setCouponDiscount(0);},[])
  const itemCount=items.reduce((s,i)=>s+i.quantity,0), subtotal=items.reduce((s,i)=>s+i.price*i.quantity,0)
  const shippingCost=subtotal>=999?0:99, tax=Math.round(subtotal*0.18), total=subtotal+shippingCost+tax
  return <Ctx.Provider value={{items,itemCount,subtotal,shippingCost,tax,total,isOpen,setIsOpen,addItem,removeItem,updateQty,clearCart,couponCode,setCouponCode,couponDiscount,setCouponDiscount}}>{children}</Ctx.Provider>
}
export const useCart = () => { const ctx=useContext(Ctx); if(!ctx) throw new Error("useCart must be inside CartProvider"); return ctx }
