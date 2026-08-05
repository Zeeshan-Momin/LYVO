const ah=require("express-async-handler"),Product=require("../models/Product"),{uploadToCloudinary,deleteFromCloudinary}=require("../middleware/upload");
const cache=require("../utils/cache"); // Task 7

exports.getProducts=ah(async(req,res)=>{
  const cacheKey = "products_list_" + JSON.stringify(req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  const{keyword,category,gender,minPrice,maxPrice,sort="-createdAt",page=1,limit=12,isFeatured,isNew,isBestSeller,size}=req.query;
  const filter={isActive:true};
  if(keyword)filter.$text={$search:keyword};
  if(category){
    if(/^[0-9a-f]{24}$/i.test(category)){
      filter.category=category;
    }else{
      const cat=await require("../models/models").Category.findOne({slug:category});
      if(cat)filter.category=cat._id;
      else filter.category=null;
    }
  }
  if(gender)filter.gender=gender;
  if(isFeatured)filter.isFeatured=true;
  if(isNew)filter.isNew=true;
  if(isBestSeller)filter.isBestSeller=true;
  if(minPrice||maxPrice){
    filter.price={};
    if(minPrice)filter.price.$gte=+minPrice;
    if(maxPrice)filter.price.$lte=+maxPrice;
  }
  if(size)filter.sizes={$elemMatch:{size,stock:{$gt:0}}};
  const pg=Math.max(1,+page),lim=Math.min(48,+limit);
  const sortMap={"-createdAt":{createdAt:-1},"price-asc":{price:1},"price-desc":{price:-1},"rating":{"ratings.average":-1},"popular":{soldCount:-1}};
  const[products,total]=await Promise.all([
    Product.find(filter).sort(sortMap[sort]||{createdAt:-1}).skip((pg-1)*lim).limit(lim).populate("category","name slug").lean(),
    Product.countDocuments(filter)
  ]);
  const responseData = {success:true,products,pagination:{total,page:pg,limit:lim,pages:Math.ceil(total/lim),hasNext:pg<Math.ceil(total/lim),hasPrev:pg>1}};
  cache.set(cacheKey, responseData, 300); // 5 minutes cache
  res.json(responseData);
});

exports.getProduct=ah(async(req,res)=>{
  const product=await Product.findOne({$or:[{_id:/^[0-9a-f]{24}$/i.test(req.params.id)?req.params.id:null},{slug:req.params.id}],isActive:true}).populate("category","name slug");
  if(!product)return res.status(404).json({message:"Not found"});
  await Product.findByIdAndUpdate(product._id,{$inc:{views:1}});
  res.json({success:true,product});
});

exports.createProduct=ah(async(req,res)=>{
  const data={...req.body,createdBy:req.user._id};
  ["sizes","colors","tags","features"].forEach(k=>{if(typeof data[k]==="string")try{data[k]=JSON.parse(data[k]);}catch{}});
  if(req.files?.length){
    const uploads=await Promise.all(req.files.map(f=>uploadToCloudinary(f.buffer,"lyvo/products")));
    data.images=uploads.map(u=>({url:u.url,publicId:u.publicId}));
  }
  const product=await Product.create(data);
  await product.populate("category","name slug");
  cache.clear(); // Invalidate catalog cache on write
  res.status(201).json({success:true,product});
});

exports.updateProduct=ah(async(req,res)=>{
  let product=await Product.findById(req.params.id);
  if(!product)return res.status(404).json({message:"Not found"});
  const data={...req.body};
  ["sizes","colors","tags","features"].forEach(k=>{if(typeof data[k]==="string")try{data[k]=JSON.parse(data[k]);}catch{}});
  if(req.files?.length){
    const uploads=await Promise.all(req.files.map(f=>uploadToCloudinary(f.buffer,"lyvo/products")));
    data.images=[...(product.images||[]),...uploads.map(u=>({url:u.url,publicId:u.publicId}))];
  }
  product=await Product.findByIdAndUpdate(req.params.id,data,{new:true,runValidators:true}).populate("category","name slug");
  cache.clear(); // Invalidate catalog cache on write
  res.json({success:true,product});
});

exports.deleteProduct=ah(async(req,res)=>{
  const product=await Product.findById(req.params.id);
  if(!product)return res.status(404).json({message:"Not found"});
  for(const img of product.images)if(img.publicId)await deleteFromCloudinary(img.publicId);
  await product.deleteOne();
  cache.clear(); // Invalidate catalog cache on write
  res.json({success:true,message:"Deleted"});
});

exports.deleteProductImage=ah(async(req,res)=>{
  const{publicId}=req.body;
  const product=await Product.findById(req.params.id);
  if(!product)return res.status(404).json({message:"Not found"});
  await deleteFromCloudinary(publicId);
  product.images=product.images.filter(i=>i.publicId!==publicId);
  await product.save();
  cache.clear(); // Invalidate catalog cache on write
  res.json({success:true,images:product.images});
});

exports.getFeatured=ah(async(req,res)=>{
  const cacheKey = "featured_products";
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  const products=await Product.find({isFeatured:true,isActive:true}).limit(8).populate("category","name").lean();
  const responseData = {success:true,products};
  cache.set(cacheKey, responseData, 600); // 10 minutes cache
  res.json(responseData);
});

exports.getRelated=ah(async(req,res)=>{
  const p=await Product.findById(req.params.id);
  if(!p)return res.status(404).json({message:"Not found"});
  const products=await Product.find({category:p.category,_id:{$ne:p._id},isActive:true}).limit(6).lean();
  res.json({success:true,products});
});

exports.searchSuggestions=ah(async(req,res)=>{
  const{q}=req.query;
  if(!q||q.length<2)return res.json({success:true,suggestions:[]});
  const cacheKey = "search_suggestions_" + q;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  const cleanQ = q.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  // Task 5: Optimized prefix index search matches on name and brand fields
  const products=await Product.find({
    $or: [
      { name: { $regex: "^" + cleanQ, $options: "i" } },
      { brand: { $regex: "^" + cleanQ, $options: "i" } }
    ],
    isActive:true
  })
  .select("name brand slug images price discountPrice")
  .limit(6)
  .lean();
  
  const responseData = {success:true,suggestions:products};
  cache.set(cacheKey, responseData, 600); // 10 minutes cache
  res.json(responseData);
});

exports.updateStock=ah(async(req,res)=>{
  const{sizes}=req.body;
  const product=await Product.findById(req.params.id);
  if(!product)return res.status(404).json({message:"Not found"});
  product.sizes=sizes;
  product.totalStock=sizes.reduce((s,sz)=>s+sz.stock,0);
  await product.save();
  cache.clear(); // Invalidate catalog cache on write
  res.json({success:true,totalStock:product.totalStock});
});

exports.getCategories=ah(async(_,res)=>{
  const cacheKey = "categories";
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  const{Category}=require("../models/models");
  const categories = await Category.find().sort({sortOrder:1});
  const responseData = {success:true,categories};
  cache.set(cacheKey, responseData, 3600); // 1 hour cache
  res.json(responseData);
});
