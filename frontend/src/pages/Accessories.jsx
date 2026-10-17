import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { FiArrowRight, FiCheckCircle, FiShield, FiTag, FiShoppingBag, FiLayers } from "react-icons/fi"
import { productAPI } from "../api"
import ProductCard from "../components/product/ProductCard"
import { SkeletonCard } from "../components/common/Loading"

export default function Accessories() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [prodRes, catRes] = await Promise.all([
          productAPI.getAll({ limit: 48 }),
          productAPI.getCategories()
        ])
        setProducts(prodRes.data?.products || [])
        setCategories(catRes.data?.categories || [])
      } catch (err) {
        console.error("Failed to fetch accessories data:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Identify Belts and Socks category descriptors
  const beltCategory = categories.find(c =>
    (c.name || "").toLowerCase().includes("belt") || (c.slug || "").toLowerCase().includes("belt")
  )
  const sockCategory = categories.find(c =>
    (c.name || "").toLowerCase().includes("sock") || (c.slug || "").toLowerCase().includes("sock")
  )

  // Filter products for Belts and Socks
  const beltProducts = products.filter(p => {
    const catName = (p.category?.name || "").toLowerCase()
    const catSlug = (p.category?.slug || "").toLowerCase()
    const catId = p.category?._id || p.category
    return (
      catName.includes("belt") ||
      catSlug.includes("belt") ||
      (beltCategory && (catId === beltCategory._id || catSlug === beltCategory.slug))
    )
  })

  const sockProducts = products.filter(p => {
    const catName = (p.category?.name || "").toLowerCase()
    const catSlug = (p.category?.slug || "").toLowerCase()
    const catId = p.category?._id || p.category
    return (
      catName.includes("sock") ||
      catSlug.includes("sock") ||
      (sockCategory && (catId === sockCategory._id || catSlug === sockCategory.slug))
    )
  })

  const beltViewAllUrl = `/products?category=${beltCategory?.slug || beltCategory?._id || "belts"}`
  const sockViewAllUrl = `/products?category=${sockCategory?.slug || sockCategory?._id || "socks"}`

  return (
    <div className="page-top min-h-screen pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-b from-dark-800/80 to-transparent border-b border-white/5 py-12 md:py-16 mb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-acid/10 border border-acid/20 text-acid text-xs font-mono font-semibold uppercase tracking-widest">
              <FiLayers size={13} />
              <span>LYVO Essentials</span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-wider uppercase text-white leading-none">
              Accessories
            </h1>
            <p className="text-white/60 text-sm sm:text-base leading-relaxed">
              Curated everyday essentials engineered to complement your streetwear aesthetic. Explore handcrafted genuine leather belts and high-performance cushioned socks.
            </p>
          </div>

          {/* Quick Category Anchors */}
          <div className="flex flex-wrap gap-3 pt-6">
            <a
              href="#belts-section"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-all"
            >
              <span>Belts</span>
              <span className="text-acid font-mono">({beltProducts.length})</span>
            </a>
            <a
              href="#socks-section"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-all"
            >
              <span>Socks</span>
              <span className="text-acid font-mono">({sockProducts.length})</span>
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-16">
        {/* ROW 1: BELTS */}
        <section id="belts-section" className="space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl sm:text-3xl tracking-wider uppercase text-white">
                  Belts
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono uppercase font-bold">
                  Leather & Webbing
                </span>
              </div>
              <p className="text-xs text-white/40 mt-1">
                Full-grain leather and precision tactical belts built for everyday durability.
              </p>
            </div>
            <Link
              to={beltViewAllUrl}
              className="group inline-flex items-center gap-1.5 text-xs font-semibold text-acid hover:underline shrink-0"
            >
              <span>View All Belts</span>
              <FiArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {[1, 2, 3, 4].map(n => (
                <SkeletonCard key={n} />
              ))}
            </div>
          ) : beltProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {beltProducts.map((product, idx) => (
                <ProductCard key={product._id} product={product} index={idx} />
              ))}
            </div>
          ) : (
            <div className="card p-10 text-center border border-white/5 bg-dark-800/40 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/30 mx-auto">
                <FiTag size={20} />
              </div>
              <h3 className="font-semibold text-sm text-white/80">No Belt Products Currently Available</h3>
              <p className="text-xs text-white/40 max-w-sm mx-auto">
                New leather belts and seasonal accessory drops are in production. Check back soon or browse our full catalog.
              </p>
              <Link to="/products" className="btn-outline text-xs inline-flex py-2 px-4 mt-2">
                Browse All Products
              </Link>
            </div>
          )}
        </section>

        {/* ROW 2: SOCKS */}
        <section id="socks-section" className="space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl sm:text-3xl tracking-wider uppercase text-white">
                  Socks
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-mono uppercase font-bold">
                  Cushioned Knit
                </span>
              </div>
              <p className="text-xs text-white/40 mt-1">
                Engineered arch compression, breathable mesh weave, and reinforced heel padding.
              </p>
            </div>
            <Link
              to={sockViewAllUrl}
              className="group inline-flex items-center gap-1.5 text-xs font-semibold text-acid hover:underline shrink-0"
            >
              <span>View All Socks</span>
              <FiArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {[1, 2, 3, 4].map(n => (
                <SkeletonCard key={n} />
              ))}
            </div>
          ) : sockProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {sockProducts.map((product, idx) => (
                <ProductCard key={product._id} product={product} index={idx} />
              ))}
            </div>
          ) : (
            <div className="card p-10 text-center border border-white/5 bg-dark-800/40 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/30 mx-auto">
                <FiShoppingBag size={20} />
              </div>
              <h3 className="font-semibold text-sm text-white/80">No Sock Products Currently Available</h3>
              <p className="text-xs text-white/40 max-w-sm mx-auto">
                Performance knit socks and crew drops are arriving soon. Explore our footwear collection in the meantime.
              </p>
              <Link to="/products" className="btn-outline text-xs inline-flex py-2 px-4 mt-2">
                Browse All Products
              </Link>
            </div>
          )}
        </section>

        {/* Brand Promise Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-white/5">
          <div className="card p-5 border border-white/5 bg-dark-800/40 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-acid/10 text-acid flex items-center justify-center">
              <FiShield size={16} />
            </div>
            <h4 className="font-semibold text-sm text-white">Genuine Materials</h4>
            <p className="text-xs text-white/40 leading-relaxed">
              Full-grain leather and heavy-duty hardware built to withstand daily wear.
            </p>
          </div>

          <div className="card p-5 border border-white/5 bg-dark-800/40 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-acid/10 text-acid flex items-center justify-center">
              <FiCheckCircle size={16} />
            </div>
            <h4 className="font-semibold text-sm text-white">Ergonomic Fit</h4>
            <p className="text-xs text-white/40 leading-relaxed">
              Zonal cushioning and anti-slip ribbed cuffs designed for maximum all-day comfort.
            </p>
          </div>

          <div className="card p-5 border border-white/5 bg-dark-800/40 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-acid/10 text-acid flex items-center justify-center">
              <FiLayers size={16} />
            </div>
            <h4 className="font-semibold text-sm text-white">Seamless Checkout</h4>
            <p className="text-xs text-white/40 leading-relaxed">
              Bundle accessories directly with your sneakers with free shipping over ₹999.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
