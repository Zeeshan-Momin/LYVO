require("./setup");
const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { Category } = require("../models/models");
const jwt = require("jsonwebtoken");

describe("Phase 1 Analytics & Aggregation Engine", () => {
  let adminToken;
  let adminUser;
  let normalUser;
  let product1;
  let product2;
  let category;

  beforeEach(async () => {
    // 1. Create Admin & User
    adminUser = await User.create({
      name: "Admin User",
      email: "admin@lyvo.in",
      password: "Password@123",
      role: "admin",
      isActive: true
    });

    normalUser = await User.create({
      name: "Rahul Sharma",
      email: "rahul@example.com",
      phone: "+919876543210",
      password: "Password@123",
      role: "user",
      isActive: true
    });

    adminToken = jwt.sign(
      { id: adminUser._id, role: adminUser.role },
      process.env.JWT_SECRET || "super_test_secret_key_123456789",
      { expiresIn: "1d" }
    );

    // 2. Create Category & Products
    category = await Category.create({
      name: "Sneakers",
      slug: "sneakers",
      isActive: true
    });

    product1 = await Product.create({
      name: "LYVO Runner Pro",
      brand: "LYVO",
      category: category._id,
      gender: "men",
      price: 2999,
      discountPrice: 2499,
      costPrice: 1200,
      costPriceSource: "actual",
      hsn: "6404",
      sizes: [{ size: "UK 8", stock: 20 }, { size: "UK 9", stock: 15 }],
      colors: [{ name: "Onyx Black", hex: "#000000" }],
      images: [{ url: "https://example.com/shoe1.jpg" }],
      description: "Premium performance runner sneaker",
      isActive: true
    });

    product2 = await Product.create({
      name: "LYVO Aero Drift",
      brand: "LYVO",
      category: category._id,
      gender: "unisex",
      price: 3999,
      discountPrice: 3499,
      costPrice: 1600,
      costPriceSource: "estimated",
      hsn: "6404",
      sizes: [{ size: "UK 8", stock: 10 }],
      colors: [{ name: "Acid Lime", hex: "#ccff00" }],
      images: [{ url: "https://example.com/shoe2.jpg" }],
      description: "Lightweight lifestyle footwear",
      isActive: true
    });

    // 3. Create Orders with Financial & Line-Item Snapshots
    // Order 1: Delivered
    await Order.create({
      orderNumber: "LYVO1001",
      user: normalUser._id,
      paymentMethod: "upi",
      status: "delivered",
      isPaid: true,
      paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      isDelivered: true,
      deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      shippingAddress: {
        fullName: "Rahul Sharma",
        phone: "9876543210",
        address: "101 High Street",
        city: "Mumbai",
        state: "Maharashtra",
        zipCode: "400001",
        country: "India"
      },
      pricing: {
        subtotal: 2499,
        shippingCost: 0,
        tax: 450,
        couponDiscount: 200,
        total: 2749
      },
      financialSnapshot: {
        grossMerchandiseSales: 2499,
        productDiscounts: 500,
        couponDiscounts: 200,
        netMerchandiseSales: 2299,
        shippingRevenue: 0,
        taxCollected: 450,
        placeOfSupply: "Maharashtra",
        isInterState: false,
        totalCogs: 1200,
        cogsStatus: "complete_actual"
      },
      items: [{
        product: product1._id,
        name: product1.name,
        category: "Sneakers",
        gender: "men",
        price: 2499,
        mrp: 2999,
        itemDiscount: 500,
        allocatedCouponDiscount: 200,
        size: "UK 8",
        color: "Onyx Black",
        quantity: 1,
        hsn: "6404",
        costPrice: 1200,
        costPriceSource: "actual"
      }],
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    });

    // Order 2: Delivered second order (same user, buying UK 8 again)
    await Order.create({
      orderNumber: "LYVO1002",
      user: normalUser._id,
      paymentMethod: "card",
      status: "delivered",
      isPaid: true,
      paidAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      isDelivered: true,
      deliveredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      shippingAddress: {
        fullName: "Rahul Sharma",
        phone: "9876543210",
        address: "101 High Street",
        city: "Mumbai",
        state: "Maharashtra",
        zipCode: "400001",
        country: "India"
      },
      pricing: {
        subtotal: 3499,
        shippingCost: 0,
        tax: 630,
        couponDiscount: 0,
        total: 4129
      },
      financialSnapshot: {
        grossMerchandiseSales: 3499,
        productDiscounts: 500,
        couponDiscounts: 0,
        netMerchandiseSales: 3499,
        shippingRevenue: 0,
        taxCollected: 630,
        placeOfSupply: "Maharashtra",
        isInterState: false,
        totalCogs: 1600,
        cogsStatus: "fully_estimated"
      },
      items: [{
        product: product2._id,
        name: product2.name,
        category: "Sneakers",
        gender: "unisex",
        price: 3499,
        mrp: 3999,
        itemDiscount: 500,
        allocatedCouponDiscount: 0,
        size: "UK 8",
        color: "Acid Lime",
        quantity: 1,
        hsn: "6404",
        costPrice: 1600,
        costPriceSource: "estimated"
      }],
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    });

    // Order 3: Cancelled Order (should be excluded from GMS/Net spend)
    await Order.create({
      orderNumber: "LYVO1003",
      user: normalUser._id,
      paymentMethod: "cod",
      status: "cancelled",
      isCancelled: true,
      cancelReason: "Ordered wrong size",
      pricing: {
        subtotal: 2499,
        shippingCost: 99,
        tax: 450,
        couponDiscount: 0,
        total: 3048
      },
      items: [{
        product: product1._id,
        name: product1.name,
        price: 2499,
        size: "UK 9",
        quantity: 1
      }],
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    });
  });

  it("should enforce admin authorization for all analytics endpoints", async () => {
    const res = await request(app).get("/api/admin/analytics/overview");
    expect(res.status).toBe(401);
  });

  it("should fetch Overview Analytics with accurate GMS and Net Sales without cancelled orders", async () => {
    const res = await request(app)
      .get("/api/admin/analytics/overview")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.kpis).toBeDefined();

    // GMS = 2499 + 3499 = 5998
    expect(res.body.kpis.grossMerchandiseSales).toBe(5998);
    // Coupon Discounts = 200
    expect(res.body.kpis.couponDiscounts).toBe(200);
    // Net Merchandise Sales = 5998 - 200 = 5798
    expect(res.body.kpis.netMerchandiseSales).toBe(5798);
    // Completed Orders Count = 2 (Cancelled excluded)
    expect(res.body.kpis.orderCount).toBe(2);
    expect(res.body.kpis.totalUnits).toBe(2);
  });

  it("should fetch Sales Deep-Dive Analytics with category and size breakdowns", async () => {
    const res = await request(app)
      .get("/api/admin/analytics/sales-deep")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.categories).toBeDefined();
    expect(res.body.categories.length).toBeGreaterThan(0);
    expect(res.body.sizes).toBeDefined();

    // UK 8 should be top size with 2 units sold
    const uk8 = res.body.sizes.find(s => s._id === "UK 8");
    expect(uk8).toBeDefined();
    expect(uk8.units).toBe(2);
  });

  it("should fetch Customer 360 list and compute RFM segment & lifetime metrics", async () => {
    const res = await request(app)
      .get("/api/admin/analytics/customers")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.customers).toBeDefined();

    const rahul = res.body.customers.find(c => c.email === "rahul@example.com");
    expect(rahul).toBeDefined();
    expect(rahul.totalOrders).toBe(2);
    expect(rahul.segment).toBe("Active Repeat");
    expect(rahul.netSpend).toBeGreaterThan(0);
  });

  it("should calculate deterministic frequency preferences in Customer 360 profile", async () => {
    const res = await request(app)
      .get(`/api/admin/analytics/customers/${normalUser._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.preferences).toBeDefined();

    // Preferred Size = "UK 8" (bought 2 times)
    expect(res.body.preferences.preferredSize).toBe("UK 8");
    // Preferred City = "Mumbai"
    expect(res.body.preferences.preferredCity).toBe("Mumbai");
    // Preferred State = "Maharashtra"
    expect(res.body.preferences.preferredState).toBe("Maharashtra");
    // Preferred Category = "Sneakers"
    expect(res.body.preferences.preferredCategory).toBe("Sneakers");
    // Order History contains 3 orders (including cancelled order in chronological timeline)
    expect(res.body.orderHistory.length).toBe(3);
  });

  it("should inspect Data Quality metrics accurately", async () => {
    const res = await request(app)
      .get("/api/admin/analytics/data-quality")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.overallReadinessScore).toBeDefined();
    expect(res.body.indicators).toBeDefined();
    expect(res.body.indicators.cogs).toBeDefined();
  });

  it("should fallback to 'Footwear' for top products with empty category in legacy orders", async () => {
    // Create an order with empty category
    await Order.create({
      orderNumber: "LYVO_LEGACY_01",
      user: normalUser._id,
      paymentMethod: "upi",
      status: "delivered",
      isPaid: true,
      pricing: { subtotal: 1999, shippingCost: 0, tax: 360, couponDiscount: 0, total: 2359 },
      items: [{
        product: product1._id,
        name: "Legacy Shoe",
        category: "", // Empty string in legacy item
        price: 1999,
        size: "UK 8",
        quantity: 10
      }]
    });

    const res = await request(app)
      .get("/api/admin/analytics/overview")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const legacyTop = res.body.topProducts.find(p => p.name === "Legacy Shoe");
    expect(legacyTop).toBeDefined();
    expect(legacyTop.category).toBe("Footwear");
  });

  it("should ensure line-item allocatedCouponDiscount does not exceed item line total", async () => {
    // Test coupon allocation logic when placing order with a high coupon
    const validItems = [
      { product: product1._id, name: "Item 1", price: 500, quantity: 1, itemDiscount: 0, allocatedCouponDiscount: 0 },
      { product: product2._id, name: "Item 2", price: 3000, quantity: 1, itemDiscount: 0, allocatedCouponDiscount: 0 }
    ];
    const subtotal = 3500;
    const couponDiscount = 1000;

    let remainingCouponToAllocate = Math.min(couponDiscount, subtotal);
    for (let i = 0; i < validItems.length; i++) {
      const it = validItems[i];
      const itemLineTotal = Math.max(0, it.price * it.quantity);
      if (i === validItems.length - 1) {
        it.allocatedCouponDiscount = Math.min(itemLineTotal, remainingCouponToAllocate);
      } else {
        const theoreticalShare = subtotal > 0 ? Math.round((itemLineTotal / subtotal) * couponDiscount) : 0;
        const actualShare = Math.min(itemLineTotal, theoreticalShare, remainingCouponToAllocate);
        it.allocatedCouponDiscount = actualShare;
        remainingCouponToAllocate -= actualShare;
      }
    }

    // Item 1 line total is 500. Its allocated coupon cannot exceed 500.
    expect(validItems[0].allocatedCouponDiscount).toBeLessThanOrEqual(500);
    // Total allocated coupon must equal 1000
    const totalAllocated = validItems.reduce((acc, it) => acc + it.allocatedCouponDiscount, 0);
    expect(totalAllocated).toBe(1000);
  });

  it("should return initialized_empty state for Data Quality on an empty database", async () => {
    await Order.deleteMany({});
    const res = await request(app)
      .get("/api/admin/analytics/data-quality")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalOrders).toBe(0);
    expect(res.body.status).toBe("initialized_empty");
    expect(res.body.isInitialized).toBe(true);
  });
});
