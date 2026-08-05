const r=require("express").Router(),{validateCoupon}=require("../controllers/adminController");
r.post("/validate",validateCoupon);
module.exports=r;
