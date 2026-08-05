const r=require("express").Router(),{protect,adminOnly}=require("../middleware/auth"),{upload,uploadToCloudinary}=require("../middleware/upload"),ah=require("express-async-handler");
r.post("/",protect,adminOnly,upload.single("image"),ah(async(req,res)=>{if(!req.file)return res.status(400).json({message:"No file"});const result=await uploadToCloudinary(req.file.buffer,"lyvo/misc");res.json({success:true,url:result.url,publicId:result.publicId});}));
module.exports=r;
