const r=require("express").Router(),c=require("../controllers/adminController");
const g=[require("../middleware/auth").protect,require("../middleware/auth").adminOnly];
r.get("/dashboard",...g,c.getDashboard);
r.get("/analytics/sales",...g,c.getSalesAnalytics);

// Phase 1 Enhanced Analytics Routes
r.get("/analytics/overview",...g,c.getOverview);
r.get("/analytics/sales-deep",...g,c.getDetailedSales);
r.get("/analytics/customers",...g,c.getCustomersOverview);
r.get("/analytics/customers/:id",...g,c.getCustomerProfile);
r.get("/analytics/data-quality",...g,c.getDataQuality);

// Phase 2 BI & Operational Analytics Routes
r.get("/analytics/products",...g,c.getProductAnalytics);
r.get("/analytics/sizes-colors",...g,c.getSizeColorAnalytics);
r.get("/analytics/inventory",...g,c.getInventoryAnalytics);
r.get("/analytics/geography",...g,c.getGeographyAnalytics);
r.get("/analytics/payments",...g,c.getPaymentAnalytics);
r.get("/analytics/shipping",...g,c.getShippingAnalytics);
r.get("/analytics/returns",...g,c.getReturnsAnalytics);

r.get("/users",...g,c.getUsers);r.get("/users/:id",...g,c.getUser);r.patch("/users/:id",...g,c.updateUser);r.delete("/users/:id",...g,c.deleteUser);
r.get("/categories",...g,c.getCategories);r.post("/categories",...g,c.createCategory);r.put("/categories/:id",...g,c.updateCategory);r.delete("/categories/:id",...g,c.deleteCategory);
r.get("/coupons",...g,c.getCoupons);r.post("/coupons",...g,c.createCoupon);r.put("/coupons/:id",...g,c.updateCoupon);r.delete("/coupons/:id",...g,c.deleteCoupon);
module.exports=r;
