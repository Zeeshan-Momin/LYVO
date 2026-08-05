import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { FiArrowRight, FiStar, FiZap, FiShield, FiRefreshCw, FiTruck } from "react-icons/fi"
import { productAPI } from "../api"
import ProductCard from "../components/product/ProductCard"
import { SkeletonCard } from "../components/common/Loading"
import HeroShoe from "../components/HeroShoe"


function Hero() {
  return (
    <section className="relative min-h-[75vh] md:min-h-[85vh] flex items-center overflow-hidden pt-24 pb-12 md:py-20 bg-grid-pattern">
      {/* Luxury semantic spot lights */}
      <div className="absolute inset-0 hero-glow-1 pointer-events-none" />
      <div className="absolute inset-0 hero-glow-2 pointer-events-none" />
      <div className="absolute inset-0 hero-glow-3 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-center">
        {/* Left Column: Metallic Logo & Content */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [.16, 1, .3, 1] }}
          className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-6 sm:space-y-7"
        >
          {/* Floating Metallic Logo Plaque */}
          <motion.div
            animate={{
              y: [0, -10, 0],
              rotateX: [0, 1.5, 0],
              rotateY: [0, 3, 0]
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{ perspective: 1000 }}
            className="relative select-none w-fit dark:invert-0 invert"
          >
            <img
              src="/logo.png"
              alt="LYVO Logo"
              className="h-20 sm:h-24 md:h-28 lg:h-32 xl:h-36 w-auto object-contain drop-shadow-[0_20px_45px_rgba(255,255,255,0.06)] transition-transform duration-500 hover:scale-[1.02]"
            />
            {/* Chrome reflection overlay */}
            <div className="absolute inset-0 mix-blend-overlay pointer-events-none shine-beam"
              style={{
                maskImage: "url('/logo.png')",
                WebkitMaskImage: "url('/logo.png')",
                maskSize: "contain",
                WebkitMaskSize: "contain",
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat"
              }}
            />
          </motion.div>

          {/* Spaced Premium Tagline */}
          <div>
            <h2 className="font-sans text-[11px] sm:text-xs tracking-[0.45em] sm:tracking-[0.55em] uppercase text-white/70 font-medium leading-none">
              Live Your Vision Out
            </h2>
          </div>

          {/* Premium descriptive sub-text */}
          <p className="text-white/50 text-xs sm:text-sm max-w-lg lg:max-w-xl leading-relaxed font-sans font-normal">
            Step into the future of footwear. Explore our curated collection of high-performance sneakers designed to elevate your lifestyle, movement, and vision. Engineered for comfort, crafted for style.
          </p>

          {/* Refined buttons with borders and hover styles */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 w-full sm:w-auto pt-2">
            <Link
              to="/products"
              className="btn-primary flex items-center gap-2 group tracking-widest text-[10px] uppercase font-bold py-4 px-8 hover:shadow-[0_0_25px_rgba(204,255,0,0.2)] active:scale-95 transition-all"
            >
              Live Drops
              <FiArrowRight size={16} className="group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
          </div>
        </motion.div>

        {/* Right Column: 3D Showcase */}
        <motion.div
          initial={{ opacity: 0, scale: .95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [.16, 1, .3, 1], delay: .15 }}
          className="relative w-full flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(204,255,0,0.1),transparent_65%)] blur-3xl pointer-events-none" />
          <HeroShoe />
        </motion.div>
      </div>
    </section>
  )
}

export default function Home() {
  const [featured, setFeatured] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { productAPI.getFeatured().then(({ data }) => setFeatured(data.products || [])).catch(() => { }).finally(() => setLoading(false)) }, [])
  return (
    <div>
      <Hero />
      <div className="border-y border-white/5 bg-dark-800/30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
          {[[<FiTruck />, "Free Shipping", "On orders above ₹999"], [<FiRefreshCw />, "Easy Returns", "30-day hassle-free"], [<FiShield />, "100% Authentic", "Genuine products"], [<FiZap />, "Fast Delivery", "3–5 business days"]].map(([icon, title, desc], i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="flex items-center gap-4 px-6 py-8"
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white text-lg shrink-0">{icon}</div>
              <div><p className="font-semibold text-sm tracking-wide text-white">{title}</p><p className="text-white/40 text-xs mt-0.5">{desc}</p></div>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="overflow-hidden bg-white/5 border-y border-white/10 py-4">
        <motion.div className="flex whitespace-nowrap" animate={{ x: ["0%", "-50%"] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }}>
          {[...Array(6)].map((_, i) => <span key={i} className="font-display text-sm tracking-[0.25em] uppercase text-white/50 px-8">Live Your Vision Out <span className="text-white/20 mx-3">·</span> SS 2026 Collection <span className="text-white/20 mx-3">·</span></span>)}
        </motion.div>
      </div>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <p className="tag-line mb-3">Browse by</p>
        <h2 className="section-title mb-10">Categories</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[["All", "/products", "photo-1542291026-7eec264c27ff"], ["Running", "/products?category=running", "photo-1606107557195-0e29a4b5b4aa"], ["Lifestyle", "/products?category=lifestyle", "photo-1491553895911-0055eca6402d"], ["Limited Ed.", "/products?category=limited-ed", "photo-1584735175315-9d5df23be2f1"]].map(([label, to, img], i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .08 }}>
              <Link to={to} className="group relative block aspect-square rounded-2xl overflow-hidden card border border-white/5 shadow-lg">
                <img src={`https://images.unsplash.com/${img}?w=455`} alt={label} className="w-full h-full object-cover transition-transform duration-700 ease-[.16,1,.3,1] group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-900/95 via-dark-900/30 to-transparent transition-opacity duration-300" />
                <div className="absolute inset-0 border border-white/0 group-hover:border-acid/30 rounded-2xl transition-all duration-300" />
                <div className="absolute bottom-0 left-0 right-0 p-5 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                  <p className="font-display text-xl sm:text-2xl tracking-wider text-white flex items-center gap-2">
                    {label}
                    <FiArrowRight size={16} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-acid" />
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="flex items-end justify-between mb-10"><div><p className="tag-line mb-3">Handpicked</p><h2 className="section-title">Featured <span className="text-acid">Drops</span></h2></div></div>
        {loading ? <div className="grid grid-cols-2 md:grid-cols-4 gap-5">{Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)}</div> : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">{featured.slice(0, 8).map((p, i) => <ProductCard key={p._id} product={p} index={i} />)}</div>
        )}
        <div className="text-center mt-10"><Link to="/products" className="btn-outline inline-flex items-center gap-2">Shop All Sneakers <FiArrowRight size={16} /></Link></div>
      </section>
      <section className="bg-dark-800/50 border-y border-white/5 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [.16, 1, .3, 1] }}
          >
            <p className="tag-line mb-4">Our Story</p>
            <h2 className="section-title mb-6">Born from <span className="text-acid">Progress</span></h2>
            <p className="text-white/60 leading-relaxed mb-6">LYVO was never just about sneakers. It was born from a simple belief — everyone deserves to move forward, no matter where they start.</p>
            <blockquote className="border-l-2 border-acid pl-4 italic text-white/80 text-lg font-sans leading-relaxed">"When you wear LYVO, you're not just wearing sneakers — you're wearing your story."</blockquote>
          </motion.div>
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [.16, 1, .3, 1] }}
          >
            {/* Ambient background glow under story image */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-acid/15 to-fire/5 blur-3xl rounded-3xl opacity-50 pointer-events-none" />
            <img src="https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=700" alt="LYVO Story" className="relative rounded-3xl w-full object-cover aspect-[4/3] shadow-2xl border border-white/5" />
            <div className="absolute -bottom-6 -left-6 glass rounded-2xl p-5 border border-acid/20 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
              <div className="flex gap-1 mb-2">{Array(5).fill(0).map((_, i) => <FiStar key={i} className="text-gold fill-gold" size={14} />)}</div>
              <p className="text-sm font-semibold tracking-wide text-white">50,000+ Happy Customers</p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
