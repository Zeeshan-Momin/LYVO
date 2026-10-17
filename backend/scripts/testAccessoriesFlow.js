require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Product = require("../models/Product");
const { Category, Coupon } = require("../models/models");
const { computePricing } = require("../utils/pricing");

async function testFlow() {
  await connectDB();
  console.log("==================================================");
  console.log("   LYVO ACCESSORIES E2E INTEGRATION & FLOW TEST   ");
  console.log("==================================================");

  // 1. Verify Database Products
  const products = await Product.find({
    name: {
      $in: [
        "Classic Black Leather Belt",
        "Reversible Brown-Black Belt",
        "Black Cotton Crew Socks (Pack of 3)",
        "White Ankle Socks (Pack of 3)"
      ]
    }
  }).populate("category", "name slug");

  console.log(`\n1. Database Products Verification (Found: ${products.length}/4):`);
  products.forEach(p => {
    const totalStock = p.sizes.reduce((sum, s) => sum + s.stock, 0);
    console.log(`   ✓ [${p.category?.name}] ${p.name}`);
    console.log(`     - MRP: ₹${p.price}, Selling Price: ₹${p.discountPrice} (Discount: ${p.discountPercent}%)`);
    console.log(`     - Colors: ${p.colors.map(c => c.name).join(", ")}`);
    console.log(`     - Sizes: ${p.sizes.map(s => `${s.size} (${s.stock} in stock)`).join(", ")} | Total Stock: ${totalStock}`);
    console.log(`     - Image: ${p.images?.[0]?.url}`);
  });

  if (products.length < 4) {
    throw new Error(`Expected 4 accessories in database, found ${products.length}`);
  }

  // 2. Test Cart & Order Pricing Calculation with Accessories
  console.log("\n2. Testing Cart & Checkout Pricing Engine with Accessory Items:");
  const belt1 = products.find(p => p.name === "Classic Black Leather Belt");
  const socks1 = products.find(p => p.name === "Black Cotton Crew Socks (Pack of 3)");
  const belt2 = products.find(p => p.name === "Reversible Brown-Black Belt");
  const socks2 = products.find(p => p.name === "White Ankle Socks (Pack of 3)");

  // Scenario A: Purchasing 1 Belt (size 32) + 2 Packs of Socks (Free Size)
  const cartItems = [
    {
      product: belt1,
      size: "32",
      color: belt1.colors[0]?.name || "Black",
      quantity: 1,
      price: belt1.discountPrice || belt1.price,
      mrp: belt1.price
    },
    {
      product: socks1,
      size: "Free Size",
      color: socks1.colors[0]?.name || "Black",
      quantity: 2,
      price: socks1.discountPrice || socks1.price,
      mrp: socks1.price
    }
  ];

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalMrp = cartItems.reduce((sum, item) => sum + item.mrp * item.quantity, 0);
  console.log(`   - Item 1: ${cartItems[0].product.name} (Size: ${cartItems[0].size}) x ${cartItems[0].quantity} = ₹${cartItems[0].price * cartItems[0].quantity}`);
  console.log(`   - Item 2: ${cartItems[1].product.name} (Size: ${cartItems[1].size}) x ${cartItems[1].quantity} = ₹${cartItems[1].price * cartItems[1].quantity}`);
  console.log(`   - Cart Subtotal: ₹${subtotal} (Total MRP: ₹${totalMrp}, Total Product Discount: ₹${totalMrp - subtotal})`);

  // Calculate Order Pricing with Coupon using server authoritative computePricing
  const pricingItems = [
    { product: belt1._id, size: "32", color: "Black", quantity: 1 },
    { product: socks1._id, size: "Free Size", color: "Black", quantity: 2 }
  ];
  const pricingResult = await computePricing(pricingItems, "LYVO10");
  console.log("\n   Checkout Pricing Breakdown (Server computePricing):");
  console.log(`   - Merchandise Subtotal: ₹${pricingResult.subtotal}`);
  console.log(`   - Coupon Discount (LYVO10): ₹${pricingResult.couponDiscount}`);
  console.log(`   - Shipping Fee: ₹${pricingResult.shippingCost} (Free for subtotal >= ₹999)`);
  console.log(`   - Tax (18% GST): ₹${pricingResult.tax}`);
  console.log(`   - Final Order Total: ₹${pricingResult.total}`);
  console.log(`   - Validated Items: ${pricingResult.validItems.length} items`);
  pricingResult.validItems.forEach(vi => {
    console.log(`     * ${vi.name} [${vi.category}] | Size: ${vi.size} | Qty: ${vi.quantity} | Unit Price: ₹${vi.price} | MRP: ₹${vi.mrp}`);
  });

  // 3. Stock Validation Test
  console.log("\n3. Testing Size & Stock Validation:");
  // Check size 32 stock on belt1
  const size32 = belt1.sizes.find(s => s.size === "32");
  console.log(`   - Belt size '32' stock available: ${size32?.stock}`);
  if (!size32 || size32.stock < 10) throw new Error("Belt size 32 stock mismatch");

  // Check Free Size stock on socks1
  const freeSize = socks1.sizes.find(s => s.size === "Free Size");
  console.log(`   - Socks size 'Free Size' stock available: ${freeSize?.stock}`);
  if (!freeSize || freeSize.stock < 25) throw new Error("Socks Free Size stock mismatch");

  // 4. Admin Editability Verification
  console.log("\n4. Testing Admin Product Edit Simulation:");
  const testEditProduct = await Product.findById(belt2._id);
  const originalDesc = testEditProduct.shortDescription;
  testEditProduct.shortDescription = "Updated description for admin editability verification.";
  await testEditProduct.save();
  const refreshed = await Product.findById(belt2._id);
  console.log(`   - Admin update succeeded. Updated shortDescription: "${refreshed.shortDescription}"`);
  // Restore original
  refreshed.shortDescription = originalDesc;
  await refreshed.save();
  console.log(`   - Restored original description.`);

  console.log("\n==================================================");
  console.log("   ALL ACCESSORY VERIFICATION CHECKS PASSED!     ");
  console.log("==================================================");
  process.exit(0);
}

testFlow().catch(err => {
  console.error("Test flow failed:", err);
  process.exit(1);
});
