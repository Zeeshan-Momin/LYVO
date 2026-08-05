const mongoose = require("mongoose");
const orderSchema = new mongoose.Schema({
  orderNumber:{ type:String, unique:true },
  user:{ type:mongoose.Schema.Types.ObjectId, ref:"User", required:true },
  items:[{ product:{ type:mongoose.Schema.Types.ObjectId, ref:"Product" }, name:String, image:String, price:Number, size:String, color:String, quantity:Number }],
  shippingAddress:{ fullName:String, phone:String, address:String, city:String, state:String, zipCode:String, country:String },
  paymentMethod:{ type:String, enum:["card","upi","cod","wallet","netbanking"], required:true },
  pricing:{ subtotal:Number, shippingCost:{ type:Number, default:0 }, tax:{ type:Number, default:0 }, couponDiscount:{ type:Number, default:0 }, total:Number },
  couponCode:{ type:String, default:"" },
  status:{ type:String, enum:["pending","confirmed","processing","shipped","delivered","cancelled","return_requested","returned","refunded"], default:"pending" },
  statusHistory:[{ status:String, note:String, updatedAt:{ type:Date, default:Date.now }, updatedBy:{ type:mongoose.Schema.Types.ObjectId, ref:"User" } }],
  trackingNumber:{ type:String, default:"" }, trackingUrl:{ type:String, default:"" },
  isPaid:{ type:Boolean, default:false }, paidAt:Date,
  isDelivered:{ type:Boolean, default:false }, deliveredAt:Date,
  isCancelled:{ type:Boolean, default:false }, cancelReason:{ type:String, default:"" },
  // --- Razorpay payment tracking ---
  razorpayOrderId:{ type:String, default:"" },
  razorpayPaymentId:{ type:String, default:"" },
  razorpaySignature:{ type:String, default:"" },
  // --- Return request (post-delivery), separate from pre-shipping cancellation ---
  returnRequest:{
    reason:String, comment:{ type:String, default:"" },
    requestedAt:Date, status:{ type:String, enum:["pending","approved","rejected"] },
    resolvedAt:Date, resolvedBy:{ type:mongoose.Schema.Types.ObjectId, ref:"User" },
  },
  // --- Refund tracking (cancellation or approved return of a paid order) ---
  isRefunded:{ type:Boolean, default:false }, refundedAt:Date, razorpayRefundId:{ type:String, default:"" },
}, { timestamps:true });
orderSchema.pre("save", async function(next) {
  if (!this.orderNumber) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(100 + Math.random() * 900).toString();
    this.orderNumber = "LYVO" + timestamp + random;
  }
  next();
});
orderSchema.index({ user:1, createdAt:-1 }); 
orderSchema.index({ status:1 });
orderSchema.index({ createdAt:-1 });
module.exports = mongoose.model("Order", orderSchema);
