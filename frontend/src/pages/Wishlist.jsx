import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { FiHeart, FiArrowRight } from "react-icons/fi"
import { productAPI } from "../api"
import { useAuth } from "../context/AuthContext"
import ProductCard from "../components/product/ProductCard"
import Loading from "../components/common/Loading"

export default function Wishlist() {
  const { user } = useAuth()
  const [products,setProducts]=useState([]), [loading,setLoading]=useState(true)
  useEffect(() => {
    const ids = (user?.wishlist||[]).map(id=>typeof id==="string"?id:id?._id).filter(Boolean)
    if (!ids.length) { setLoading(false); return }
    Promise.all(ids.slice(0,20).map(id=>productAPI.getOne(id).then(r=>r.data.product).catch(()=>null))).then(prods=>setProducts(prods.filter(Boolean))).finally(()=>setLoading(false))
  }, [user?.wishlist?.length])
  if (loading) return <div className="pt-20"><Loading/></div>
  return (
    <div className="pt-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-8"><h1 className="font-display text-4xl tracking-wider">Wishlist{products.length>0 && <span className="ml-3 text-acid">{products.length}</span>}</h1><Link to="/products" className="btn-outline flex items-center gap-2 py-2.5 px-5 text-sm">Shop More <FiArrowRight size={14}/></Link></div>
        {products.length===0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5 text-center"><div className="w-24 h-24 rounded-full bg-dark-700 flex items-center justify-center"><FiHeart size={40} className="text-white/20"/></div><div><h2 className="font-semibold text-xl mb-2">Wishlist is empty</h2><p className="text-white/40 text-sm">Save sneakers you love</p></div><Link to="/products" className="btn-primary flex items-center gap-2">Browse Collection <FiArrowRight size={16}/></Link></div>
        ) : <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">{products.map((p,i)=><ProductCard key={p._id} product={p} index={i}/>)}</div>}
      </div>
    </div>
  )
}
