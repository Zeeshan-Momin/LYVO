import { useState, useEffect } from "react"
import { FiEdit2, FiTrash2, FiCheck, FiPlus } from "react-icons/fi"
import { adminAPI } from "../../api"
import Loading from "../../components/common/Loading"
import toast from "react-hot-toast"

export default function AdminCategories() {
  const [cats,setCats]=useState([]), [loading,setLoading]=useState(true), [form,setForm]=useState({name:"",description:"",icon:""}), [editing,setEditing]=useState(null), [saving,setSaving]=useState(false)
  const fetch = () => { adminAPI.getCategories().then(({data})=>setCats(data.categories||[])).catch(()=>{}).finally(()=>setLoading(false)) }
  useEffect(()=>{ fetch() },[])
  const save = async e => { e.preventDefault(); if (!form.name.trim()) { toast.error("Name required"); return }; setSaving(true); try { if(editing) await adminAPI.updateCategory(editing,form); else await adminAPI.createCategory(form); toast.success(editing?"Updated":"Created"); setForm({name:"",description:"",icon:""}); setEditing(null); fetch() } catch(e) { toast.error(e.response?.data?.message||"Failed") } finally { setSaving(false) } }
  const del = async id => { if (!window.confirm("Delete this category?")) return; try { await adminAPI.deleteCategory(id); toast.success("Deleted"); fetch() } catch(e) { toast.error(e.response?.data?.message||"Cannot delete — products exist") } }
  const startEdit = c => { setEditing(c._id); setForm({name:c.name,description:c.description||"",icon:c.icon||""}) }
  return (
    <div className="space-y-5 pb-6">
      <h1 className="font-display text-3xl tracking-wider">Categories</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-semibold mb-5">{editing?"Edit Category":"Add Category"}</h2>
          <form onSubmit={save} className="space-y-4">
            <div><label className="label">Name *</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="input" placeholder="Running" required/></div>
            <div><label className="label">Icon (emoji)</label><input value={form.icon} onChange={e=>setForm(p=>({...p,icon:e.target.value}))} className="input" placeholder="🏃"/></div>
            <div><label className="label">Description</label><textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} rows={3} className="input resize-none"/></div>
            <div className="flex gap-3">{editing&&<button type="button" onClick={()=>{setEditing(null);setForm({name:"",description:"",icon:""})}} className="btn-ghost px-4 py-3">Cancel</button>}<button type="submit" disabled={saving} className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">{saving?<span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin"/>:<><FiCheck size={15}/>{editing?"Update":"Create"}</>}</button></div>
          </form>
        </div>
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/8 font-semibold text-sm">All Categories ({cats.length})</div>
          {loading?<Loading size="sm"/>:(
            <div className="divide-y divide-white/5">{cats.map(c=>(
              <div key={c._id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/2 transition-colors">
                <span className="text-2xl w-9 shrink-0">{c.icon||"📦"}</span>
                <div className="flex-1 min-w-0"><p className="font-medium text-sm">{c.name}</p>{c.description&&<p className="text-white/30 text-xs line-clamp-1">{c.description}</p>}</div>
                <div className="flex items-center gap-1.5 shrink-0"><button onClick={()=>startEdit(c)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-acid/10 hover:text-acid flex items-center justify-center transition-colors"><FiEdit2 size={12}/></button><button onClick={()=>del(c._id)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-fire/10 hover:text-fire flex items-center justify-center transition-colors"><FiTrash2 size={12}/></button></div>
              </div>
            ))}{cats.length===0&&<div className="text-center py-10 text-white/25 text-sm">No categories yet</div>}</div>
          )}
        </div>
      </div>
    </div>
  )
}
