require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Product = require("../models/Product");
const User = require("../models/User");
const { Category } = require("../models/models");

async function seedAccessories() {
  await connectDB();
  console.log("Connected to MongoDB:", mongoose.connection.name);

  // Find admin user for createdBy
  let admin = await User.findOne({ role: "admin" });
  if (!admin) {
    admin = await User.findOne();
  }

  // 1. Ensure Belts and Socks categories exist
  let beltsCategory = await Category.findOne({ slug: "belts" });
  if (!beltsCategory) {
    beltsCategory = await Category.create({
      name: "Belts",
      slug: "belts",
      icon: "🥋",
      isActive: true,
      sortOrder: 6
    });
    console.log("Created Category: Belts ->", beltsCategory._id);
  } else {
    console.log("Belts Category already exists ->", beltsCategory._id);
  }

  let socksCategory = await Category.findOne({ slug: "socks" });
  if (!socksCategory) {
    socksCategory = await Category.create({
      name: "Socks",
      slug: "socks",
      icon: "🧦",
      isActive: true,
      sortOrder: 7
    });
    console.log("Created Category: Socks ->", socksCategory._id);
  } else {
    console.log("Socks Category already exists ->", socksCategory._id);
  }

  // 2. Define the 4 target products
  const productsToSeed = [
    {
      name: "Classic Black Leather Belt",
      brand: "LYVO",
      category: beltsCategory._id,
      gender: "unisex",
      price: 999, // MRP
      discountPrice: 799, // Selling Price
      description: "Timeless classic black genuine leather belt crafted for durability and comfort. Features sleek brushed alloy buckle with beveled edges.",
      shortDescription: "Genuine leather belt with brushed alloy buckle.",
      images: [
        {
          url: "https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=800&auto=format&fit=crop&q=80",
          alt: "Classic Black Leather Belt",
          isPrimary: true
        }
      ],
      colors: [
        { name: "Black", hex: "#111111" }
      ],
      sizes: [
        { size: "30", stock: 10 },
        { size: "32", stock: 10 },
        { size: "34", stock: 10 },
        { size: "36", stock: 10 },
        { size: "38", stock: 10 }
      ],
      tags: ["belt", "leather", "accessories", "black"],
      features: ["Genuine Full-Grain Leather", "Brushed Alloy Buckle", "5-Hole Adjustable Fit"],
      isFeatured: true,
      isNew: true,
      isActive: true,
      createdBy: admin ? admin._id : undefined
    },
    {
      name: "Reversible Brown-Black Belt",
      brand: "LYVO",
      category: beltsCategory._id,
      gender: "unisex",
      price: 1099, // MRP
      discountPrice: 899, // Selling Price
      description: "Versatile 2-in-1 reversible leather belt that easily twists between rich Cognac Brown and Midnight Black. Ideal for both formal and casual wear.",
      shortDescription: "2-in-1 reversible leather belt with twist buckle.",
      images: [
        {
          url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80",
          alt: "Reversible Brown-Black Belt",
          isPrimary: true
        }
      ],
      colors: [
        { name: "Brown", hex: "#7B3F00" },
        { name: "Black", hex: "#111111" }
      ],
      sizes: [
        { size: "30", stock: 10 },
        { size: "32", stock: 10 },
        { size: "34", stock: 10 },
        { size: "36", stock: 10 },
        { size: "38", stock: 10 }
      ],
      tags: ["belt", "reversible", "accessories", "brown", "black"],
      features: ["360-degree Twist Reversible Buckle", "Premium Bonded Leather", "Two Styling Colors in One"],
      isFeatured: true,
      isBestSeller: true,
      isActive: true,
      createdBy: admin ? admin._id : undefined
    },
    {
      name: "Black Cotton Crew Socks (Pack of 3)",
      brand: "LYVO",
      category: socksCategory._id,
      gender: "unisex",
      price: 399, // MRP
      discountPrice: 299, // Selling Price
      description: "Pack of 3 high-performance black crew socks made from combed breathable cotton. Engineered with zonal heel-and-toe cushioning and arch compression band.",
      shortDescription: "Combed cotton crew socks with arch support (3-Pack).",
      images: [
        {
          url: "https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=800&auto=format&fit=crop&q=80",
          alt: "Black Cotton Crew Socks (Pack of 3)",
          isPrimary: true
        }
      ],
      colors: [
        { name: "Black", hex: "#111111" }
      ],
      sizes: [
        { size: "Free Size", stock: 25 }
      ],
      tags: ["socks", "crew", "cotton", "pack of 3", "black"],
      features: ["80% Combed Cotton, 18% Polyamide, 2% Elastane", "Reinforced Heel & Toe", "Moisture-Wicking Ribbed Knit"],
      isFeatured: true,
      isNew: true,
      isActive: true,
      createdBy: admin ? admin._id : undefined
    },
    {
      name: "White Ankle Socks (Pack of 3)",
      brand: "LYVO",
      category: socksCategory._id,
      gender: "unisex",
      price: 349, // MRP
      discountPrice: 249, // Selling Price
      description: "Pack of 3 ultra-breathable white ankle socks designed for athletic training and casual footwear. Low-profile fit with anti-slip heel grip.",
      shortDescription: "Low-profile breathable white ankle socks (3-Pack).",
      images: [
        {
          url: "https://images.unsplash.com/photo-1582966772680-860e372bb558?w=800&auto=format&fit=crop&q=80",
          alt: "White Ankle Socks (Pack of 3)",
          isPrimary: true
        }
      ],
      colors: [
        { name: "White", hex: "#FFFFFF" }
      ],
      sizes: [
        { size: "Free Size", stock: 25 }
      ],
      tags: ["socks", "ankle", "cotton", "pack of 3", "white"],
      features: ["Breathable Mesh Top", "Anti-Slip Y-Heel Construction", "Seamless Toe Closure"],
      isFeatured: true,
      isBestSeller: true,
      isActive: true,
      createdBy: admin ? admin._id : undefined
    }
  ];

  for (const item of productsToSeed) {
    const existing = await Product.findOne({ name: item.name });
    if (existing) {
      console.log(`Product "${item.name}" already exists (${existing._id}). Updating attributes...`);
      existing.price = item.price;
      existing.discountPrice = item.discountPrice;
      existing.category = item.category;
      existing.colors = item.colors;
      existing.sizes = item.sizes;
      existing.images = item.images;
      existing.description = item.description;
      existing.shortDescription = item.shortDescription;
      existing.features = item.features;
      existing.tags = item.tags;
      existing.isActive = true;
      await existing.save();
      console.log(`Updated "${item.name}" successfully.`);
    } else {
      const created = await Product.create(item);
      console.log(`Created new product "${item.name}" -> ID: ${created._id}`);
    }
  }

  console.log("All test accessory products ensured in database!");
  process.exit(0);
}

seedAccessories().catch(err => {
  console.error("Error seeding accessories:", err);
  process.exit(1);
});
