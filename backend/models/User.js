const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const addressSchema = new mongoose.Schema({
  fullName: { 
    type: String, 
    required: [true, "Full name is required"], 
    trim: true,
    minlength: [2, "Name must be at least 2 characters"],
    maxlength: [50, "Name cannot exceed 50 characters"]
  },
  phone: { 
    type: String, 
    required: [true, "Phone number is required"],
    trim: true,
    match: [/^[+0-9- ]{10,15}$/, "Invalid phone format"]
  },
  address: { 
    type: String, 
    required: [true, "Address is required"], 
    trim: true,
    minlength: [5, "Address must be at least 5 characters"],
    maxlength: [200, "Address cannot exceed 200 characters"]
  },
  city: { 
    type: String, 
    required: [true, "City is required"], 
    trim: true,
    minlength: [2, "City must be at least 2 characters"],
    maxlength: [50, "City cannot exceed 50 characters"]
  },
  state: { 
    type: String, 
    required: [true, "State is required"], 
    trim: true,
    minlength: [2, "State must be at least 2 characters"],
    maxlength: [50, "State cannot exceed 50 characters"]
  },
  zipCode: { 
    type: String, 
    required: [true, "ZIP code is required"], 
    trim: true,
    match: [/^[A-Za-z0-9-]{5,10}$/, "Invalid ZIP code format"]
  },
  country: { 
    type: String, 
    default: "India",
    trim: true,
    minlength: [2, "Country must be at least 2 characters"],
    maxlength: [50, "Country cannot exceed 50 characters"]
  },
  isDefault: { type: Boolean, default: false }
});

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, "Name is required"], 
    trim: true,
    minlength: [2, "Name must be at least 2 characters"],
    maxlength: [50, "Name cannot exceed 50 characters"]
  },
  email: { 
    type: String, 
    required: [true, "Email is required"], 
    unique: true, 
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, "Invalid email format"]
  },
  password: { 
    type: String, 
    required: [true, "Password is required"], 
    minlength: [6, "Password must be at least 6 characters"], 
    select: false 
  },
  avatar: { type: String, default: "" }, 
  googleId: { type: String, unique: true, sparse: true },
  phone: { 
    type: String, 
    default: "",
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^[+0-9- ]{10,15}$/.test(v);
      },
      message: "Invalid phone format"
    }
  },
  role: { type: String, enum: ["user","admin"], default: "user" },
  isActive: { type: Boolean, default: true },
  addresses: [addressSchema],
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  recentlyViewed: [{ product:{ type:mongoose.Schema.Types.ObjectId, ref:"Product" }, viewedAt:{ type:Date, default:Date.now } }],
  refreshToken: { type: String, select: false },
  lastLogin: Date,
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  passwordHistory: [{ type: String }]
}, { timestamps: true });

userSchema.pre("save", async function(next) { 
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 12);
    // Keep history limited to last 3 passwords
    if (this.passwordHistory) {
      this.passwordHistory.push(this.password);
      if (this.passwordHistory.length > 3) {
        this.passwordHistory.shift();
      }
    }
  }
  next(); 
});

userSchema.methods.matchPassword = async function(pw) { 
  return bcrypt.compare(pw, this.password); 
};

userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};
module.exports = mongoose.model("User", userSchema);
