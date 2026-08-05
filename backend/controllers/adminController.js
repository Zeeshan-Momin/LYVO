const ah=require("express-async-handler"),User=require("../models/User"),Product=require("../models/Product"),Order=require("../models/Order"),SiteStats=require("../models/SiteStats"),{Category,Coupon}=require("../models/models");
const cache=require("../utils/cache");

exports.getDashboard=ah(async(req,res)=>{
  const cacheKey = "admin_dashboard";
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  const month=new Date(new Date().getFullYear(),new Date().getMonth(),1),week=new Date(Date.now()-7*24*60*60*1000);
  const[totalUsers,totalProducts,totalOrders,monthRevenue,weekOrders,pendingOrders,lowStock,recentOrders,recentUsers,ordersByStatus,monthlyRevenue,siteStats]=await Promise.all([
    User.countDocuments({role:"user"}),
    Product.countDocuments({isActive:true}),
    Order.countDocuments(),
    Order.aggregate([{$match:{createdAt:{$gte:month},status:{$nin:["cancelled","refunded"]}}},{$group:{_id:null,total:{$sum:"$pricing.total"}}}]),
    Order.countDocuments({createdAt:{$gte:week}}),
    Order.countDocuments({status:"pending"}),
    Product.find({totalStock:{$lte:5},isActive:true}).select("name totalStock images").limit(10),
    Order.find().sort({createdAt:-1}).limit(10).populate("user","name email").lean(),
    User.find({role:"user"}).sort({createdAt:-1}).limit(8).select("name email createdAt").lean(),
    Order.aggregate([{$group:{_id:"$status",count:{$sum:1}}}]),
    Order.aggregate([{$match:{status:{$nin:["cancelled","refunded"]}}},{$group:{_id:{year:{$year:"$createdAt"},month:{$month:"$createdAt"}},revenue:{$sum:"$pricing.total"},orders:{$sum:1}}},{$sort:{"_id.year":1,"_id.month":1}},{$limit:12}]),
    SiteStats.findOne({key:"global"})
  ]);

  const dashboardData = {
    success:true,
    dashboard:{
      stats:{
        totalUsers,
        totalProducts,
        totalOrders,
        pendingOrders,
        weekOrders,
        monthRevenue:monthRevenue[0]?.total||0,
        totalVisits:siteStats?.totalVisits||0
      },
      lowStockProducts:lowStock,
      recentOrders,
      recentUsers,
      ordersByStatus,
      monthlyRevenue
    }
  };

  cache.set(cacheKey, dashboardData, 60); // 1 minute analytics cache
  res.json(dashboardData);
});

exports.getUsers=ah(async(req,res)=>{const{page=1,limit=20,search,role}=req.query;const filter={};if(role)filter.role=role;if(search)filter.$or=[{name:{$regex:search,$options:"i"}},{email:{$regex:search,$options:"i"}}];const pg=+page,lim=+limit;const[users,total]=await Promise.all([User.find(filter).sort({createdAt:-1}).skip((pg-1)*lim).limit(lim).select("-password -refreshToken").lean(),User.countDocuments(filter)]);res.json({success:true,users,pagination:{total,page:pg,pages:Math.ceil(total/lim)}});});
exports.getUser=ah(async(req,res)=>{const user=await User.findById(req.params.id).select("-password -refreshToken");if(!user)return res.status(404).json({message:"Not found"});const orders=await Order.find({user:user._id}).sort({createdAt:-1}).limit(10);res.json({success:true,user,orders});});
exports.updateUser=ah(async(req,res)=>{const{name,email,role,isActive}=req.body;const user=await User.findByIdAndUpdate(req.params.id,{name,email,role,isActive},{new:true}).select("-password");if(!user)return res.status(404).json({message:"Not found"});res.json({success:true,user});});
exports.deleteUser=ah(async(req,res)=>{const user=await User.findById(req.params.id);if(!user)return res.status(404).json({message:"Not found"});if(user.role==="admin")return res.status(400).json({message:"Cannot delete admin"});await user.deleteOne();res.json({success:true,message:"Deleted"});});

exports.getCategories=ah(async(_,res)=>{
  const cacheKey = "categories_list";
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);
  const categories = await Category.find().sort({sortOrder:1});
  const responseData = {success:true,categories};
  cache.set(cacheKey, responseData, 3600); // 1 hour cache
  res.json(responseData);
});

exports.createCategory=ah(async(req,res)=>{const c=await Category.create(req.body);cache.clear();res.status(201).json({success:true,category:c});});
exports.updateCategory=ah(async(req,res)=>{const c=await Category.findByIdAndUpdate(req.params.id,req.body,{new:true});cache.clear();res.json({success:true,category:c});});
exports.deleteCategory=ah(async(req,res)=>{const n=await Product.countDocuments({category:req.params.id});if(n)return res.status(400).json({message:`${n} products use this category`});await Category.findByIdAndDelete(req.params.id);cache.clear();res.json({success:true,message:"Deleted"});});
exports.getCoupons=ah(async(_,res)=>res.json({success:true,coupons:await Coupon.find().sort({createdAt:-1})}));
exports.createCoupon=ah(async(req,res)=>{const c=await Coupon.create({...req.body,createdBy:req.user._id});res.status(201).json({success:true,coupon:c});});
exports.updateCoupon=ah(async(req,res)=>{const c=await Coupon.findByIdAndUpdate(req.params.id,req.body,{new:true});res.json({success:true,coupon:c});});
exports.deleteCoupon=ah(async(req,res)=>{await Coupon.findByIdAndDelete(req.params.id);res.json({success:true});});
exports.validateCoupon=ah(async(req,res)=>{const{code,cartTotal}=req.body;const coupon=await Coupon.findOne({code:code?.toUpperCase(),isActive:true});if(!coupon)return res.status(404).json({message:"Invalid coupon"});if(new Date()>coupon.expiryDate)return res.status(400).json({message:"Coupon expired"});if(cartTotal<coupon.minPurchase)return res.status(400).json({message:`Min cart ₹${coupon.minPurchase}`});let discount=coupon.type==="percentage"?Math.round(cartTotal*coupon.value/100):coupon.value;if(coupon.maxDiscount>0)discount=Math.min(discount,coupon.maxDiscount);res.json({success:true,discount,coupon:{code:coupon.code,type:coupon.type,value:coupon.value,description:coupon.description}});});

exports.getSalesAnalytics=ah(async(req,res)=>{
  const year=req.query.year||new Date().getFullYear();
  const cacheKey = "sales_analytics_" + year;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  const start=new Date(`${year}-01-01`),end=new Date(`${+year+1}-01-01`);
  const[monthly,categoryRevenue,topProducts,genderSplit]=await Promise.all([
    Order.aggregate([{$match:{status:{$nin:["cancelled","refunded"]},createdAt:{$gte:start,$lt:end}}},{$group:{_id:{$month:"$createdAt"},revenue:{$sum:"$pricing.total"},orders:{$sum:1}}},{$sort:{_id:1}}]),
    Order.aggregate([{$match:{status:{$nin:["cancelled","refunded"]}}},{$unwind:"$items"},{$lookup:{from:"products",localField:"items.product",foreignField:"_id",as:"prod"}},{$unwind:"$prod"},{$lookup:{from:"categories",localField:"prod.category",foreignField:"_id",as:"cat"}},{$unwind:"$cat"},{$group:{_id:"$cat.name",revenue:{$sum:{$multiply:["$items.price","$items.quantity"]}},sold:{$sum:"$items.quantity"}}},{$sort:{revenue:-1}},{$limit:6}]),
    Product.find({isActive:true}).sort({soldCount:-1}).limit(10).select("name soldCount price images ratings").lean(),
    Product.aggregate([{$group:{_id:"$gender",count:{$sum:1}}}])
  ]);

  const analyticsData = {success:true,analytics:{monthly,categoryRevenue,topProducts,genderSplit}};
  cache.set(cacheKey, analyticsData, 300); // 5 minutes cache
  res.json(analyticsData);
});
