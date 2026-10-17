require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Product = require("../models/Product");
const { Category } = require("../models/models");

async function check() {
  await connectDB();
  console.log("Connected to MongoDB:", mongoose.connection.name, "at host:", mongoose.connection.host);

  const categories = await Category.find({});
  console.log("Existing Categories:", categories.map(c => ({ id: c._id, name: c.name, slug: c.slug })));

  const beltsCategory = categories.find(c => c.slug === "belts" || c.name.toLowerCase() === "belts");
  const socksCategory = categories.find(c => c.slug === "socks" || c.name.toLowerCase() === "socks");

  console.log("Belts Category found:", beltsCategory ? beltsCategory._id : "NO");
  console.log("Socks Category found:", socksCategory ? socksCategory._id : "NO");

  const products = await Product.find({}).populate("category", "name slug");
  console.log("Total products count:", products.length);
  console.log("Products in DB:", products.map(p => ({
    id: p._id,
    name: p.name,
    category: p.category ? { name: p.category.name, slug: p.category.slug } : p.category,
    price: p.price,
    discountPrice: p.discountPrice,
    sizes: p.sizes,
    colors: p.colors
  })));

  process.exit(0);
}

check().catch(err => {
  console.error("Error checking DB:", err);
  process.exit(1);
});
