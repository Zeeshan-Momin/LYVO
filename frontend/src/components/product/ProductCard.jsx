import { useState, memo } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { FiHeart, FiShoppingBag, FiStar } from "react-icons/fi"
import { useAuth } from "../../context/AuthContext"
import { useCart } from "../../context/CartContext"
import { getOptimizedImageUrl } from "../../utils/image"
import toast from "react-hot-toast"

function ProductCard({ product, index = 0 }) {
  const { toggleWishlist, isWishlisted, user, triggerAuthRedirect } = useAuth()
  const { addItem } = useCart()
  const [hovering, setHovering] = useState(false)
  const wishlisted = isWishlisted(product._id)
  const price = product.discountPrice || product.price
  const hasDiscount = product.discountPrice && product.discountPrice < product.price
  const inStock = product.totalStock > 0
  const firstSize = product.sizes?.find(s => s.stock > 0)?.size

  const handleQuickAdd = (e) => {
    e.preventDefault(); e.stopPropagation()
    if (!inStock) { toast.error("Out of stock"); return }
    if (!firstSize) { toast.error("Select size on product page"); return }
    if (!user) {
      triggerAuthRedirect({
        action: "quick_add",
        route: window.location.pathname + window.location.search,
        scroll: window.scrollY,
        payload: { product, size: firstSize, color: "Default", qty: 1 }
      });
      return;
    }
    addItem(product, firstSize)
  }
  const handleWishlist = (e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(product._id) }

  return (
    <motion.div initial={{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true,margin:"-50px"}} transition={{duration:.4,delay:index*.06,ease:[.16,1,.3,1]}}
      onHoverStart={()=>setHovering(true)} onHoverEnd={()=>setHovering(false)}>
      <Link to={`/products/${product.slug||product._id}`} className="block group">
        <div className={`card ${!inStock?"opacity-70":""} border border-white/5`}>
          <div className="relative aspect-product bg-dark-600 overflow-hidden">
            <motion.img src={getOptimizedImageUrl(product.images?.[0]?.url, 400)} alt={product.name} onError={e=>{e.target.src=""}}
              className="w-full h-full object-cover" animate={{scale:hovering?1.06:1}} transition={{duration:.5,ease:[.16,1,.3,1]}}/>
            <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
              {product.isNew && <span className="bg-acid text-dark-900 border border-acid/20 font-mono text-[9px] tracking-widest uppercase px-2 py-0.5 rounded-md font-semibold">New</span>}
              {hasDiscount && <span className="bg-fire text-white font-mono text-[9px] tracking-widest uppercase px-2 py-0.5 rounded-md font-semibold">−{product.discountPercent}%</span>}
              {product.isBestSeller && <span className="bg-white/10 backdrop-blur-md border border-white/15 text-white font-mono text-[9px] tracking-widest uppercase px-2 py-0.5 rounded-md">Best Seller</span>}
              {!inStock && <span className="bg-dark-900/80 backdrop-blur-md border border-white/5 text-white/40 font-mono text-[9px] tracking-widest uppercase px-2 py-0.5 rounded-md">Sold Out</span>}
            </div>
            <motion.button onClick={handleWishlist} animate={{opacity:hovering||wishlisted?1:0,scale:hovering||wishlisted?1:.85}}
              className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-all z-10 ${wishlisted?"bg-fire/20 text-fire border border-fire/30 shadow-[0_0_12px_rgba(255,58,26,0.3)]":"bg-dark-900/60 text-white/70 border border-white/10 hover:border-white hover:text-white"}`}>
              <FiHeart size={14} fill={wishlisted?"currentColor":"none"}/>
            </motion.button>
            <motion.div animate={{y:hovering?0:10,opacity:hovering?1:0}} transition={{duration:.25}} className="absolute bottom-0 inset-x-0 p-3 z-10">
              <button onClick={handleQuickAdd} disabled={!inStock}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${inStock?"bg-acid text-dark-900 hover:bg-white hover:shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:scale-[1.02] shadow-lg":"bg-dark-600/80 text-white/30 cursor-not-allowed"}`}>
                <FiShoppingBag size={14}/> {inStock?"Quick Add":"Out of Stock"}
              </button>
            </motion.div>
          </div>
          <div className="p-4 bg-dark-700/30">
            {product.colors?.length>0 && <div className="flex gap-1.5 mb-2.5">{product.colors.slice(0,5).map((c,i)=><div key={i} title={c.name} className="w-3 h-3 rounded-full border border-white/20 shadow-sm transition-transform group-hover:scale-110" style={{background:c.hex}}/>)}</div>}
            <h3 className="font-semibold text-sm text-white group-hover:text-acid transition-colors line-clamp-1">{product.name}</h3>
            <p className="text-white/40 text-[10px] mt-0.5 mb-2 font-mono uppercase tracking-wider">{product.brand}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2"><span className="font-semibold text-base text-white">₹{price?.toLocaleString()}</span>{hasDiscount && <span className="price-old text-xs">₹{product.price?.toLocaleString()}</span>}</div>
              {product.ratings?.count>0 && <div className="flex items-center gap-1 text-xs text-white/40"><FiStar size={11} className="text-gold fill-gold drop-shadow-[0_0_4px_rgba(255,209,102,0.4)]"/><span>{product.ratings.average?.toFixed(1)}</span></div>}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
export default memo(ProductCard);
