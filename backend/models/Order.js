const mongoose = require("mongoose");
const orderSchema = new mongoose.Schema({
  orderNumber:{ type:String, unique:true },
  user:{ type:mongoose.Schema.Types.ObjectId, ref:"User", required:true },
  items:[{
    product:{ type:mongoose.Schema.Types.ObjectId, ref:"Product" },
    name:String,
    sku:{ type:String, default:"" },
    image:String,
    category:{ type:String, default:"" },
    gender:{ type:String, default:"" },
    price:Number,
    size:String,
    color:String,
    quantity:Number,
    // Snapshots
    mrp:{ type:Number, default:0 },
    itemDiscount:{ type:Number, default:0 },
    allocatedCouponDiscount:{ type:Number, default:0 },
    hsn:{ type:String, default:"" },
    taxRuleId:{ type:mongoose.Schema.Types.ObjectId, ref:"TaxRule", default:null },
    taxRuleVersion:{ type:String, default:"" },
    isTaxInclusive:{ type:Boolean, default:true },
    taxableValue:{ type:Number, default:0 },
    taxRate:{ type:Number, default:0 },
    cgst:{ type:Number, default:0 },
    sgst:{ type:Number, default:0 },
    igst:{ type:Number, default:0 },
    cess:{ type:Number, default:0 },
    totalTax:{ type:Number, default:0 },
    costPrice:{ type:Number, default:null },
    costPriceSource:{ type:String, enum:["actual","estimated","unknown"], default:"unknown" }
  }],
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
  totalRefundedAmount:{ type:Number, default:0 },
  refunds:[{
    refundId:{ type:String, required:true },
    gatewayRefundId:{ type:String, default:"" },
    gateway:{ type:String, default:"razorpay" },
    type:{
      type:String,
      enum:["full_cancellation","return_refund","partial_item","shipping_refund","goodwill_adjustment"],
      required:true
    },
    amount:{ type:Number, required:true, min:0 },
    refundedItems:[{
      itemIndex:Number,
      product:{ type:mongoose.Schema.Types.ObjectId, ref:"Product" },
      quantity:Number,
      amount:Number
    }],
    reason:{ type:String, default:"" },
    status:{ type:String, enum:["pending","processed","failed"], default:"processed" },
    processedAt:{ type:Date, default:Date.now },
    processedBy:{ type:mongoose.Schema.Types.ObjectId, ref:"User" }
  }],
  // --- Financial & Tax Snapshot ---
  financialSnapshot:{
    grossMerchandiseSales:{ type:Number, default:0 },
    productDiscounts:{ type:Number, default:0 },
    couponDiscounts:{ type:Number, default:0 },
    netMerchandiseSales:{ type:Number, default:0 },
    shippingRevenue:{ type:Number, default:0 },
    taxCollected:{ type:Number, default:0 },
    placeOfSupply:{ type:String, default:"" },
    isInterState:{ type:Boolean, default:false },
    totalCogs:{ type:Number, default:null },
    cogsStatus:{
      type:String,
      enum:["complete_actual","partially_estimated","fully_estimated","incomplete"],
      default:"incomplete"
    }
  },
  // --- Settlement Stubs ---
  gatewaySettlement:{
    fee:{ type:Number, default:null },
    tax:{ type:Number, default:null },
    netAmount:{ type:Number, default:null },
    settlementId:{ type:String, default:"" },
    settlementDate:{ type:Date, default:null },
    feeSource:{ type:String, enum:["actual","estimated","unknown"], default:"unknown" }
  },
  shippingSettlement:{
    actualFreightCost:{ type:Number, default:null },
    fuelSurcharge:{ type:Number, default:null },
    codHandlingFee:{ type:Number, default:null },
    rtoCost:{ type:Number, default:null },
    invoiceNumber:{ type:String, default:"" },
    reconciliationStatus:{ type:String, enum:["unreconciled","estimated","reconciled"], default:"unreconciled" }
  },
  // --- Shipping & Logistics (Delhivery) ---
  shipping: {
    courier: { type: String, default: "delhivery" },
    waybill: { type: String, default: "", index: true },
    shipmentId: { type: String, default: "" },
    pickupLocation: { type: String, default: "" },
    labelUrl: { type: String, default: "" },
    delhiveryStatus: { type: String, default: "" },
    delhiveryStatusCode: { type: String, default: "" },
    expectedDeliveryDate: { type: Date, default: null },
    packageDetails: {
      weightGrams: { type: Number, default: null },
      dimensions: {
        lengthCm: { type: Number, default: null },
        widthCm: { type: Number, default: null },
        heightCm: { type: Number, default: null }
      }
    },
    scans: [{
      status: String,
      statusCode: String,
      location: String,
      timestamp: Date,
      activity: String,
      instructions: String
    }]
  },
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
orderSchema.index({ status:1, createdAt:-1 });
orderSchema.index({ isPaid:1, createdAt:-1 });
orderSchema.index({ createdAt:-1 });
orderSchema.index({ "shippingAddress.state":1, createdAt:-1 });
orderSchema.index({ "shippingAddress.city":1, createdAt:-1 });
orderSchema.index({ "items.product":1, createdAt:-1 });
orderSchema.index({ "items.category":1, createdAt:-1 });
module.exports = mongoose.model("Order", orderSchema);
