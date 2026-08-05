export const formatPrice = (n) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n)
export const truncate = (s,n=60) => s?.length>n ? s.slice(0,n)+"…" : s
export const capitalize = (s) => s ? s[0].toUpperCase()+s.slice(1) : ""
export const formatDate = (d) => new Date(d).toLocaleDateString("en-IN",{dateStyle:"medium"})
export const debounce = (fn,delay=300) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),delay) } }
export const storage = {
  get:(k,fb=null)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):fb }catch{ return fb } },
  set:(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)) }catch{} },
  remove:(k)=>{ try{ localStorage.removeItem(k) }catch{} },
}
