const r=require("express").Router(),c=require("../controllers/adminController");
const g=[require("../middleware/auth").protect,require("../middleware/auth").adminOnly];
r.get("/dashboard",...g,c.getDashboard);r.get("/analytics/sales",...g,c.getSalesAnalytics);
r.get("/users",...g,c.getUsers);r.get("/users/:id",...g,c.getUser);r.patch("/users/:id",...g,c.updateUser);r.delete("/users/:id",...g,c.deleteUser);
r.get("/categories",...g,c.getCategories);r.post("/categories",...g,c.createCategory);r.put("/categories/:id",...g,c.updateCategory);r.delete("/categories/:id",...g,c.deleteCategory);
r.get("/coupons",...g,c.getCoupons);r.post("/coupons",...g,c.createCoupon);r.put("/coupons/:id",...g,c.updateCoupon);r.delete("/coupons/:id",...g,c.deleteCoupon);
module.exports=r;
