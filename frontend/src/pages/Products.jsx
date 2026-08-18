import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { FiFilter, FiX, FiSearch } from "react-icons/fi"
import { productAPI, adminAPI } from "../api"
import ProductCard from "../components/product/ProductCard"
import { SkeletonCard } from "../components/common/Loading"
import Dropdown from "../components/common/Dropdown"

const SORT_OPTS = [["-createdAt","Newest"],["price-asc","Price ↑"],["price-desc","Price ↓"],["rating","Top Rated"],["popular","Popular"]]
const SIZES = ["UK 5","UK 6","UK 7","UK 8","UK 9","UK 10","UK 11","UK 12"]
const GENDERS = ["men","women","unisex","kids"]

function FilterPanel({ filters, onFilterChange, categories, onClose, isMobile=false }) {
  const set = (k,v) => onFilterChange({ [k]: filters[k] === v ? "" : v })
  const clear = () => onFilterChange({ category: "", gender: "", size: "", maxPrice: 50000, isNew: "", isFeatured: "", isBestSeller: "", keyword: "" })
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><h3 className="font-semibold text-sm tracking-widest uppercase">Filters</h3><button onClick={clear} className="text-xs text-acid hover:underline">Clear All</button></div>
      <div><p className="text-white/50 text-xs tracking-wider uppercase mb-3">Category</p>
        <div className="space-y-2">{categories.map(c=>(
          <div
            key={c._id}
            role="checkbox"
            aria-checked={filters.category===c._id}
            tabIndex={0}
            onKeyDown={e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();set("category",c._id)}}}
            onClick={()=>set("category",c._id)}
            className="flex items-center gap-2.5 cursor-pointer group outline-none rounded focus-visible:ring-1 focus-visible:ring-acid/40"
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${filters.category===c._id?"bg-acid border-acid":"border-white/20 group-hover:border-acid/50"}`}>{filters.category===c._id && <div className="w-2 h-2 bg-dark-900 rounded-sm"/>}</div>
            <span className={`text-sm transition-colors ${filters.category===c._id?"text-acid":"text-white/60 group-hover:text-white"}`}>{c.name}</span>
          </div>
        ))}</div>
      </div>
      <div><p className="text-white/50 text-xs tracking-wider uppercase mb-3">Gender</p>
        <div className="flex flex-wrap gap-2">{GENDERS.map(g=><button key={g} onClick={()=>set("gender",g)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${filters.gender===g?"bg-acid text-dark-900":"bg-dark-700 text-white/50 hover:bg-dark-600 hover:text-white"}`}>{g}</button>)}</div>
      </div>
      <div><p className="text-white/50 text-xs tracking-wider uppercase mb-3">Size (UK)</p>
        <div className="grid grid-cols-4 gap-2">{SIZES.map(s=><button key={s} onClick={()=>set("size",s)} className={`py-1.5 rounded-lg text-xs font-medium transition-all ${filters.size===s?"bg-acid text-dark-900":"bg-dark-700 text-white/50 hover:bg-dark-600 hover:text-white"}`}>{s.replace("UK ","")}</button>)}</div>
      </div>
      <div><p className="text-white/50 text-xs tracking-wider uppercase mb-3">Max Price: ₹{(filters.maxPrice||50000).toLocaleString()}</p>
        <input type="range" min={0} max={50000} step={500} value={filters.maxPrice||50000} onChange={e=>onFilterChange({maxPrice:+e.target.value})} className="w-full accent-acid outline-none" aria-label="Max Price filter" aria-valuemin="0" aria-valuemax="50000" aria-valuenow={filters.maxPrice||50000}/>
      </div>
      <div><p className="text-white/50 text-xs tracking-wider uppercase mb-3">Quick Filters</p>
        {[["isNew","New Arrivals"],["isFeatured","Featured"],["isBestSeller","Best Sellers"]].map(([k,l])=>(
          <div
            key={k}
            role="checkbox"
            aria-checked={!!filters[k]}
            tabIndex={0}
            onKeyDown={e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();set(k,true)}}}
            onClick={()=>set(k,true)}
            className="flex items-center gap-2.5 cursor-pointer group mb-2 outline-none rounded focus-visible:ring-1 focus-visible:ring-acid/40"
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${filters[k]?"bg-acid border-acid":"border-white/20 group-hover:border-acid/50"}`}>{filters[k] && <div className="w-2 h-2 bg-dark-900 rounded-sm"/>}</div>
            <span className={`text-sm ${filters[k]?"text-acid":"text-white/60"}`}>{l}</span>
          </div>
        ))}
      </div>
      {isMobile && <button onClick={onClose} className="btn-primary w-full py-3">Apply Filters</button>}
    </div>
  )
}

export default function Products() {
  const [sp, setSp] = useSearchParams()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [pagination, setPagination] = useState({})
  const [loading, setLoading] = useState(true)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState({
    keyword:sp.get("keyword")||"", category:sp.get("category")||"", gender:sp.get("gender")||"",
    sort:sp.get("sort")||"-createdAt", isNew:sp.get("isNew")==="true", isFeatured:sp.get("isFeatured")==="true",
    isBestSeller:sp.get("isBestSeller")==="true", minPrice:parseInt(sp.get("minPrice"))||0, maxPrice:parseInt(sp.get("maxPrice"))||50000, size:sp.get("size")||"", page:parseInt(sp.get("page"))||1, limit:12,
  })

  useEffect(() => { productAPI.getCategories().then(({data})=>setCategories(data.categories||[])).catch(()=>{}) }, [])

  useEffect(() => {
    setFilters({
      keyword: sp.get("keyword") || "",
      category: sp.get("category") || "",
      gender: sp.get("gender") || "",
      sort: sp.get("sort") || "-createdAt",
      isNew: sp.get("isNew") === "true",
      isFeatured: sp.get("isFeatured") === "true",
      isBestSeller: sp.get("isBestSeller") === "true",
      minPrice: parseInt(sp.get("minPrice")) || 0,
      maxPrice: parseInt(sp.get("maxPrice")) || 50000,
      size: sp.get("size") || "",
      page: parseInt(sp.get("page")) || 1,
      limit: 12,
    })
  }, [sp])

  const handleFilterChange = (updates) => {
    const newSp = new URLSearchParams(sp)
    Object.entries(updates).forEach(([k, v]) => {
      if (v === "" || v === null || v === undefined || v === false) {
        newSp.delete(k)
      } else {
        newSp.set(k, String(v))
      }
    })
    if (!updates.hasOwnProperty("page")) {
      newSp.set("page", "1")
    }
    setSp(newSp, { replace: true })
  }

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = { sort:filters.sort, page:filters.page, limit:filters.limit }
      if (filters.keyword) params.keyword = filters.keyword
      if (filters.category) params.category = filters.category
      if (filters.gender) params.gender = filters.gender
      if (filters.isNew) params.isNew = true
      if (filters.isFeatured) params.isFeatured = true
      if (filters.isBestSeller) params.isBestSeller = true
      if (filters.maxPrice<50000) params.maxPrice = filters.maxPrice
      if (filters.size) params.size = filters.size
      const { data } = await productAPI.getAll(params)
      setProducts(data.products||[]); setPagination(data.pagination||{})
    } catch { setProducts([]) } finally { setLoading(false) }
  }, [filters])
  useEffect(() => { fetchProducts() }, [fetchProducts])

  return (
    <div className="page-top min-h-screen">
      <div className="border-b border-white/5 bg-dark-800/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10"><p className="tag-line mb-2">Our Collection</p><h1 className="section-title">{filters.isNew?"New Drops":filters.isFeatured?"Featured":filters.gender?filters.gender.toUpperCase():"All Sneakers"}</h1></div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-8 flex-wrap">
          <button onClick={()=>setFilterOpen(true)} className="flex items-center gap-2 btn-outline py-2.5 px-4 text-sm md:hidden"><FiFilter size={15}/> Filters</button>
          <p className="text-white/40 text-sm hidden md:block">{pagination.total||0} products</p>
          <div className="flex-1 max-w-sm relative"><FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={15}/><input value={filters.keyword} onChange={e=>handleFilterChange({keyword:e.target.value})} placeholder="Search products…" className="input pl-10 py-2.5 text-sm"/></div>
          <Dropdown
            value={filters.sort}
            onChange={(val) => handleFilterChange({ sort: val })}
            options={SORT_OPTS}
            className="w-40"
          />
        </div>
        <div className="flex gap-8">
          <aside className="hidden md:block w-52 shrink-0"><div className="sticky top-20"><FilterPanel filters={filters} onFilterChange={handleFilterChange} categories={categories}/></div></aside>
          <div className="flex-1">
            {loading ? <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">{Array(9).fill(0).map((_,i)=><SkeletonCard key={i}/>)}</div>
            : products.length===0 ? (
              <div className="text-center py-24"><div className="text-6xl mb-4">👟</div><h3 className="font-semibold text-xl mb-2">No products found</h3><button onClick={()=>handleFilterChange({category:"",gender:"",size:"",maxPrice:50000,isNew:"",isFeatured:"",isBestSeller:"",keyword:""})} className="btn-primary">Clear Filters</button></div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">{products.map((p,i)=><ProductCard key={p._id} product={p} index={i}/>)}</div>
                {pagination.pages>1 && (
                  <div className="flex items-center justify-center gap-2 mt-12">
                    <button disabled={!pagination.hasPrev} onClick={()=>handleFilterChange({page:filters.page-1})} className="btn-outline px-4 py-2 text-sm disabled:opacity-30">← Prev</button>
                    {Array.from({length:pagination.pages},(_,i)=>i+1).filter(p=>Math.abs(p-filters.page)<=2).map(p=><button key={p} onClick={()=>handleFilterChange({page:p})} className={`w-10 h-10 rounded-xl text-sm font-medium transition-all ${p===filters.page?"bg-acid text-dark-900":"btn-ghost"}`}>{p}</button>)}
                    <button disabled={!pagination.hasNext} onClick={()=>handleFilterChange({page:filters.page+1})} className="btn-outline px-4 py-2 text-sm disabled:opacity-30">Next →</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {filterOpen && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/60 z-50 md:hidden" onClick={()=>setFilterOpen(false)}/>
            <motion.div initial={{x:"-100%"}} animate={{x:0}} exit={{x:"-100%"}} transition={{type:"spring",damping:28,stiffness:300}} className="fixed left-0 top-0 bottom-0 w-80 bg-dark-800 z-50 overflow-y-auto md:hidden">
              <div className="p-6"><div className="flex items-center justify-between mb-6"><h2 className="font-semibold text-lg">Filters</h2><button onClick={()=>setFilterOpen(false)}><FiX size={20}/></button></div><FilterPanel filters={filters} onFilterChange={handleFilterChange} categories={categories} onClose={()=>setFilterOpen(false)} isMobile/></div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
