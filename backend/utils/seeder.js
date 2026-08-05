require("dotenv").config();
const mongoose=require("mongoose"),connectDB=require("../config/db");
const User=require("../models/User"),Product=require("../models/Product"),{Category,Coupon}=require("../models/models");
const seed=async()=>{await connectDB();await Promise.all([User.deleteMany(),Product.deleteMany(),Category.deleteMany(),Coupon.deleteMany()]);
const admin=await User.create({name:"LYVO Admin",email:process.env.ADMIN_EMAIL||"admin@lyvo.com",password:process.env.ADMIN_PASSWORD||"Admin@123456",role:"admin"});
await User.create({name:"Demo User",email:"user@lyvo.com",password:"User@123456"});
const cats=await Category.insertMany([{name:"Running",slug:"running",icon:"🏃"},{name:"Lifestyle",slug:"lifestyle",icon:"👟"},{name:"Basketball",slug:"basketball",icon:"🏀"},{name:"Training",slug:"training",icon:"💪"},{name:"Limited Ed.",slug:"limited-ed",icon:"⭐"}]);
const cm=Object.fromEntries(cats.map(c=>[c.slug,c._id]));
await Product.create([
  {name:"LYVO Air Vision I",brand:"LYVO",category:cm["lifestyle"],gender:"unisex",price:14999,discountPrice:11999,description:"The signature LYVO low-top. Premium leather upper with memory foam insole.",images:[{url:"https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600"}],colors:[{name:"Midnight Black",hex:"#1a1a1a"}],sizes:[{size:"UK 7",stock:8},{size:"UK 8",stock:12},{size:"UK 9",stock:15},{size:"UK 10",stock:10}],isFeatured:true,isNew:true,tags:["signature","low-top"],features:["Memory foam insole","Leather upper"],createdBy:admin._id},
  {name:"LYVO Rise High Pro",brand:"LYVO",category:cm["basketball"],gender:"men",price:19999,discountPrice:15999,description:"High-performance high-top for the court and streets.",images:[{url:"https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600"}],colors:[{name:"Court White",hex:"#f0f0f0"}],sizes:[{size:"UK 7",stock:6},{size:"UK 8",stock:9},{size:"UK 9",stock:12}],isFeatured:true,tags:["high-top","basketball"],features:["Ankle support","Responsive cushioning"],createdBy:admin._id},
  {name:"LYVO Hustle Runner",brand:"LYVO",category:cm["running"],gender:"unisex",price:12999,discountPrice:9999,description:"Built for the grind. Lightweight EVA midsole for every run.",images:[{url:"https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600"}],colors:[{name:"Fire Red",hex:"#FF3A1A"}],sizes:[{size:"UK 6",stock:10},{size:"UK 7",stock:14},{size:"UK 8",stock:18},{size:"UK 9",stock:16}],isFeatured:true,isBestSeller:true,tags:["running","lightweight"],features:["EVA foam","Breathable mesh"],createdBy:admin._id},
  {name:"Vision Gold Edition",brand:"LYVO",category:cm["limited-ed"],gender:"unisex",price:29999,description:"Limited collector piece. 24k gold accents on premium suede.",images:[{url:"https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=600"}],colors:[{name:"Gold Rush",hex:"#FFD166"}],sizes:[{size:"UK 7",stock:2},{size:"UK 8",stock:3},{size:"UK 9",stock:3}],isFeatured:true,tags:["limited","gold"],features:["Premium suede","Gold accents"],createdBy:admin._id},
  {name:"LYVO Dream Runner II",brand:"LYVO",category:cm["running"],gender:"women",price:11999,discountPrice:8999,description:"Feather-light and responsive. Designed for her.",images:[{url:"https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=600"}],colors:[{name:"Sky Blue",hex:"#87CEEB"}],sizes:[{size:"UK 4",stock:8},{size:"UK 5",stock:12},{size:"UK 6",stock:15}],tags:["women","running"],features:["CloudFoam cushioning"],createdBy:admin._id},
  {name:"LYVO Forward Low",brand:"LYVO",category:cm["lifestyle"],gender:"unisex",price:13999,description:"Clean lines for those always heading somewhere.",images:[{url:"https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=600"}],colors:[{name:"Forest Green",hex:"#228B22"}],sizes:[{size:"UK 7",stock:9},{size:"UK 8",stock:13},{size:"UK 9",stock:11}],tags:["minimal","lifestyle"],features:["Tumbled leather","Ortholite insole"],createdBy:admin._id},
]);
await Coupon.insertMany([
  {code:"LYVO10",type:"percentage",value:10,minPurchase:999,maxDiscount:500,usageLimit:100,description:"10% off on orders above ₹999",expiryDate:new Date("2027-12-31"),createdBy:admin._id},
  {code:"VISION20",type:"percentage",value:20,minPurchase:1999,maxDiscount:800,usageLimit:50,description:"20% off on orders above ₹1999",expiryDate:new Date("2027-12-31"),createdBy:admin._id},
  {code:"HUSTLE15",type:"fixed",value:150,minPurchase:799,usageLimit:200,description:"₹150 off on orders above ₹799",expiryDate:new Date("2027-12-31"),createdBy:admin._id},
]);
console.log("🎉 Database seeded!\n   Admin: admin@lyvo.com / Admin@123456\n   User:  user@lyvo.com  / User@123456\n   Coupons: LYVO10, VISION20, HUSTLE15");
process.exit(0);};
seed().catch(e=>{console.error(e);process.exit(1);});
