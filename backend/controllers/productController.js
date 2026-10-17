const ah=require("express-async-handler"),mongoose=require("mongoose"),Product=require("../models/Product"),{uploadToCloudinary,deleteFromCloudinary}=require("../middleware/upload");
const cache=require("../utils/cache"); // Task 7

const ACCESSORY_SLUGS = ["belts", "socks"];

const getAccessoryCategoryIds = async () => {
  const { Category } = require("../models/models");
  const cats = await Category.find({
    $or: [
      { slug: { $in: ACCESSORY_SLUGS } },
      { name: { $in: [/^belts?$/i, /^socks?$/i] } }
    ]
  }).select("_id").lean();
  return cats.map(c => c._id);
};

exports.getAccessoryCategoryIds = getAccessoryCategoryIds;

exports.getProducts=ah(async(req,res)=>{
  const isAdminRequest = req.user?.role === "admin" && (req.query.admin === "true" || req.query.admin === true);
  const cacheKey = isAdminRequest ? null : ("products_list_" + JSON.stringify(req.query));
  if (cacheKey) {
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);
  }

  const{keyword,category,gender,minPrice,maxPrice,sort="-createdAt",page=1,limit=12,isFeatured,isNew,isBestSeller,size}=req.query;
  const filter={isActive:true};
  if(keyword)filter.$text={$search:keyword};

  const accessoryCategoryIds = await getAccessoryCategoryIds();

  if(category){
    if(category === "accessories"){
      filter.category = { $in: accessoryCategoryIds };
    } else if(/^[0-9a-f]{24}$/i.test(category)){
      filter.category = new mongoose.Types.ObjectId(category);
    } else {
      const cat=await require("../models/models").Category.findOne({slug:category});
      if(cat)filter.category=cat._id;
      else filter.category=null;
    }
  } else {
    // General storefront queries exclude Belts and Socks by default.
    // Only authenticated admin requests via Admin Products include all categories.
    if (!isAdminRequest) {
      filter.category = { $nin: accessoryCategoryIds };
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
  if (cacheKey) {
    cache.set(cacheKey, responseData, 300); // 5 minutes cache
  }
  res.json(responseData);
});

exports.getAccessories=ah(async(req,res)=>{
  const accessoryCategoryIds = await getAccessoryCategoryIds();
  const filter = { isActive: true, category: { $in: accessoryCategoryIds } };
  const products = await Product.find(filter).sort({ createdAt: -1 }).populate("category", "name slug").lean();
  res.json({ success: true, products });
});

exports.getProduct=ah(async(req,res)=>{
  const product=await Product.findOne({$or:[{_id:/^[0-9a-f]{24}$/i.test(req.params.id)?req.params.id:null},{slug:req.params.id}],isActive:true}).populate("category","name slug");
  if(!product)return res.status(404).json({message:"Not found"});
  await Product.findByIdAndUpdate(product._id,{$inc:{views:1}});
  res.json({success:true,product});
});

exports.createProduct=ah(async(req,res)=>{
  const productId = new mongoose.Types.ObjectId();
  const data = { ...req.body, _id: productId, createdBy: req.user._id };
  ["sizes","colors","tags","features"].forEach(k=>{
    if(typeof data[k]==="string"){
      try{data[k]=JSON.parse(data[k]);}catch{}
    }
  });

  if(data.weightGrams!==undefined&&data.weightGrams!=="") data.weightGrams=Number(data.weightGrams);
  if(data.lengthCm!==undefined&&data.lengthCm!=="") data.lengthCm=Number(data.lengthCm);
  if(data.widthCm!==undefined&&data.widthCm!=="") data.widthCm=Number(data.widthCm);
  if(data.heightCm!==undefined&&data.heightCm!=="") data.heightCm=Number(data.heightCm);

  let uploadedPublicIds=[];
  try {
    if(req.files?.length){
      if(req.files.length>6){
        return res.status(400).json({message:"Maximum 6 images allowed per product"});
      }
      const primaryIndex=Number(req.body.primaryIndex||0);
      const folder = `lyvo/products/${productId}`;
      const uploads=await Promise.all(
        req.files.map(f=>uploadToCloudinary(f.buffer, folder))
      );
      uploadedPublicIds=uploads.map(u=>u.publicId);
      data.images=uploads.map((u,idx)=>({
        url:u.url,
        publicId:u.publicId,
        alt:data.name||"Product Image",
        isPrimary:idx===primaryIndex
      }));
      if(data.images.length>0&&!data.images.some(img=>img.isPrimary)){
        data.images[0].isPrimary=true;
      }
    }
    const product=await Product.create(data);
    await product.populate("category","name slug");
    cache.clear(); // Invalidate catalog cache on write
    res.status(201).json({success:true,product});
  } catch(err) {
    if(uploadedPublicIds.length>0){
      await Promise.all(uploadedPublicIds.map(pid=>deleteFromCloudinary(pid).catch(()=>{})));
    }
    throw err;
  }
});

exports.updateProduct=ah(async(req,res)=>{
  let product=await Product.findById(req.params.id);
  if(!product)return res.status(404).json({message:"Not found"});

  const data={...req.body};
  ["sizes","colors","tags","features","existingImages"].forEach(k=>{
    if(typeof data[k]==="string"){
      try{data[k]=JSON.parse(data[k]);}catch{}
    }
  });

  if(data.weightGrams!==undefined&&data.weightGrams!=="") data.weightGrams=Number(data.weightGrams);
  if(data.lengthCm!==undefined&&data.lengthCm!=="") data.lengthCm=Number(data.lengthCm);
  if(data.widthCm!==undefined&&data.widthCm!=="") data.widthCm=Number(data.widthCm);
  if(data.heightCm!==undefined&&data.heightCm!=="") data.heightCm=Number(data.heightCm);

  let existingImages=[];
  if(Array.isArray(data.existingImages)){
    existingImages=data.existingImages;
    const keptPublicIds=new Set(existingImages.map(img=>img.publicId).filter(Boolean));
    const removedImages=(product.images||[]).filter(img=>img.publicId&&!keptPublicIds.has(img.publicId));
    for(const img of removedImages){
      await deleteFromCloudinary(img.publicId).catch(()=>{});
    }
  } else {
    existingImages=product.images||[];
  }

  const newFilesCount=req.files?.length||0;
  if(existingImages.length+newFilesCount>6){
    return res.status(400).json({message:"Total images cannot exceed 6 per product"});
  }

  let newlyUploadedPublicIds=[];
  try {
    let newImages=[];
    if(req.files?.length){
      const folder = `lyvo/products/${req.params.id}`;
      const uploads=await Promise.all(
        req.files.map(f=>uploadToCloudinary(f.buffer, folder))
      );
      newlyUploadedPublicIds=uploads.map(u=>u.publicId);
      newImages=uploads.map(u=>({
        url:u.url,
        publicId:u.publicId,
        alt:data.name||product.name||"Product Image",
        isPrimary:false
      }));
    }

    let combinedImages=[...existingImages,...newImages];

    if(req.body.primaryIndex!==undefined&&req.body.primaryIndex!==""){
      const primaryIdx=Number(req.body.primaryIndex);
      combinedImages=combinedImages.map((img,idx)=>({
        ...img,
        isPrimary:idx===primaryIdx
      }));
    } else if(req.body.primaryPublicId){
      combinedImages=combinedImages.map(img=>({
        ...img,
        isPrimary:img.publicId===req.body.primaryPublicId
      }));
    }

    if(combinedImages.length>0&&!combinedImages.some(img=>img.isPrimary)){
      combinedImages[0].isPrimary=true;
    }

    data.images=combinedImages;
    delete data.existingImages;

    product=await Product.findByIdAndUpdate(req.params.id,data,{new:true,runValidators:true}).populate("category","name slug");
    cache.clear(); // Invalidate catalog cache on write
    res.json({success:true,product});
  } catch(err) {
    if(newlyUploadedPublicIds.length>0){
      await Promise.all(newlyUploadedPublicIds.map(pid=>deleteFromCloudinary(pid).catch(()=>{})));
    }
    throw err;
  }
});

exports.deleteProduct=ah(async(req,res)=>{
  const product=await Product.findById(req.params.id);
  if(!product)return res.status(404).json({message:"Not found"});
  if(product.images?.length){
    for(const img of product.images){
      if(img.publicId){
        await deleteFromCloudinary(img.publicId).catch(()=>{});
      }
    }
  }
  await product.deleteOne();
  cache.clear(); // Invalidate catalog cache on write
  res.json({success:true,message:"Deleted"});
});

exports.deleteProductImage=ah(async(req,res)=>{
  const{publicId}=req.body;
  const product=await Product.findById(req.params.id);
  if(!product)return res.status(404).json({message:"Not found"});
  if(publicId){
    await deleteFromCloudinary(publicId).catch(()=>{});
  }
  const wasPrimary=product.images.some(i=>i.publicId===publicId&&i.isPrimary);
  product.images=product.images.filter(i=>i.publicId!==publicId);
  if(wasPrimary&&product.images.length>0){
    product.images[0].isPrimary=true;
  }
  await product.save();
  cache.clear(); // Invalidate catalog cache on write
  res.json({success:true,images:product.images});
});

exports.getFeatured=ah(async(req,res)=>{
  const cacheKey = "featured_products";
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  const accessoryCategoryIds = await getAccessoryCategoryIds();
  const products=await Product.find({
    isFeatured:true,
    isActive:true,
    category: { $nin: accessoryCategoryIds }
  }).limit(8).populate("category","name").lean();
  const responseData = {success:true,products};
  cache.set(cacheKey, responseData, 600); // 10 minutes cache
  res.json(responseData);
});

exports.getRelated=ah(async(req,res)=>{
  const p=await Product.findById(req.params.id);
  if(!p)return res.status(404).json({message:"Not found"});

  const accessoryCategoryIds = await getAccessoryCategoryIds();
  const isAccessory = accessoryCategoryIds.some(id => id.toString() === p.category?.toString());

  const filter = {
    _id: { $ne: p._id },
    isActive: true
  };

  if (isAccessory) {
    filter.category = p.category ? p.category : { $in: accessoryCategoryIds };
  } else {
    filter.category = p.category ? p.category : { $nin: accessoryCategoryIds };
  }

  const products=await Product.find(filter).limit(6).lean();
  res.json({success:true,products});
});

exports.searchSuggestions=ah(async(req,res)=>{
  const{q,category}=req.query;
  if(!q||q.length<2)return res.json({success:true,suggestions:[]});
  const cacheKey = "search_suggestions_" + q + (category ? "_" + category : "");
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  const cleanQ = q.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const accessoryCategoryIds = await getAccessoryCategoryIds();

  const filter = {
    $or: [
      { name: { $regex: "^" + cleanQ, $options: "i" } },
      { brand: { $regex: "^" + cleanQ, $options: "i" } }
    ],
    isActive: true
  };

  if (category) {
    if (category === "accessories") {
      filter.category = { $in: accessoryCategoryIds };
    } else if (/^[0-9a-f]{24}$/i.test(category)) {
      filter.category = new mongoose.Types.ObjectId(category);
    } else {
      const { Category } = require("../models/models");
      const cat = await Category.findOne({ slug: category });
      if (cat) filter.category = cat._id;
      else filter.category = null;
    }
  } else {
    // Normal customer search excludes accessories
    filter.category = { $nin: accessoryCategoryIds };
  }

  const products=await Product.find(filter)
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

exports.getCategories=ah(async(req,res)=>{
  const includeAccessories = req?.query?.includeAccessories === "true";
  const cacheKey = "categories_" + (includeAccessories ? "all" : "storefront");
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  const{Category}=require("../models/models");
  let filter = {};
  if (!includeAccessories) {
    filter = {
      slug: { $nin: ACCESSORY_SLUGS },
      name: { $nin: [/^belts?$/i, /^socks?$/i] }
    };
  }
  const categories = await Category.find(filter).sort({sortOrder:1});
  const responseData = {success:true,categories};
  cache.set(cacheKey, responseData, 3600); // 1 hour cache
  res.json(responseData);
});
