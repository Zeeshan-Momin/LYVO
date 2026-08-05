import axios from "axios"
const API = axios.create({ baseURL:"/api", withCredentials:true })
API.interceptors.request.use(cfg => { const t=localStorage.getItem("lyvo_token"); if(t) cfg.headers.Authorization=`Bearer ${t}`; return cfg })
API.interceptors.response.use(r=>r, async err => {
  const orig=err.config
  if (err.response?.status===401 && !orig._retry) {
    orig._retry=true
    try {
      const refresh=localStorage.getItem("lyvo_refresh")
      if (refresh) {
        const { data }=await axios.post("/api/auth/refresh",{ refreshToken:refresh })
        localStorage.setItem("lyvo_token",data.token); localStorage.setItem("lyvo_refresh",data.refreshToken)
        orig.headers.Authorization=`Bearer ${data.token}`
        return API(orig)
      }
    } catch { localStorage.removeItem("lyvo_token"); localStorage.removeItem("lyvo_refresh"); window.location.href="/login" }
  }
  return Promise.reject(err)
})
export const authAPI = {
  register:d=>API.post("/auth/register",d), login:d=>API.post("/auth/login",d), logout:()=>API.post("/auth/logout"),
  getMe:()=>API.get("/auth/me"), updateProfile:d=>API.put("/auth/profile",d), changePassword:d=>API.put("/auth/change-password",d),
  addAddress:d=>API.post("/auth/address",d), deleteAddress:id=>API.delete(`/auth/address/${id}`), toggleWishlist:id=>API.post(`/auth/wishlist/${id}`),
}
export const productAPI = {
  getAll:p=>API.get("/products",{params:p}), getOne:id=>API.get(`/products/${id}`), getFeatured:()=>API.get("/products/featured"),
  getRelated:id=>API.get(`/products/${id}/related`), search:p=>API.get("/products/search",{params:p}),
  getCategories:()=>API.get("/products/categories"),
  create:d=>API.post("/products",d,{headers:{"Content-Type":"multipart/form-data"}}),
  update:(id,d)=>API.put(`/products/${id}`,d,{headers:{"Content-Type":"multipart/form-data"}}),
  delete:id=>API.delete(`/products/${id}`), deleteImage:(id,d)=>API.delete(`/products/${id}/image`,{data:d}), updateStock:(id,d)=>API.patch(`/products/${id}/stock`,d),
}
export const orderAPI = {
  place:d=>API.post("/orders",d), getMyOrders:p=>API.get("/orders/my",{params:p}), getOne:id=>API.get(`/orders/${id}`),
  cancel:(id,d)=>API.patch(`/orders/${id}/cancel`,d), getAll:p=>API.get("/orders/admin/all",{params:p}),
  updateStatus:(id,d)=>API.patch(`/orders/admin/${id}/status`,d), getAnalytics:p=>API.get("/orders/analytics",{params:p}),
  requestReturn:(id,d)=>API.patch(`/orders/${id}/return`,d), updateReturnStatus:(id,d)=>API.patch(`/orders/admin/${id}/return-status`,d),
}
export const paymentAPI = {
  createOrder:d=>API.post("/payment/create-order",d),
}
export const analyticsAPI = {
  recordVisit:()=>API.post("/analytics/visit"), getStats:()=>API.get("/analytics/stats"),
}
export const reviewAPI = {
  getAll:(pid,p)=>API.get(`/reviews/${pid}`,{params:p}), create:(pid,d)=>API.post(`/reviews/${pid}`,d),
  update:(id,d)=>API.put(`/reviews/${id}/edit`,d), delete:id=>API.delete(`/reviews/${id}`), helpful:id=>API.patch(`/reviews/${id}/helpful`),
}
export const adminAPI = {
  getDashboard:()=>API.get("/admin/dashboard"), getSalesAnalytics:p=>API.get("/admin/analytics/sales",{params:p}),
  getUsers:p=>API.get("/admin/users",{params:p}), getUser:id=>API.get(`/admin/users/${id}`), updateUser:(id,d)=>API.patch(`/admin/users/${id}`,d), deleteUser:id=>API.delete(`/admin/users/${id}`),
  getCategories:()=>API.get("/admin/categories"), createCategory:d=>API.post("/admin/categories",d), updateCategory:(id,d)=>API.put(`/admin/categories/${id}`,d), deleteCategory:id=>API.delete(`/admin/categories/${id}`),
  getCoupons:()=>API.get("/admin/coupons"), createCoupon:d=>API.post("/admin/coupons",d), updateCoupon:(id,d)=>API.put(`/admin/coupons/${id}`,d), deleteCoupon:id=>API.delete(`/admin/coupons/${id}`),
  validateCoupon:d=>API.post("/coupons/validate",d),
}
export default API
