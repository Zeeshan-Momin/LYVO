import { useState } from "react"
import { useAuth } from "../context/AuthContext"
import { authAPI } from "../api"
import { FiUser, FiLock, FiMapPin, FiPlus, FiTrash2, FiCheck } from "react-icons/fi"
import toast from "react-hot-toast"

export default function Profile() {
  const { user, fetchMe } = useAuth()
  const [tab,setTab]=useState("profile")
  const [form,setForm]=useState({name:user?.name||"",phone:user?.phone||""})
  const [pwForm,setPwForm]=useState({currentPassword:"",newPassword:""})
  const [saving,setSaving]=useState(false)
  const [addrForm,setAddrForm]=useState({fullName:"",phone:"",address:"",city:"",state:"",zipCode:"",country:"India",isDefault:false})
  const [addingAddr,setAddingAddr]=useState(false)

  const saveProfile = async (e) => { e.preventDefault(); setSaving(true); try { await authAPI.updateProfile(form); await fetchMe(); toast.success("Profile updated!") } catch(e) { toast.error(e.response?.data?.message||"Failed") } finally { setSaving(false) } }
  const changePw = async (e) => { e.preventDefault(); if (pwForm.newPassword.length<6) { toast.error("Password min 6 chars"); return }; setSaving(true); try { await authAPI.changePassword(pwForm); setPwForm({currentPassword:"",newPassword:""}); toast.success("Password changed!") } catch(e) { toast.error(e.response?.data?.message||"Failed") } finally { setSaving(false) } }
  const addAddress = async (e) => { e.preventDefault(); setAddingAddr(true); try { await authAPI.addAddress(addrForm); await fetchMe(); setAddrForm({fullName:"",phone:"",address:"",city:"",state:"",zipCode:"",country:"India",isDefault:false}); toast.success("Address added!") } catch(e) { toast.error(e.response?.data?.message||"Failed") } finally { setAddingAddr(false) } }
  const delAddress = async (id) => { try { await authAPI.deleteAddress(id); await fetchMe(); toast.success("Address removed") } catch { toast.error("Failed") } }

  return (
    <div className="page-top min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center gap-5 mb-10"><div className="w-16 h-16 rounded-2xl bg-acid/20 border border-acid/30 flex items-center justify-center font-display text-acid text-3xl">{user?.name?.[0]?.toUpperCase()}</div><div><h1 className="font-display text-3xl tracking-wider">{user?.name}</h1><p className="text-white/40 text-sm">{user?.email}</p></div></div>
        <div className="flex gap-2 mb-8 border-b border-white/8 pb-1">{[["profile","Profile"],["security","Security"],["address","Addresses"]].map(([id,l])=><button key={id} onClick={()=>setTab(id)} className={`pb-3 px-4 text-sm font-medium transition-all border-b-2 -mb-px ${tab===id?"border-acid text-acid":"border-transparent text-white/40 hover:text-white"}`}>{l}</button>)}</div>
        {tab==="profile" && (
          <form onSubmit={saveProfile} className="card p-6 space-y-5 max-w-lg">
            <h2 className="font-semibold text-lg flex items-center gap-2"><FiUser className="text-acid" size={18}/> Personal Info</h2>
            <div><label className="label">Full Name</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="input"/></div>
            <div><label className="label">Email</label><input value={user?.email} disabled className="input opacity-50 cursor-not-allowed"/></div>
            <div><label className="label">Phone</label><input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} className="input" placeholder="+91 98765 43210"/></div>
            <button type="submit" disabled={saving} className="btn-primary py-3 flex items-center gap-2">{saving?"Saving…":<><FiCheck size={15}/> Save Changes</>}</button>
          </form>
        )}
        {tab==="security" && (
          <form onSubmit={changePw} className="card p-6 space-y-5 max-w-lg">
            <h2 className="font-semibold text-lg flex items-center gap-2"><FiLock className="text-acid" size={18}/> Change Password</h2>
            <div><label className="label">Current Password</label><input type="password" value={pwForm.currentPassword} onChange={e=>setPwForm(p=>({...p,currentPassword:e.target.value}))} className="input" placeholder="••••••••"/></div>
            <div><label className="label">New Password</label><input type="password" value={pwForm.newPassword} onChange={e=>setPwForm(p=>({...p,newPassword:e.target.value}))} className="input" placeholder="Min. 6 characters"/></div>
            <button type="submit" disabled={saving} className="btn-primary py-3">{saving?"Updating…":"Update Password"}</button>
          </form>
        )}
        {tab==="address" && (
          <div className="space-y-4">
            {user?.addresses?.map(a => (
              <div key={a._id} className="card p-5 flex items-start justify-between gap-4">
                <div><div className="flex items-center gap-2 mb-1"><FiMapPin size={14} className="text-acid"/><p className="font-medium">{a.fullName}</p>{a.isDefault && <span className="badge-acid text-[10px]">Default</span>}</div><p className="text-white/50 text-sm">{a.phone}</p><p className="text-white/50 text-sm">{a.address}, {a.city}, {a.state} {a.zipCode}</p></div>
                <button onClick={()=>delAddress(a._id)} className="text-white/20 hover:text-fire transition-colors shrink-0"><FiTrash2 size={16}/></button>
              </div>
            ))}
            <form onSubmit={addAddress} className="card p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><FiPlus size={16} className="text-acid"/> Add New Address</h3>
              <div className="grid grid-cols-2 gap-4">{[["fullName","Full Name","col-span-1"],["phone","Phone","col-span-1"],["address","Address","col-span-2"],["city","City","col-span-1"],["state","State","col-span-1"],["zipCode","PIN","col-span-1"],["country","Country","col-span-1"]].map(([k,l,col]) => <div key={k} className={col}><label className="label">{l}</label><input value={addrForm[k]} onChange={e=>setAddrForm(p=>({...p,[k]:e.target.value}))} className="input" required={k!=="country"}/></div>)}</div>
              <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" checked={addrForm.isDefault} onChange={e=>setAddrForm(p=>({...p,isDefault:e.target.checked}))} className="accent-acid"/><span className="text-sm text-white/60">Set as default</span></label>
              <button type="submit" disabled={addingAddr} className="btn-primary py-3">{addingAddr?"Adding…":"Add Address"}</button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
