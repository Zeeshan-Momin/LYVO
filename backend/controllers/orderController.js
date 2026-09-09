const ah=require("express-async-handler"),Order=require("../models/Order"),Product=require("../models/Product"),{Coupon}=require("../models/models");
const cache = require("../utils/cache");
const razorpay = require("../utils/razorpay");
const{computePricing}=require("../utils/pricing");
exports.placeOrder=ah(async(req,res)=>{
  const{items,shippingAddress,paymentMethod,couponCode,razorpayOrderId,razorpayPaymentId,razorpaySignature}=req.body;
  if(!items?.length)return res.status(400).json({message:"No items"});

  const mongoose = require("mongoose");
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let pricing;
    try {
      pricing = await computePricing(items, couponCode);
    } catch(e) {
      await session.abortTransaction();
      session.endSession();
      return res.status(e.statusCode||400).json({message:e.message});
    }
    const{subtotal,shippingCost,tax,couponDiscount,total,validItems,validCoupon}=pricing;

    let isPaid=false,paidAt=undefined;
    if(paymentMethod!=="cod"){
      if(!razorpayOrderId||!razorpayPaymentId||!razorpaySignature) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({message:"Missing Razorpay transaction details"});
      }
      const crypto = require("crypto");
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      const isMockMode = !keySecret || keySecret.includes("xxxx") || keySecret.includes("mock") || keySecret === "rzp_secret_xxxxxxxxxxxxxxxx";
      if(!isMockMode){
        const expectedSignature = crypto.createHmac("sha256", keySecret).update(razorpayOrderId + "|" + razorpayPaymentId).digest("hex");
        if(expectedSignature !== razorpaySignature) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({message: "Transaction signature verification failed"});
        }
      }
      isPaid=true;paidAt=new Date();
    }

    const orders = await Order.create([{
      user:req.user._id,
      items:validItems,
      shippingAddress,
      paymentMethod,
      couponCode:couponCode?.toUpperCase()||"",
      pricing:{subtotal,shippingCost,tax,couponDiscount,total},
      isPaid,
      paidAt,
      razorpayOrderId:paymentMethod!=="cod"?razorpayOrderId:"",
      razorpayPaymentId:paymentMethod!=="cod"?razorpayPaymentId:"",
      razorpaySignature:paymentMethod!=="cod"?razorpaySignature:"",
      statusHistory:[{status:"pending",note:"Order placed",updatedBy:req.user._id}]
    }], { session });

    const order = orders[0];

    for(const item of validItems){
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: item.product,
          "sizes.size": item.size,
          "sizes.stock": { $gte: item.quantity }
        },
        {
          $inc: { "sizes.$.stock": -item.quantity, soldCount: item.quantity }
        },
        { new: true, session }
      );
      if (!updatedProduct) {
        throw Object.assign(new Error(`Insufficient stock: ${item.name} size ${item.size}`), { statusCode: 400 });
      }
      updatedProduct.totalStock = updatedProduct.sizes.reduce((s,sz)=>s+sz.stock,0);
      await updatedProduct.save({validateBeforeSave:false, session});
    }

    if(validCoupon) {
      await Coupon.findByIdAndUpdate(
        validCoupon._id,
        {
          $inc: { usedCount: 1 },
          $push: { usedBy: req.user._id }
        },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();
    cache.clear(); // Clear cached dashboard statistics and charts
    res.status(201).json({success:true,order});
  } catch(error) {
    console.error("❌ Place Order Error:", error);
    await session.abortTransaction();
    session.endSession();

    let statusCode = error.statusCode || 500;
    let message = error.message || "Server Error";
    if (error.code === 112 || error.name === "WriteConflict" || error.message?.includes("WriteConflict")) {
      statusCode = 400;
      message = "Insufficient stock: Write conflict, please retry.";
    }

    res.status(statusCode).json({ message });
  }
});
exports.getMyOrders=ah(async(req,res)=>{const{page=1,limit=10,status}=req.query;const filter={user:req.user._id};if(status)filter.status=status;const pg=+page,lim=+limit;const[orders,total]=await Promise.all([Order.find(filter).sort({createdAt:-1}).skip((pg-1)*lim).limit(lim).lean(),Order.countDocuments(filter)]);res.json({success:true,orders,pagination:{total,page:pg,pages:Math.ceil(total/lim)}});});
exports.getOrder=ah(async(req,res)=>{const order=await Order.findById(req.params.id).populate("user","name email phone").populate("items.product","name images slug");if(!order)return res.status(404).json({message:"Not found"});if(req.user.role!=="admin"&&order.user._id.toString()!==req.user._id.toString())return res.status(403).json({message:"Access denied"});res.json({success:true,order});});
exports.cancelOrder=ah(async(req,res)=>{
  const order=await Order.findById(req.params.id);
  if(!order)return res.status(404).json({message:"Not found"});
  if(order.user.toString()!==req.user._id.toString())return res.status(403).json({message:"Access denied"});
  if(!["pending","confirmed"].includes(order.status))return res.status(400).json({message:`Cannot cancel: ${order.status}`});
  if(!req.body.reason)return res.status(400).json({message:"A cancellation reason is required"});
  order.status="cancelled";order.isCancelled=true;order.cancelReason=req.body.reason;
  order.statusHistory.push({status:"cancelled",note:order.cancelReason,updatedBy:req.user._id});
  if(order.isPaid&&order.razorpayPaymentId&&!order.isRefunded){
    const refund=await razorpay.payments.refund(order.razorpayPaymentId, { amount: Math.round(order.pricing.total * 100) });
    order.isRefunded=true;order.refundedAt=new Date();order.razorpayRefundId=refund.id;
  }
  await order.save();
  for(const item of order.items)await Product.findOneAndUpdate({_id:item.product,"sizes.size":item.size},{$inc:{"sizes.$.stock":item.quantity,soldCount:-item.quantity}});
  cache.clear(); // Invalidate dashboard and product list caches
  res.json({success:true,order});
});
// PATCH /api/orders/:id/return — customer requests a return after delivery, with a required reason
exports.requestReturn=ah(async(req,res)=>{
  const{reason,comment}=req.body;
  if(!reason)return res.status(400).json({message:"A return reason is required"});
  const order=await Order.findById(req.params.id);
  if(!order)return res.status(404).json({message:"Not found"});
  if(order.user.toString()!==req.user._id.toString())return res.status(403).json({message:"Access denied"});
  if(order.status!=="delivered")return res.status(400).json({message:"Only delivered orders can be returned"});
  const RETURN_WINDOW_DAYS=7;
  if(order.deliveredAt&&(Date.now()-new Date(order.deliveredAt).getTime())>RETURN_WINDOW_DAYS*24*60*60*1000)
    return res.status(400).json({message:`Return window (${RETURN_WINDOW_DAYS} days) has passed`});
  order.status="return_requested";
  order.returnRequest={reason,comment:comment||"",requestedAt:new Date(),status:"pending"};
  order.statusHistory.push({status:"return_requested",note:reason,updatedBy:req.user._id});
  await order.save();
  cache.clear(); // Invalidate caches
  res.json({success:true,order});
});
// PATCH /api/orders/admin/:id/return-status — admin approves/rejects a return, refunding paid orders on approval
exports.updateReturnStatus=ah(async(req,res)=>{
  const{decision}=req.body; // "approved" | "rejected"
  if(!["approved","rejected"].includes(decision))return res.status(400).json({message:"decision must be approved or rejected"});
  const order=await Order.findById(req.params.id);
  if(!order)return res.status(404).json({message:"Not found"});
  if(order.status!=="return_requested")return res.status(400).json({message:"No pending return request"});
  order.returnRequest.status=decision;order.returnRequest.resolvedAt=new Date();order.returnRequest.resolvedBy=req.user._id;
  if(decision==="approved"){
    order.status="returned";
    if(order.isPaid&&order.razorpayPaymentId&&!order.isRefunded){
      const refund=await razorpay.payments.refund(order.razorpayPaymentId, { amount: Math.round(order.pricing.total * 100) });
      order.isRefunded=true;order.refundedAt=new Date();order.razorpayRefundId=refund.id;
    }
    for(const item of order.items)await Product.findOneAndUpdate({_id:item.product,"sizes.size":item.size},{$inc:{"sizes.$.stock":item.quantity,soldCount:-item.quantity}});
  }else{
    order.status="delivered"; // bounce back, customer can re-request if they have grounds
  }
  order.statusHistory.push({status:order.status,note:`Return ${decision}`,updatedBy:req.user._id});
  await order.save();
  cache.clear(); // Invalidate dashboard caches on return resolve
  res.json({success:true,order});
});
exports.getAllOrders=ah(async(req,res)=>{const{page=1,limit=20,status,search}=req.query;const filter={};if(status)filter.status=status;if(search)filter.orderNumber={$regex:search,$options:"i"};const pg=+page,lim=+limit;const[orders,total]=await Promise.all([Order.find(filter).sort({createdAt:-1}).skip((pg-1)*lim).limit(lim).populate("user","name email").lean(),Order.countDocuments(filter)]);res.json({success:true,orders,pagination:{total,page:pg,pages:Math.ceil(total/lim)}});});
exports.updateOrderStatus=ah(async(req,res)=>{const{status,note,trackingNumber,trackingUrl}=req.body;const order=await Order.findById(req.params.id);if(!order)return res.status(404).json({message:"Not found"});order.status=status;if(trackingNumber)order.trackingNumber=trackingNumber;if(trackingUrl)order.trackingUrl=trackingUrl;if(status==="delivered"){order.isDelivered=true;order.deliveredAt=new Date();}if(["confirmed","processing"].includes(status)){order.isPaid=true;order.paidAt=new Date();}order.statusHistory.push({status,note:note||"",updatedBy:req.user._id});await order.save();cache.clear();res.json({success:true,order});});
exports.getAnalytics=ah(async(req,res)=>{
  const cacheKey = "order_analytics_30d";
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  const start=new Date(Date.now()-30*24*60*60*1000);
  const[totalOrders,revenue,statusCounts,daily]=await Promise.all([
    Order.countDocuments({createdAt:{$gte:start}}),
    Order.aggregate([{$match:{createdAt:{$gte:start},status:{$nin:["cancelled","refunded"]}}},{$group:{_id:null,total:{$sum:"$pricing.total"}}}]),
    Order.aggregate([{$match:{createdAt:{$gte:start}}},{$group:{_id:"$status",count:{$sum:1}}}]),
    Order.aggregate([{$match:{createdAt:{$gte:start},status:{$nin:["cancelled","refunded"]}}},{$group:{_id:{$dateToString:{format:"%Y-%m-%d",date:"$createdAt"}},orders:{$sum:1},revenue:{$sum:"$pricing.total"}}},{$sort:{_id:1}}])
  ]);
  
  const responseData = {success:true,analytics:{totalOrders,totalRevenue:revenue[0]?.total||0,statusCounts,daily}};
  cache.set(cacheKey, responseData, 300); // 5 minutes TTL
  res.json(responseData);
});
exports.trackOrder=ah(async(req,res)=>{
  const order=await Order.findOne({orderNumber:req.params.orderNumber.toUpperCase()}).select("orderNumber status pricing items createdAt isPaid isDelivered deliveredAt trackingNumber trackingUrl").populate("items.product","name images slug");
  if(!order)return res.status(404).json({message:"Order not found"});
  res.json({success:true,order});
});
