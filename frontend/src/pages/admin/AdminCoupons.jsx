import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FiPlus, FiTrash2, FiCheck } from "react-icons/fi"
import { adminAPI } from "../../api"
import Loading from "../../components/common/Loading"
import toast from "react-hot-toast"

export default function AdminCoupons() {
  const [coupons,setCoupons]=useState([]), [loading,setLoading]=useState(true), [showForm,setShowForm]=useState(false)
  const [form,setForm]=useState({code:"",type:"percentage",value:"",minPurchase:"",maxDiscount:"",usageLimit:"",expiryDate:"",description:"",isActive:true}), [saving,setSaving]=useState(false)
  const set = (k,v) => setForm(p=>({...p,[k]:v}))
  const fetch = () => { adminAPI.getCoupons().then(({data})=>setCoupons(data.coupons||[])).catch(()=>{}).finally(()=>setLoading(false)) }
  useEffect(()=>{ fetch() },[])
  const save = async e => {
    e.preventDefault()
    if (!form.code||!form.value||!form.expiryDate) { toast.error("Code, value and expiry required"); return }
    setSaving(true)
    try { await adminAPI.createCoupon({...form,code:form.code.toUpperCase(),value:+form.value,minPurchase:+form.minPurchase||0,maxDiscount:+form.maxDiscount||0,usageLimit:+form.usageLimit||0}); toast.success("Coupon created"); setForm({code:"",type:"percentage",value:"",minPurchase:"",maxDiscount:"",usageLimit:"",expiryDate:"",description:"",isActive:true}); setShowForm(false); fetch() }
    catch(e) { toast.error(e.response?.data?.message||"Failed") } finally { setSaving(false) }
  }
  const del = async id => { if (!window.confirm("Delete coupon?")) return; try { await adminAPI.deleteCoupon(id); toast.success("Deleted"); fetch() } catch { toast.error("Delete failed") } }
  const toggle = async c => { try { await adminAPI.updateCoupon(c._id,{isActive:!c.isActive}); fetch() } catch { toast.error("Update failed") } }
  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center justify-between"><h1 className="font-display text-3xl tracking-wider">Coupons</h1><button onClick={()=>setShowForm(p=>!p)} className="btn-primary flex items-center gap-2 py-2.5 px-5"><FiPlus size={16}/> Add Coupon</button></div>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}}>
            <form onSubmit={save} className="card p-6 grid md:grid-cols-3 gap-4">
              <div><label className="label">Code *</label><input value={form.code} onChange={e=>set("code",e.target.value.toUpperCase())} className="input font-mono uppercase" placeholder="LYVO10" required/></div>
              <div><label className="label">Type</label><select value={form.type} onChange={e=>set("type",e.target.value)} className="input"><option value="percentage">Percentage (%)</option><option value="fixed">Fixed (₹)</option></select></div>
              <div><label className="label">Value *</label><input type="number" value={form.value} onChange={e=>set("value",e.target.value)} className="input" placeholder={form.type==="percentage"?"10":"500"} required/></div>
              <div><label className="label">Min Purchase (₹)</label><input type="number" value={form.minPurchase} onChange={e=>set("minPurchase",e.target.value)} className="input" placeholder="999"/></div>
              <div><label className="label">Max Discount (₹)</label><input type="number" value={form.maxDiscount} onChange={e=>set("maxDiscount",e.target.value)} className="input" placeholder="500"/></div>
              <div><label className="label">Usage Limit</label><input type="number" value={form.usageLimit} onChange={e=>set("usageLimit",e.target.value)} className="input" placeholder="0 = unlimited"/></div>
              <div><label className="label">Expiry Date *</label><input type="date" value={form.expiryDate} onChange={e=>set("expiryDate",e.target.value)} className="input" required/></div>
              <div className="md:col-span-2"><label className="label">Description</label><input value={form.description} onChange={e=>set("description",e.target.value)} className="input" placeholder="10% off on all orders"/></div>
              <div className="md:col-span-3 flex gap-3"><button type="button" onClick={()=>setShowForm(false)} className="btn-ghost px-5 py-3">Cancel</button><button type="submit" disabled={saving} className="btn-primary px-8 py-3 flex items-center gap-2">{saving?<span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin"/>:<><FiCheck size={15}/> Create Coupon</>}</button></div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
      {loading?<Loading/>:(
        <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full">
          <thead><tr className="border-b border-white/8">{["Code","Type","Value","Min","Used/Limit","Expires","Active",""].map(h=><th key={h} className="text-left px-5 py-3.5 text-xs font-medium tracking-wider uppercase text-white/40">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-white/5">{coupons.map(c=>{
            const expired=new Date()>new Date(c.expiryDate)
            return (
              <tr key={c._id} className="hover:bg-white/2 transition-colors">
                <td className="px-5 py-4"><span className="font-mono text-sm text-acid font-semibold">{c.code}</span></td>
                <td className="px-5 py-4 text-sm capitalize text-white/60">{c.type}</td>
                <td className="px-5 py-4 text-sm font-semibold">{c.type==="percentage"?`${c.value}%`:`₹${c.value}`}</td>
                <td className="px-5 py-4 text-sm text-white/50">₹{c.minPurchase||0}</td>
                <td className="px-5 py-4 text-sm text-white/50">{c.usedCount||0}/{c.usageLimit||"∞"}</td>
                <td className="px-5 py-4"><span className={`text-xs font-medium ${expired?"text-fire":"text-white/50"}`}>{new Date(c.expiryDate).toLocaleDateString()}{expired?" (Expired)":""}</span></td>
                <td className="px-5 py-4"><button onClick={()=>toggle(c)} className={`w-10 h-6 rounded-full transition-all relative ${c.isActive?"bg-acid":"bg-dark-600"}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${c.isActive?"left-5":"left-1"}`}/></button></td>
                <td className="px-5 py-4"><button onClick={()=>del(c._id)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-fire/10 hover:text-fire flex items-center justify-center transition-colors"><FiTrash2 size={13}/></button></td>
              </tr>
            )
          })}</tbody>
        </table>{coupons.length===0&&<div className="text-center py-12 text-white/25 text-sm">No coupons yet</div>}</div></div>
      )}
    </div>
  )
}
