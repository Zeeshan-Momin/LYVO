import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiX, FiCheck, FiAlertTriangle } from "react-icons/fi"
import { productAPI, adminAPI } from "../../api"
import Loading from "../../components/common/Loading"
import toast from "react-hot-toast"

const EMPTY = {name:"",brand:"LYVO",description:"",shortDescription:"",gender:"unisex",price:"",discountPrice:"",category:"",isFeatured:false,isNew:true,isBestSeller:false,isActive:true,tags:"",features:"",colors:"",sizes:""}

function ProductForm({ product, categories, onSave, onClose }) {
  const [form,setForm]=useState(product?{...product,category:product.category?._id||product.category||"",tags:product.tags?.join(",")||"",features:product.features?.join("\n")||"",colors:product.colors?.map(c=>`${c.name}:${c.hex}`).join("\n")||"",sizes:product.sizes?.map(s=>`${s.size}:${s.stock}`).join("\n")||""}:EMPTY)
  const [previews,setPreviews]=useState(product?.images?.map(i=>({url:i.url,existing:true,publicId:i.publicId}))||[])
  const [deletedImages,setDeletedImages]=useState([])
  const [saving,setSaving]=useState(false)
  const fileRef = useRef()
  const set = (k,v) => setForm(p=>({...p,[k]:v}))
  const pickFiles = e => {
    const picked=Array.from(e.target.files||[])
    const newPreviews = picked.map(f=>({url:URL.createObjectURL(f),existing:false,file:f}))
    setPreviews(p=>[...p,...newPreviews])
  }
  const removePreview = (index) => {
    const item = previews[index]
    if (item.existing) {
      setDeletedImages(prev=>[...prev,item.publicId])
    }
    setPreviews(prev=>prev.filter((_,i)=>i!==index))
  }
  const save = async e => {
    e.preventDefault()
    if (!form.name||!form.price||!form.category) { toast.error("Name, price and category required"); return }
    setSaving(true)
    try {
      const fd = new FormData()
      const sizes=form.sizes.split("\n").filter(Boolean).map(l=>{const[size,stock]=l.split(":");return{size:size?.trim(),stock:parseInt(stock)||0}})
      const colors=form.colors.split("\n").filter(Boolean).map(l=>{const[name,hex]=l.split(":");return{name:name?.trim(),hex:hex?.trim()||"#fff"}})
      const tags=form.tags.split(",").map(t=>t.trim()).filter(Boolean)
      const features=form.features.split("\n").map(f=>f.trim()).filter(Boolean)
      const payload={...form,tags,features,sizes,colors,price:+form.price,discountPrice:+form.discountPrice||0}
      delete payload.images
      Object.entries(payload).forEach(([k,v]) => { if(typeof v==="object") fd.append(k,JSON.stringify(v)); else if(v!==""&&v!==undefined) fd.append(k,v) })
      
      const activeFiles = previews.filter(p=>!p.existing).map(p=>p.file)
      activeFiles.forEach(f=>fd.append("images",f))

      if (product?._id) {
        for (const pid of deletedImages) {
          if (pid) {
            await productAPI.deleteImage(product._id, { publicId: pid }).catch(console.error)
          }
        }
        await productAPI.update(product._id,fd)
      } else {
        await productAPI.create(fd)
      }
      toast.success(product?"Product updated!":"Product created!")
      onSave()
    } catch(e) { toast.error(e.response?.data?.message||"Save failed") } finally { setSaving(false) }
  }
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen flex items-start justify-center p-4 py-8">
        <motion.div initial={{y:40,opacity:0}} animate={{y:0,opacity:1}} className="bg-dark-800 border border-white/10 rounded-3xl w-full max-w-4xl">
          <div className="flex items-center justify-between p-6 border-b border-white/8"><h2 className="font-semibold text-xl">{product?"Edit Product":"Add Product"}</h2><button onClick={onClose} className="btn-ghost p-2 rounded-full"><FiX size={20}/></button></div>
          <form onSubmit={save} className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div><label className="label">Product Name *</label><input value={form.name} onChange={e=>set("name",e.target.value)} className="input" required/></div>
                <div><label className="label">Brand</label><input value={form.brand} onChange={e=>set("brand",e.target.value)} className="input"/></div>
                <div><label className="label">Category *</label><select value={form.category} onChange={e=>set("category",e.target.value)} className="input" required><option value="">Select category</option>{categories.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-4"><div><label className="label">Price (₹) *</label><input type="number" value={form.price} onChange={e=>set("price",e.target.value)} className="input" required min={0}/></div><div><label className="label">Discount Price</label><input type="number" value={form.discountPrice} onChange={e=>set("discountPrice",e.target.value)} className="input" min={0}/></div></div>
                <div><label className="label">Gender</label><select value={form.gender} onChange={e=>set("gender",e.target.value)} className="input">{["men","women","unisex","kids"].map(g=><option key={g} value={g}>{g}</option>)}</select></div>
                <div><label className="label">Description *</label><textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={4} className="input resize-none" required/></div>
              </div>
              <div className="space-y-4">
                <div><label className="label">Images</label><div className="flex flex-wrap gap-2 mb-2">{previews.map((p,i)=><div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden bg-dark-600 group"><img src={p.url} alt="" className="w-full h-full object-cover"/><button type="button" onClick={()=>removePreview(i)} className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-fire"><FiTrash2 size={16}/></button></div>)}<button type="button" onClick={()=>fileRef.current?.click()} className="w-20 h-20 rounded-xl border-2 border-dashed border-white/15 hover:border-acid/50 flex flex-col items-center justify-center gap-1 text-white/30 hover:text-acid transition-all"><FiPlus size={20}/><span className="text-[10px]">Add</span></button></div><input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={pickFiles}/></div>
                <div><label className="label">Colors (name:hex per line)</label><textarea value={form.colors} onChange={e=>set("colors",e.target.value)} rows={3} className="input resize-none font-mono text-xs" placeholder={"Midnight Black:#1a1a1a"}/></div>
                <div><label className="label">Sizes & Stock (UK size:qty per line)</label><textarea value={form.sizes} onChange={e=>set("sizes",e.target.value)} rows={4} className="input resize-none font-mono text-xs" placeholder={"UK 7:10\nUK 8:15"}/></div>
                <div><label className="label">Tags (comma separated)</label><input value={form.tags} onChange={e=>set("tags",e.target.value)} className="input" placeholder="running, lightweight"/></div>
                <div><label className="label">Features (one per line)</label><textarea value={form.features} onChange={e=>set("features",e.target.value)} rows={3} className="input resize-none"/></div>
                <div className="grid grid-cols-2 gap-2">{[["isFeatured","Featured"],["isNew","New Arrival"],["isBestSeller","Best Seller"],["isActive","Active"]].map(([k,l])=><label key={k} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!form[k]} onChange={e=>set(k,e.target.checked)} className="accent-acid"/><span className="text-sm text-white/70">{l}</span></label>)}</div>
              </div>
            </div>
            <div className="flex gap-3 pt-2 border-t border-white/8"><button type="button" onClick={onClose} className="btn-ghost px-6 py-3">Cancel</button><button type="submit" disabled={saving} className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">{saving?<><span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin"/> Saving…</>:<><FiCheck size={16}/> {product?"Update":"Create"} Product</>}</button></div>
          </form>
        </motion.div>
      </div>
    </motion.div>
  )
}

export default function AdminProducts() {
  const [products,setProducts]=useState([]), [categories,setCategories]=useState([]), [loading,setLoading]=useState(true)
  const [search,setSearch]=useState(""), [editProduct,setEditProduct]=useState(null), [showForm,setShowForm]=useState(false), [deleting,setDeleting]=useState(null)
  const [pagination,setPagination]=useState({}), [page,setPage]=useState(1)
  const fetchData = async () => {
    setLoading(true)
    try { const [pRes,cRes]=await Promise.all([productAPI.getAll({page,limit:12,keyword:search||undefined}),adminAPI.getCategories()]); setProducts(pRes.data.products||[]); setPagination(pRes.data.pagination||{}); setCategories(cRes.data.categories||[]) } catch {} finally { setLoading(false) }
  }
  useEffect(()=>{ fetchData() },[page,search])
  const handleDelete = async id => { if (!window.confirm("Delete this product?")) return; setDeleting(id); try { await productAPI.delete(id); toast.success("Deleted"); fetchData() } catch(e) { toast.error(e.response?.data?.message||"Delete failed") } finally { setDeleting(null) } }
  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center justify-between flex-wrap gap-4"><div><h1 className="font-display text-3xl tracking-wider">Products</h1><p className="text-white/40 text-sm">{pagination.total||0} total</p></div><button onClick={()=>{setEditProduct(null);setShowForm(true)}} className="btn-primary flex items-center gap-2 py-2.5 px-5"><FiPlus size={16}/> Add Product</button></div>
      <div className="relative max-w-sm"><FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} className="input pl-10 py-2.5 text-sm" placeholder="Search products…"/></div>
      {loading ? <Loading/> : (
        <>
          <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full">
            <thead><tr className="border-b border-white/8">{["Product","Category","Price","Stock","Status",""].map(h=><th key={h} className="text-left px-5 py-3.5 text-xs font-medium tracking-wider uppercase text-white/40">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-white/5">{products.map(p=>(
              <tr key={p._id} className="hover:bg-white/2 transition-colors">
                <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-xl overflow-hidden bg-dark-600 shrink-0"><img src={p.images?.[0]?.url} alt="" className="w-full h-full object-cover" onError={e=>{e.target.style.display="none"}}/></div><div><p className="font-medium text-sm line-clamp-1">{p.name}</p><p className="text-white/30 text-xs">{p.brand}</p></div></div></td>
                <td className="px-5 py-4 text-sm text-white/50">{p.category?.name||"—"}</td>
                <td className="px-5 py-4"><p className="text-sm font-semibold text-acid">₹{(p.discountPrice||p.price)?.toLocaleString()}</p>{p.discountPrice&&<p className="text-xs text-white/30 line-through">₹{p.price?.toLocaleString()}</p>}</td>
                <td className="px-5 py-4"><span className={`text-sm font-medium ${p.totalStock===0?"text-fire":p.totalStock<=5?"text-yellow-400":"text-acid"}`}>{p.totalStock===0?"Out":p.totalStock}</span>{p.totalStock===0&&<FiAlertTriangle size={12} className="inline ml-1 text-fire"/>}</td>
                <td className="px-5 py-4"><div className="flex flex-wrap gap-1">{p.isNew&&<span className="badge-acid text-[10px]">New</span>}{p.isFeatured&&<span className="badge bg-blue-500/15 text-blue-400 border border-blue-500/20 text-[10px]">Featured</span>}{!p.isActive&&<span className="badge bg-fire/15 text-fire border border-fire/20 text-[10px]">Inactive</span>}</div></td>
                <td className="px-5 py-4"><div className="flex items-center gap-2"><button onClick={()=>{setEditProduct(p);setShowForm(true)}} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-acid/10 hover:text-acid flex items-center justify-center transition-colors"><FiEdit2 size={13}/></button><button onClick={()=>handleDelete(p._id)} disabled={deleting===p._id} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-fire/10 hover:text-fire flex items-center justify-center transition-colors">{deleting===p._id?<span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"/>:<FiTrash2 size={13}/>}</button></div></td>
              </tr>
            ))}</tbody>
          </table>{products.length===0&&<div className="text-center py-16 text-white/30"><p>No products found</p></div>}</div></div>
          {pagination.pages>1 && <div className="flex items-center justify-center gap-2"><button disabled={!pagination.hasPrev} onClick={()=>setPage(p=>p-1)} className="btn-outline px-4 py-2 text-sm disabled:opacity-30">← Prev</button><span className="text-white/40 text-sm">Page {page} of {pagination.pages}</span><button disabled={!pagination.hasNext} onClick={()=>setPage(p=>p+1)} className="btn-outline px-4 py-2 text-sm disabled:opacity-30">Next →</button></div>}
        </>
      )}
      <AnimatePresence>{showForm&&<ProductForm product={editProduct} categories={categories} onSave={()=>{setShowForm(false);setEditProduct(null);fetchData()}} onClose={()=>setShowForm(false)}/>}</AnimatePresence>
    </div>
  )
}
