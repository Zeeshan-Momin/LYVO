const mongoose = require("mongoose");
const productSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, "Product name is required"], 
    trim: true,
    minlength: [2, "Name must be at least 2 characters"],
    maxlength: [100, "Name cannot exceed 100 characters"]
  },
  slug: { type: String, unique: true, lowercase: true },
  description: { 
    type: String, 
    required: [true, "Description is required"],
    trim: true,
    minlength: [10, "Description must be at least 10 characters"]
  },
  shortDescription: { type: String, trim: true },
  brand: { 
    type: String, 
    required: [true, "Brand is required"], 
    trim: true,
    minlength: [2, "Brand must be at least 2 characters"],
    maxlength: [50, "Brand cannot exceed 50 characters"]
  },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: [true, "Category is required"] },
  gender: { type: String, enum: { values: ["men", "women", "unisex", "kids"], message: "Invalid gender category" }, required: [true, "Gender is required"] },
  price: { 
    type: Number, 
    required: [true, "Price is required"], 
    min: [0, "Price cannot be negative"] 
  },
  discountPrice: { 
    type: Number, 
    default: 0,
    min: [0, "Discount price cannot be negative"],
    validate: {
      validator: function(val) {
        return val <= this.price;
      },
      message: "Discount price must be less than or equal to original price"
    }
  },
  discountPercent: { type: Number, default: 0 },
  images: [{ 
    url: { type: String, required: true }, 
    publicId: { type: String, default: "" }, 
    alt: { type: String, default: "" } 
  }],
  colors: [{ 
    name: { type: String, required: true, trim: true }, 
    hex: { 
      type: String, 
      required: true,
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color format"] 
    } 
  }],
  sizes: [{ 
    size: { type: String, required: true, trim: true }, 
    stock: { type: Number, default: 0, min: [0, "Stock cannot be negative"] } 
  }],
  totalStock: { type: Number, default: 0 },
  tags: [{ type: String, trim: true }],
  features: [{ type: String, trim: true }],
  ratings: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0, min: 0 }
  },
  isFeatured: { type: Boolean, default: false },
  isNew: { type: Boolean, default: true },
  isBestSeller: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  views: { type: Number, default: 0, min: 0 },
  soldCount: { type: Number, default: 0, min: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, toJSON: { virtuals: true } });
productSchema.virtual("inStock").get(function() { return this.totalStock > 0; });
productSchema.virtual("effectivePrice").get(function() { return this.discountPrice || this.price; });
productSchema.pre("save", function(next) {
  if (this.isModified("name") && !this.slug) this.slug = this.name.toLowerCase().replace(/[^a-z0-9 ]/g,"").replace(/\s+/g,"-") + "-" + Date.now();
  if (this.isModified("sizes")) this.totalStock = this.sizes.reduce((s,sz)=>s+sz.stock,0);
  if (this.price>0&&this.discountPrice>0) this.discountPercent = Math.round((this.price-this.discountPrice)/this.price*100);
  next();
});
productSchema.index({ name:"text", description:"text", brand:"text", tags:"text" });
productSchema.index({ category:1, isActive:1 }); 
productSchema.index({ isFeatured:1, isActive:1 });
productSchema.index({ name:1, isActive:1 });
productSchema.index({ brand:1, isActive:1 });
productSchema.index({ price:1, isActive:1 });
productSchema.index({ gender:1, isActive:1 });
productSchema.index({ createdAt:-1, isActive:1 });
module.exports = mongoose.model("Product", productSchema);
