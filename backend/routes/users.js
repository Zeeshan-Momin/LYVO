const r=require("express").Router(),{protect}=require("../middleware/auth"),User=require("../models/User"),ah=require("express-async-handler");
r.get("/recently-viewed",protect,ah(async(req,res)=>{const u=await User.findById(req.user._id).populate({path:"recentlyViewed.product",select:"name images price discountPrice slug"});res.json({success:true,products:(u?.recentlyViewed||[]).map(r=>r.product).filter(Boolean).slice(0,10)});}));
module.exports=r;
