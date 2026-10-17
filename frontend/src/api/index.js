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
  register:d=>API.post("/auth/register",d), login:d=>API.post("/auth/login",d), loginGoogle:d=>API.post("/auth/google",d), logout:()=>API.post("/auth/logout"),
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
  getDashboard:()=>API.get("/admin/dashboard"),
  getSalesAnalytics:p=>API.get("/admin/analytics/sales",{params:p}),
  getOverview:p=>API.get("/admin/analytics/overview",{params:p}),
  getDetailedSales:p=>API.get("/admin/analytics/sales-deep",{params:p}),
  getCustomersAnalytics:p=>API.get("/admin/analytics/customers",{params:p}),
  getCustomerProfile:id=>API.get(`/admin/analytics/customers/${id}`),
  getDataQuality:()=>API.get("/admin/analytics/data-quality"),
  getProductAnalytics:p=>API.get("/admin/analytics/products",{params:p}),
  getSizeColorAnalytics:p=>API.get("/admin/analytics/sizes-colors",{params:p}),
  getInventoryAnalytics:p=>API.get("/admin/analytics/inventory",{params:p}),
  getGeographyAnalytics:p=>API.get("/admin/analytics/geography",{params:p}),
  getPaymentAnalytics:p=>API.get("/admin/analytics/payments",{params:p}),
  getShippingAnalytics:p=>API.get("/admin/analytics/shipping",{params:p}),
  getReturnsAnalytics:p=>API.get("/admin/analytics/returns",{params:p}),
  getUsers:p=>API.get("/admin/users",{params:p}), getUser:id=>API.get(`/admin/users/${id}`), updateUser:(id,d)=>API.patch(`/admin/users/${id}`,d), deleteUser:id=>API.delete(`/admin/users/${id}`),
  getCategories:()=>API.get("/admin/categories"), createCategory:d=>API.post("/admin/categories",d), updateCategory:(id,d)=>API.put(`/admin/categories/${id}`,d), deleteCategory:id=>API.delete(`/admin/categories/${id}`),
  getCoupons:()=>API.get("/admin/coupons"), createCoupon:d=>API.post("/admin/coupons",d), updateCoupon:(id,d)=>API.put(`/admin/coupons/${id}`,d), deleteCoupon:id=>API.delete(`/admin/coupons/${id}`),
  validateCoupon:d=>API.post("/coupons/validate",d),
  getFinanceOverview:p=>API.get("/admin/finance/overview",{params:p}),
  getManagementPnL:p=>API.get("/admin/finance/pnl",{params:p}),
  getFinancialReconciliation:()=>API.get("/admin/finance/reconciliation/summary"),
  getExpenses:p=>API.get("/admin/finance/expenses",{params:p}),
  createExpense:d=>API.post("/admin/finance/expenses",d),
  cancelExpense:id=>API.delete(`/admin/finance/expenses/${id}`),
  getStockInwards:p=>API.get("/admin/finance/procurement/inward",{params:p}),
  recordStockInward:d=>API.post("/admin/finance/procurement/inward",d),
  getRazorpaySettlements:p=>API.get("/admin/finance/reconciliation/razorpay",{params:p}),
  importRazorpaySettlement:d=>API.post("/admin/finance/reconciliation/razorpay/import",d),
  getCourierInvoices:p=>API.get("/admin/finance/reconciliation/delhivery",{params:p}),
  importCourierInvoice:d=>API.post("/admin/finance/reconciliation/delhivery/import",d),
}
export const financeAPI = {
  getOverview: p => API.get("/admin/finance/overview", { params: p }),
  getPnL: p => API.get("/admin/finance/pnl", { params: p }),
  getReconciliationSummary: () => API.get("/admin/finance/reconciliation/summary"),
  getExpenses: p => API.get("/admin/finance/expenses", { params: p }),
  getExpenseSummary: p => API.get("/admin/finance/expenses/summary", { params: p }),
  createExpense: d => API.post("/admin/finance/expenses", d),
  cancelExpense: id => API.delete(`/admin/finance/expenses/${id}`),
  getStockInwards: p => API.get("/admin/finance/procurement/inward", { params: p }),
  recordStockInward: d => API.post("/admin/finance/procurement/inward", d),
  getRazorpaySettlements: p => API.get("/admin/finance/reconciliation/razorpay", { params: p }),
  importRazorpaySettlement: d => API.post("/admin/finance/reconciliation/razorpay/import", d),
  getCourierInvoices: p => API.get("/admin/finance/reconciliation/delhivery", { params: p }),
  importCourierInvoice: d => API.post("/admin/finance/reconciliation/delhivery/import", d),
  // Phase 3D-5 Report Builder & Export APIs
  executeReport: d => API.post("/admin/finance/reports/execute", d),
  executeSavedReport: (id, p) => API.get(`/admin/finance/reports/saved/${id}/execute`, { params: p }),
  getSavedReports: () => API.get("/admin/finance/reports/saved"),
  createSavedReport: d => API.post("/admin/finance/reports/saved", d),
  deleteSavedReport: id => API.delete(`/admin/finance/reports/saved/${id}`),
  exportReportXlsx: d => API.post("/admin/finance/reports/export/xlsx", d),
  exportReportPdf: d => API.post("/admin/finance/reports/export/pdf", d),
  getExportLogs: p => API.get("/admin/finance/reports/exports/history", { params: p }),
  downloadExport: id => API.get(`/admin/finance/reports/exports/download/${id}`, { responseType: "blob" }),
}
export const taxAPI = {
  getOverview: p => API.get("/admin/tax/overview", { params: p }),
  getHsn: p => API.get("/admin/tax/hsn", { params: p }),
  getStates: p => API.get("/admin/tax/states", { params: p }),
  getRates: p => API.get("/admin/tax/rates", { params: p }),
  getInputTax: p => API.get("/admin/tax/input-tax", { params: p }),
  getDataQuality: p => API.get("/admin/tax/data-quality", { params: p }),
  getReconciliation: p => API.get("/admin/tax/reconciliation", { params: p }),
}
export const shippingAPI = {
  checkHealth: () => API.get("/shipping/health"),
  checkPincode: (pincode) => API.get(`/shipping/pincode/${pincode}`),
  calculateRate: (d) => API.post("/shipping/calculate-rate", d),
  createShipment: (orderId) => API.post(`/shipping/admin/shipment/${orderId}`)
}
export default API
