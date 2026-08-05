import { useState, useEffect } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { FiHeart, FiShoppingBag, FiStar, FiChevronLeft, FiChevronRight, FiCheck, FiTruck, FiRefreshCw, FiShield, FiZap } from "react-icons/fi"
import { productAPI, reviewAPI } from "../api"
import { useAuth } from "../context/AuthContext"
import { useCart } from "../context/CartContext"
import { getOptimizedImageUrl } from "../utils/image"
import ProductCard from "../components/product/ProductCard"
import Loading from "../components/common/Loading"
import toast from "react-hot-toast"

function Gallery({ images=[] }) {
  const [active,setActive]=useState(0), [zoomed,setZoomed]=useState(false)
  if (!images.length) return <div className="aspect-square bg-dark-700 rounded-3xl"/>
  return (
    <div className="space-y-3">
      <div className="relative aspect-square bg-dark-700 rounded-3xl overflow-hidden cursor-zoom-in group" onClick={()=>setZoomed(true)}>
        <AnimatePresence mode="wait"><motion.img key={active} src={getOptimizedImageUrl(images[active]?.url, 800)} alt="" initial={{opacity:0,scale:1.02}} animate={{opacity:1,scale:1}} exit={{opacity:0}} transition={{duration:.3}} className="w-full h-full object-cover"/></AnimatePresence>
        {images.length>1 && (<>
          <button onClick={e=>{e.stopPropagation();setActive(i=>(i-1+images.length)%images.length)}} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 glass rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><FiChevronLeft size={16}/></button>
          <button onClick={e=>{e.stopPropagation();setActive(i=>(i+1)%images.length)}} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 glass rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><FiChevronRight size={16}/></button>
        </>)}
      </div>
      {images.length>1 && <div className="flex gap-2 overflow-x-auto hide-scrollbar">{images.map((img,i)=><button key={i} onClick={()=>setActive(i)} className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${i===active?"border-acid scale-105":"border-white/10"}`}><img src={getOptimizedImageUrl(img.url, 150)} alt="" className="w-full h-full object-cover"/></button>)}</div>}
      <AnimatePresence>{zoomed && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={()=>setZoomed(false)}><motion.img src={getOptimizedImageUrl(images[active]?.url, 1200)} alt="" initial={{scale:.85}} animate={{scale:1}} exit={{scale:.85}} className="max-w-full max-h-full object-contain rounded-2xl"/></motion.div>}</AnimatePresence>
    </div>
  )
}

function Reviews({ productId }) {
  const [reviews,setReviews]=useState([]), [loading,setLoading]=useState(true)
  const { user } = useAuth()
  const [form,setForm]=useState({rating:5,title:"",comment:""}), [submitting,setSubmitting]=useState(false), [showForm,setShowForm]=useState(false)
  useEffect(() => { reviewAPI.getAll(productId,{limit:10}).then(({data})=>setReviews(data.reviews||[])).catch(()=>{}).finally(()=>setLoading(false)) }, [productId])
  const submitReview = async (e) => {
    e.preventDefault()
    if (!form.comment.trim()||!form.title.trim()) { toast.error("Fill all fields"); return }
    setSubmitting(true)
    try { const{data}=await reviewAPI.create(productId,form); setReviews(p=>[data.review,...p]); setShowForm(false); setForm({rating:5,title:"",comment:""}); toast.success("Review submitted!") }
    catch(e) { toast.error(e.response?.data?.message||"Failed") } finally { setSubmitting(false) }
  }
  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-6"><h2 className="font-display text-3xl tracking-wider">Reviews</h2>{user && <button onClick={()=>setShowForm(p=>!p)} className="btn-outline py-2 px-4 text-sm">Write a Review</button>}</div>
      {showForm && (
        <form onSubmit={submitReview} className="card p-6 mb-8 space-y-4">
          <div><label className="label">Rating</label><div className="flex gap-2">{[1,2,3,4,5].map(n=><button key={n} type="button" onClick={()=>setForm(p=>({...p,rating:n}))}><FiStar size={24} className={n<=form.rating?"text-gold fill-gold":"text-white/20"}/></button>)}</div></div>
          <div><label className="label">Title</label><input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} className="input" placeholder="Summarise your experience"/></div>
          <div><label className="label">Comment</label><textarea value={form.comment} onChange={e=>setForm(p=>({...p,comment:e.target.value}))} rows={4} className="input resize-none"/></div>
          <div className="flex gap-3"><button type="submit" disabled={submitting} className="btn-primary py-2.5 px-6">{submitting?"Submitting…":"Submit Review"}</button><button type="button" onClick={()=>setShowForm(false)} className="btn-ghost">Cancel</button></div>
        </form>
      )}
      {loading ? <Loading size="sm"/> : reviews.length===0 ? <div className="text-center py-12 text-white/30"><FiStar size={40} className="mx-auto mb-3 opacity-30"/><p>No reviews yet.</p></div> : (
        <div className="space-y-4">{reviews.map(r => (
          <div key={r._id} className="card p-5 border border-white/5 bg-dark-800/40">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-acid/10 border border-acid/25 flex items-center justify-center text-acid font-bold text-sm">{r.user?.name?.[0]?.toUpperCase()}</div><div><p className="font-medium text-sm">{r.user?.name}</p><div className="flex gap-0.5 mt-0.5">{[1,2,3,4,5].map(n=><FiStar key={n} size={11} className={n<=r.rating?"text-gold fill-gold drop-shadow-[0_0_4px_rgba(255,209,102,0.4)]":"text-white/20"}/>)}</div></div></div>
              <p className="text-white/30 text-xs">{new Date(r.createdAt).toLocaleDateString()}</p>
            </div>
            <p className="font-semibold text-sm mb-1">{r.title}</p><p className="text-white/60 text-sm leading-relaxed">{r.comment}</p>
          </div>
        ))}</div>
      )}
    </div>
  )
}

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toggleWishlist, isWishlisted } = useAuth()
  const { addItem } = useCart()
  const [product,setProduct]=useState(null), [related,setRelated]=useState([]), [loading,setLoading]=useState(true)
  const [selSize,setSelSize]=useState(""), [selColor,setSelColor]=useState(""), [qty,setQty]=useState(1), [addedAnim,setAddedAnim]=useState(false)

  useEffect(() => {
    setLoading(true)
    productAPI.getOne(id).then(({data})=>{setProduct(data.product);setSelColor(data.product.colors?.[0]?.name||"")}).catch(()=>toast.error("Product not found")).finally(()=>setLoading(false))
    productAPI.getRelated(id).then(({data})=>setRelated(data.products||[])).catch(()=>{})
    window.scrollTo({top:0,behavior:"smooth"})
  }, [id])

  if (loading) return <div className="pt-20"><Loading fullscreen/></div>
  if (!product) return <div className="pt-20 text-center py-20"><h2 className="font-display text-4xl mb-4">Not found</h2><Link to="/products" className="btn-primary">Back to Shop</Link></div>

  const price=product.discountPrice||product.price, hasDiscount=product.discountPrice&&product.discountPrice<product.price
  const wishlisted=isWishlisted(product._id), sizeObj=product.sizes?.find(s=>s.size===selSize), inStock=sizeObj?sizeObj.stock>0:product.totalStock>0

  const handleAdd = () => {
    if (!selSize) { toast.error("Please select a size"); return }
    addItem(product,selSize,selColor,qty); setAddedAnim(true); setTimeout(()=>setAddedAnim(false),2000)
  }

  const handleBuyNow = () => {
    if (!selSize) { toast.error("Please select a size"); return }
    addItem(product,selSize,selColor,qty)
    navigate("/checkout")
  }

  return (
    <div className="pt-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center gap-2 text-white/30 text-xs font-mono mb-8"><Link to="/" className="hover:text-acid">Home</Link><span>/</span><Link to="/products" className="hover:text-acid">Shop</Link><span>/</span><span className="text-white/60">{product.name}</span></div>
        <div className="grid lg:grid-cols-2 gap-12 xl:gap-20">
          <Gallery images={product.images}/>
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {product.isNew && <span className="bg-acid text-dark-900 border border-acid/20 font-mono text-[9px] tracking-widest uppercase px-2.5 py-1 rounded-md font-semibold">New</span>}
              {product.isBestSeller && <span className="bg-white/10 backdrop-blur-md border border-white/15 text-white font-mono text-[9px] tracking-widest uppercase px-2.5 py-1 rounded-md">Best Seller</span>}
            </div>
            <div><h1 className="font-display text-4xl md:text-5xl tracking-wider uppercase leading-tight mb-1">{product.name}</h1><p className="text-white/40 text-sm font-mono uppercase tracking-wider">{product.brand} · {product.category?.name} · {(product.views||0).toLocaleString()} views</p></div>
            {product.ratings?.count>0 && <div className="flex items-center gap-3"><div className="flex gap-0.5">{[1,2,3,4,5].map(n=><FiStar key={n} size={15} className={n<=Math.round(product.ratings.average)?"text-gold fill-gold drop-shadow-[0_0_4px_rgba(255,209,102,0.4)]":"text-white/20"}/>)}</div><span className="text-sm text-white/60">{product.ratings.average?.toFixed(1)} ({product.ratings.count} reviews)</span></div>}
            <div className="flex items-baseline gap-4"><span className="font-display text-4xl">₹{price?.toLocaleString()}</span>{hasDiscount && <><span className="price-old">₹{product.price?.toLocaleString()}</span><span className="bg-fire text-white font-mono text-[9px] tracking-widest uppercase px-2.5 py-1 rounded-md font-semibold">{product.discountPercent}% off</span></>}</div>
            {product.colors?.length>0 && <div><p className="label mb-3">Color: <span className="text-white">{selColor}</span></p><div className="flex flex-wrap gap-2.5">{product.colors.map(c=><button key={c.name} onClick={()=>setSelColor(c.name)} title={c.name} className={`w-8 h-8 rounded-full border-2 transition-all ${selColor===c.name?"border-acid scale-110 ring-2 ring-acid/20":"border-white/20 hover:border-white/40"}`} style={{background:c.hex}}/>)}</div></div>}
            <div>
              <div className="flex items-center justify-between mb-3"><p className="label mb-0">Size (UK)</p></div>
              <div className="flex flex-wrap gap-2">{product.sizes?.map(s=>{const oos=s.stock===0; return <button key={s.size} onClick={()=>!oos&&setSelSize(s.size)} disabled={oos} className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${oos?"border-white/8 text-white/20 line-through cursor-not-allowed":selSize===s.size?"bg-acid text-dark-900 border-acid font-semibold scale-[1.02] shadow-[0_0_15px_rgba(204,255,0,0.25)]":"border-white/10 text-white/70 hover:border-acid hover:text-acid"}`}>{s.size.replace("UK ","")}{s.stock<=3&&s.stock>0&&<span className="ml-1 text-[9px] text-fire">({s.stock})</span>}</button>})}</div>
            </div>
            <div className="flex items-center gap-3"><p className="label mb-0 w-20">Quantity</p><div className="flex items-center bg-dark-700/60 rounded-xl overflow-hidden border border-white/5"><button onClick={()=>setQty(q=>Math.max(1,q-1))} className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors text-lg">−</button><span className="w-12 h-10 flex items-center justify-center font-semibold">{qty}</span><button onClick={()=>setQty(q=>Math.min(10,q+1))} className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors text-lg">+</button></div></div>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={handleAdd} 
                disabled={!inStock} 
                className={`flex-1 flex items-center justify-center gap-2.5 py-4 rounded-2xl font-semibold text-sm transition-all duration-300 ${
                  !inStock 
                    ? "bg-dark-700 text-white/30 cursor-not-allowed" 
                    : addedAnim 
                      ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                      : "bg-white/5 border border-white/10 text-white hover:border-acid hover:text-acid"
                }`}
              >
                {addedAnim ? <><FiCheck size={18}/> Added!</> : !inStock ? "Out of Stock" : <><FiShoppingBag size={18}/> Add to Cart</>}
              </button>
              <button 
                onClick={handleBuyNow} 
                disabled={!inStock} 
                className={`flex-1 flex items-center justify-center gap-2.5 py-4 rounded-2xl font-semibold text-sm transition-all duration-300 ${
                  !inStock 
                    ? "bg-dark-700 text-white/30 cursor-not-allowed" 
                    : "bg-acid text-dark-900 hover:bg-white hover:shadow-[0_0_30px_rgba(204,255,0,0.3)] shadow-lg hover:scale-[1.01] active:scale-98"
                }`}
              >
                {!inStock ? "Out of Stock" : <><FiZap size={18}/> Buy Now</>}
              </button>
              <button onClick={()=>toggleWishlist(product._id)} className={`w-14 h-14 rounded-2xl border flex items-center justify-center transition-all ${wishlisted?"bg-fire/10 border-fire/30 text-fire shadow-[0_0_15px_rgba(255,58,26,0.2)]":"border-white/15 text-white/50 hover:border-fire hover:text-fire"}`}><FiHeart size={20} fill={wishlisted?"currentColor":"none"}/></button>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2">{[[<FiTruck size={15}/>,"Free Ship ₹999+"],[<FiRefreshCw size={15}/>,"30-Day Returns"],[<FiShield size={15}/>,"100% Authentic"]].map(([icon,text])=><div key={text} className="flex flex-col items-center gap-2 py-3 px-2 bg-dark-700/50 rounded-xl text-center border border-white/5"><span className="text-acid">{icon}</span><span className="text-white/50 text-xs leading-tight">{text}</span></div>)}</div>
            <div className="pt-4 border-t border-white/8"><h3 className="font-semibold mb-3">About this shoe</h3><p className="text-white/50 text-sm leading-relaxed">{product.description}</p></div>
            {product.features?.length>0 && <div><h3 className="font-semibold mb-3">Features</h3><ul className="space-y-2">{product.features.map((f,i)=><li key={i} className="flex items-center gap-2.5 text-sm text-white/60"><FiCheck size={14} className="text-acid shrink-0"/>{f}</li>)}</ul></div>}
          </div>
        </div>
        <Reviews productId={product._id}/>
        {related.length>0 && <div className="mt-16"><h2 className="font-display text-3xl tracking-wider mb-8">You May Also Like</h2><div className="grid grid-cols-2 md:grid-cols-4 gap-5">{related.slice(0,4).map((p,i)=><ProductCard key={p._id} product={p} index={i}/>)}</div></div>}
      </div>
    </div>
  )
}
