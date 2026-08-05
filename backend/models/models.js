const mongoose = require("mongoose");
const categorySchema = new mongoose.Schema({ 
  name: { 
    type: String, 
    required: [true, "Category name is required"], 
    unique: true, 
    trim: true,
    minlength: [2, "Category name must be at least 2 characters"],
    maxlength: [50, "Category name cannot exceed 50 characters"]
  }, 
  slug: { type: String, unique: true }, 
  description: { type: String, default: "" }, 
  icon: { type: String, default: "" }, 
  isActive: { type: Boolean, default: true }, 
  sortOrder: { type: Number, default: 0 } 
}, { timestamps: true });

categorySchema.pre("save", function(next) { if (this.isModified("name")&&!this.slug) this.slug=this.name.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,""); next(); });
const Category = mongoose.model("Category", categorySchema);

const reviewSchema = new mongoose.Schema({ 
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: [true, "Product is required"] }, 
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: [true, "User is required"] }, 
  rating: { 
    type: Number, 
    required: [true, "Rating is required"], 
    min: [1, "Rating must be at least 1"], 
    max: [5, "Rating cannot exceed 5"] 
  }, 
  title: { 
    type: String, 
    required: [true, "Review title is required"],
    trim: true,
    minlength: [2, "Review title must be at least 2 characters"],
    maxlength: [100, "Review title cannot exceed 100 characters"]
  }, 
  comment: { 
    type: String, 
    required: [true, "Review body comment is required"],
    trim: true,
    minlength: [5, "Review body must be at least 5 characters"],
    maxlength: [1000, "Review body cannot exceed 1000 characters"]
  }, 
  isVerifiedPurchase: { type: Boolean, default: false }, 
  helpfulCount: { type: Number, default: 0, min: 0 }, 
  isActive: { type: Boolean, default: true } 
}, { timestamps: true });

reviewSchema.index({ product:1, user:1 }, { unique:true });
reviewSchema.statics.calcAverageRatings = async function(productId) {
  const r = await this.aggregate([{ $match:{ product:productId, isActive:true } }, { $group:{ _id:"$product", average:{ $avg:"$rating" }, count:{ $sum:1 } } }]);
  await mongoose.model("Product").findByIdAndUpdate(productId, { "ratings.average":r[0]?Math.round(r[0].average*10)/10:0, "ratings.count":r[0]?.count||0 });
};
reviewSchema.post("save", function() { this.constructor.calcAverageRatings(this.product); });
const Review = mongoose.model("Review", reviewSchema);

const couponSchema = new mongoose.Schema({ 
  code: { 
    type: String, 
    required: [true, "Coupon code is required"], 
    unique: true, 
    uppercase: true, 
    trim: true,
    match: [/^[A-Z0-9]{3,15}$/, "Coupon code must be 3-15 uppercase alphanumeric characters"] 
  }, 
  description: { type: String, default: "" }, 
  type: { type: String, enum: { values: ["percentage", "fixed"], message: "Invalid coupon type" }, required: [true, "Coupon type is required"] }, 
  value: { 
    type: Number, 
    required: [true, "Coupon value is required"], 
    min: [0, "Coupon value cannot be negative"] 
  }, 
  minPurchase: { type: Number, default: 0, min: [0, "Minimum purchase cannot be negative"] }, 
  maxDiscount: { type: Number, default: 0, min: [0, "Maximum discount cannot be negative"] }, 
  usageLimit: { type: Number, default: 0, min: [0, "Usage limit cannot be negative"] }, 
  usedCount: { type: Number, default: 0, min: [0, "Used count cannot be negative"] }, 
  perUserLimit: { type: Number, default: 1, min: [1, "Per user limit must be at least 1"] }, 
  usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], 
  expiryDate: { type: Date, required: [true, "Expiry date is required"] }, 
  isActive: { type: Boolean, default: true }, 
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" } 
}, { timestamps: true });

const Coupon = mongoose.model("Coupon", couponSchema);
module.exports = { Category, Review, Coupon };
