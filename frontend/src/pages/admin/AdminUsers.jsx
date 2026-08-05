import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FiSearch, FiEdit2, FiTrash2, FiX, FiCheck, FiUser, FiShield } from "react-icons/fi"
import { adminAPI } from "../../api"
import Loading from "../../components/common/Loading"
import toast from "react-hot-toast"

function UserModal({ user, onClose, onUpdate }) {
  const [form,setForm]=useState({name:user.name,email:user.email,role:user.role,isActive:user.isActive}), [saving,setSaving]=useState(false)
  const save = async () => { setSaving(true); try { await adminAPI.updateUser(user._id,form); toast.success("Updated"); onUpdate(); onClose() } catch(e) { toast.error(e.response?.data?.message||"Failed") } finally { setSaving(false) } }
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{scale:.95}} animate={{scale:1}} className="bg-dark-800 border border-white/10 rounded-3xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6"><h2 className="font-semibold text-lg">Edit User</h2><button onClick={onClose} className="btn-ghost p-2 rounded-full"><FiX size={20}/></button></div>
        <div className="space-y-4">
          <div><label className="label">Name</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="input"/></div>
          <div><label className="label">Email</label><input value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} className="input"/></div>
          <div><label className="label">Role</label><select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} className="input"><option value="user">User</option><option value="admin">Admin</option></select></div>
          <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" checked={form.isActive} onChange={e=>setForm(p=>({...p,isActive:e.target.checked}))} className="accent-acid"/><span className="text-sm">Account Active</span></label>
        </div>
        <div className="flex gap-3 mt-6"><button onClick={onClose} className="btn-ghost px-5 py-3">Cancel</button><button onClick={save} disabled={saving} className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">{saving?<span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin"/>:<><FiCheck size={15}/> Save</>}</button></div>
      </motion.div>
    </motion.div>
  )
}

export default function AdminUsers() {
  const [users,setUsers]=useState([]), [loading,setLoading]=useState(true), [search,setSearch]=useState(""), [roleFilter,setRoleFilter]=useState("")
  const [page,setPage]=useState(1), [pagination,setPagination]=useState({}), [editing,setEditing]=useState(null), [deleting,setDeleting]=useState(null)
  const fetch = async () => { setLoading(true); try { const{data}=await adminAPI.getUsers({page,limit:15,search:search||undefined,role:roleFilter||undefined}); setUsers(data.users||[]); setPagination(data.pagination||{}) } catch {} finally { setLoading(false) } }
  useEffect(()=>{ fetch() },[page,search,roleFilter])
  const handleDelete = async (id,name) => { if (!window.confirm(`Delete user "${name}"?`)) return; setDeleting(id); try { await adminAPI.deleteUser(id); toast.success("Deleted"); fetch() } catch(e) { toast.error(e.response?.data?.message||"Cannot delete") } finally { setDeleting(null) } }
  return (
    <div className="space-y-5 pb-6">
      <div><h1 className="font-display text-3xl tracking-wider">Users</h1><p className="text-white/40 text-sm">{pagination.total||0} registered</p></div>
      <div className="flex flex-wrap gap-3"><div className="relative flex-1 min-w-48"><FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} className="input pl-10 py-2.5 text-sm w-full" placeholder="Search name or email…"/></div><div className="flex gap-2">{[["","All"],["user","Users"],["admin","Admins"]].map(([r,l])=><button key={r} onClick={()=>setRoleFilter(r)} className={`px-4 py-2.5 rounded-xl text-xs font-medium border transition-all ${roleFilter===r?"bg-acid/15 text-acid border-acid/25":"border-white/10 text-white/40 hover:border-white/25 hover:text-white"}`}>{l}</button>)}</div></div>
      {loading ? <Loading/> : (
        <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full">
          <thead><tr className="border-b border-white/8">{["User","Email","Role","Status","Joined",""].map(h=><th key={h} className="text-left px-5 py-3.5 text-xs font-medium tracking-wider uppercase text-white/40">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-white/5">{users.map(u=>(
            <tr key={u._id} className="hover:bg-white/2 transition-colors">
              <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-acid/20 flex items-center justify-center text-acid font-bold text-sm shrink-0">{u.name?.[0]?.toUpperCase()}</div><p className="font-medium text-sm">{u.name}</p></div></td>
              <td className="px-5 py-4 text-white/50 text-sm">{u.email}</td>
              <td className="px-5 py-4"><span className={`badge border capitalize ${u.role==="admin"?"bg-acid/15 text-acid border-acid/25":"bg-white/5 text-white/50 border-white/10"}`}>{u.role==="admin"?<><FiShield size={10}/> Admin</>:<><FiUser size={10}/> User</>}</span></td>
              <td className="px-5 py-4"><span className={`text-xs font-medium ${u.isActive?"text-acid":"text-fire"}`}>{u.isActive?"● Active":"● Inactive"}</span></td>
              <td className="px-5 py-4 text-white/30 text-xs">{new Date(u.createdAt).toLocaleDateString("en-IN")}</td>
              <td className="px-5 py-4"><div className="flex items-center gap-2"><button onClick={()=>setEditing(u)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-acid/10 hover:text-acid flex items-center justify-center transition-colors"><FiEdit2 size={13}/></button>{u.role!=="admin"&&<button onClick={()=>handleDelete(u._id,u.name)} disabled={deleting===u._id} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-fire/10 hover:text-fire flex items-center justify-center transition-colors">{deleting===u._id?<span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"/>:<FiTrash2 size={13}/>}</button>}</div></td>
            </tr>
          ))}</tbody>
        </table>{users.length===0&&<div className="text-center py-16 text-white/30"><FiUser size={36} className="mx-auto mb-3"/><p>No users found</p></div>}</div></div>
      )}
      {pagination.pages>1 && <div className="flex items-center justify-center gap-2"><button disabled={!pagination.hasPrev} onClick={()=>setPage(p=>p-1)} className="btn-outline px-4 py-2 text-sm disabled:opacity-30">← Prev</button><span className="text-white/40 text-sm">Page {page} of {pagination.pages}</span><button disabled={!pagination.hasNext} onClick={()=>setPage(p=>p+1)} className="btn-outline px-4 py-2 text-sm disabled:opacity-30">Next →</button></div>}
      <AnimatePresence>{editing&&<UserModal user={editing} onClose={()=>setEditing(null)} onUpdate={fetch}/>}</AnimatePresence>
    </div>
  )
}
