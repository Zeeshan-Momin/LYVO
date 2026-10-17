require("./setup");
const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { Category } = require("../models/models");
const jwt = require("jsonwebtoken");

describe("Phase 2 BI & Operational Analytics Suite", () => {
  let adminUser;
  let adminToken;
  let normalUser;
  let normalToken;
  let categorySneakers;
  let categoryLoafers;
  let testProduct1;
  let testProduct2;
  let testProductUnknownCost;
  let testOrder1;
  let testOrder2;
  let testOrderReturned;
  let testOrderCancelled;

  beforeEach(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Category.deleteMany({});

    // Create Admin User
    adminUser = await User.create({
      name: "Admin User",
      email: "admin@lyvo.in",
      password: "Password@123",
      role: "admin",
      isActive: true
    });
    adminToken = jwt.sign(
      { id: adminUser._id },
      process.env.JWT_SECRET || "super_test_secret_key_123456789",
      { expiresIn: "1d" }
    );

    // Create Normal User
    normalUser = await User.create({
      name: "Customer One",
      email: "customer@example.com",
      password: "Password@123",
      role: "user",
      isActive: true
    });
    normalToken = jwt.sign(
      { id: normalUser._id },
      process.env.JWT_SECRET || "super_test_secret_key_123456789",
      { expiresIn: "1d" }
    );

    // Create Categories
    categorySneakers = await Category.create({
      name: "Sneakers",
      slug: "sneakers",
      isActive: true
    });

    categoryLoafers = await Category.create({
      name: "Loafers",
      slug: "loafers",
      isActive: true
    });

    // 1. Product with Verified Actual Cost
    testProduct1 = await Product.create({
      name: "LYVO Stealth Runner",
      brand: "LYVO",
      sku: "LYVO-STR-BLK-42",
      hsn: "64041990",
      description: "Stealth performance runners",
      price: 2499,
      costPrice: 900,
      costPriceSource: "actual",
      category: categorySneakers._id,
      gender: "men",
      colors: [{ name: "Black", hex: "#000000" }],
      sizes: [
        { size: "8", stock: 10 },
        { size: "9", stock: 15 },
        { size: "10", stock: 5 }
      ],
      images: [{ url: "https://example.com/img1.jpg" }],
      soldCount: 12,
      isActive: true
    });

    // 2. Product with Estimated Cost (low stock: 3 units)
    testProduct2 = await Product.create({
      name: "LYVO Urban Loafer",
      brand: "LYVO",
      sku: "LYVO-UL-BRN-41",
      hsn: "64039990",
      description: "Urban handcrafted loafers",
      price: 1899,
      costPrice: 700,
      costPriceSource: "estimated",
      category: categoryLoafers._id,
      gender: "men",
      colors: [{ name: "Brown", hex: "#8B4513" }],
      sizes: [
        { size: "8", stock: 2 },
        { size: "9", stock: 1 }
      ],
      images: [{ url: "https://example.com/img2.jpg" }],
      soldCount: 8,
      isActive: true
    });

    // 3. Product with Unknown / Null Cost
    testProductUnknownCost = await Product.create({
      name: "LYVO Prototype Slide",
      brand: "LYVO",
      sku: "LYVO-SLD-WHT-40",
      hsn: "64041990",
      description: "Prototype slides pending procurement bill",
      price: 999,
      costPrice: null,
      costPriceSource: "unknown",
      category: categorySneakers._id,
      gender: "unisex",
      colors: [{ name: "White", hex: "#FFFFFF" }],
      sizes: [{ size: "8", stock: 10 }],
      images: [{ url: "https://example.com/img3.jpg" }],
      soldCount: 0,
      isActive: true
    });

    // Order 1: Completed Delivered Order with Snapshots & Delhivery shipping
    testOrder1 = await Order.create({
      orderNumber: "LYVO-2026-001",
      user: normalUser._id,
      items: [
        {
          product: testProduct1._id,
          name: testProduct1.name,
          sku: testProduct1.sku,
          price: 2499,
          quantity: 2,
          size: "9",
          color: "Black",
          image: "https://example.com/img1.jpg",
          itemDiscount: 200,
          allocatedCouponDiscount: 100,
          costPrice: 900,
          costPriceSource: "actual",
          category: "Sneakers",
          gender: "men",
          hsn: "64041990"
        }
      ],
      shippingAddress: {
        fullName: "Customer One",
        phone: "9876543210",
        address: "123 Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        zipCode: "560038",
        country: "India"
      },
      pricing: {
        subtotal: 4998,
        shippingCost: 0,
        couponDiscount: 100,
        tax: 0,
        total: 4498
      },
      paymentMethod: "card",
      shipping: {
        courier: "Delhivery",
        waybill: "123456789012",
        status: "delivered",
        delhiveryStatus: "Delivered",
        deliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      status: "delivered",
      isPaid: true,
      paidAt: new Date(),
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    });

    // Order 2: In-Transit COD Order
    testOrder2 = await Order.create({
      orderNumber: "LYVO-2026-002",
      user: normalUser._id,
      items: [
        {
          product: testProduct2._id,
          name: testProduct2.name,
          sku: testProduct2.sku,
          price: 1899,
          quantity: 1,
          size: "8",
          color: "Brown",
          image: "https://example.com/img2.jpg",
          itemDiscount: 0,
          allocatedCouponDiscount: 0,
          costPrice: 700,
          costPriceSource: "estimated",
          category: "Loafers",
          gender: "men",
          hsn: "64039990"
        }
      ],
      shippingAddress: {
        fullName: "Customer One",
        phone: "9876543210",
        address: "456 Bandra West",
        city: "Mumbai",
        state: "Maharashtra",
        zipCode: "400050",
        country: "India"
      },
      pricing: {
        subtotal: 1899,
        shippingCost: 99,
        couponDiscount: 0,
        tax: 0,
        total: 1998
      },
      paymentMethod: "cod",
      shipping: {
        courier: "Delhivery",
        waybill: "987654321098",
        status: "in_transit",
        delhiveryStatus: "In Transit"
      },
      status: "shipped",
      isPaid: false,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    });

    // Order 3: Returned & Refunded Order
    testOrderReturned = await Order.create({
      orderNumber: "LYVO-2026-003",
      user: normalUser._id,
      items: [
        {
          product: testProduct1._id,
          name: testProduct1.name,
          sku: testProduct1.sku,
          price: 2499,
          quantity: 1,
          size: "10",
          color: "Black",
          itemDiscount: 0,
          allocatedCouponDiscount: 0,
          costPrice: 900,
          costPriceSource: "actual",
          category: "Sneakers",
          gender: "men"
        }
      ],
      shippingAddress: {
        fullName: "Customer One",
        phone: "9876543210",
        address: "123 Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        zipCode: "560038",
        country: "India"
      },
      pricing: {
        subtotal: 2499,
        shippingCost: 0,
        couponDiscount: 0,
        tax: 0,
        total: 2499
      },
      paymentMethod: "upi",
      shipping: {
        courier: "Delhivery",
        waybill: "112233445566",
        status: "delivered",
        delhiveryStatus: "Delivered"
      },
      returnRequest: {
        reason: "Size too small",
        requestedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        status: "approved",
        resolvedAt: new Date()
      },
      isRefunded: true,
      refundedAt: new Date(),
      totalRefundedAmount: 2499,
      refunds: [
        {
          refundId: "ref_test_001",
          type: "return_refund",
          amount: 2499,
          reason: "Size too small",
          status: "processed",
          processedAt: new Date()
        }
      ],
      status: "refunded",
      isPaid: true,
      paidAt: new Date(),
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    });

    // Order 4: Pre-dispatch Cancelled Order (Must be strictly excluded from Sales/Product analytics)
    testOrderCancelled = await Order.create({
      orderNumber: "LYVO-2026-004",
      user: normalUser._id,
      items: [
        {
          product: testProduct1._id,
          name: testProduct1.name,
          sku: testProduct1.sku,
          price: 2499,
          quantity: 5,
          size: "9",
          color: "Black",
          costPrice: 900,
          costPriceSource: "actual",
          category: "Sneakers",
          gender: "men"
        }
      ],
      shippingAddress: {
        fullName: "Customer One",
        phone: "9876543210",
        address: "123 Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        zipCode: "560038",
        country: "India"
      },
      pricing: {
        subtotal: 12495,
        shippingCost: 0,
        couponDiscount: 0,
        tax: 0,
        total: 12495
      },
      paymentMethod: "card",
      status: "cancelled",
      cancelReason: "Changed mind before shipping",
      isCancelled: true,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    });
  });

  describe("1. Admin Authorization & Security Guard", () => {
    it("rejects unauthenticated requests to Phase 2 endpoints with 401", async () => {
      const endpoints = [
        "/api/admin/analytics/products",
        "/api/admin/analytics/sizes-colors",
        "/api/admin/analytics/inventory",
        "/api/admin/analytics/geography",
        "/api/admin/analytics/payments",
        "/api/admin/analytics/shipping",
        "/api/admin/analytics/returns"
      ];
      for (const ep of endpoints) {
        const res = await request(app).get(ep);
        expect(res.status).toBe(401);
      }
    });

    it("rejects non-admin users with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/admin/analytics/products")
        .set("Authorization", `Bearer ${normalToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe("2. Product Analytics & Financial Reconciled Net Sales", () => {
    it("calculates accurate GMS, discounts, net sales, refund deductions, and COGS status from immutable snapshots", async () => {
      const res = await request(app)
        .get("/api/admin/analytics/products")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.products).toBeInstanceOf(Array);
      expect(res.body.products.length).toBe(2);

      const runner = res.body.products.find(p => p.productName === "LYVO Stealth Runner");
      expect(runner).toBeDefined();
      expect(runner.unitsSold).toBe(3); // 2 from testOrder1 + 1 from testOrderReturned (cancelled order strictly excluded)
      expect(runner.grossMerchandiseSales).toBe(7497); // 3 * 2499
      expect(runner.productDiscounts).toBe(400); // 2 * 200
      expect(runner.couponDiscounts).toBe(100);
      expect(runner.refundQuantity).toBe(1);
      expect(runner.refundValue).toBe(2499);
      // Net Sales = GMS - couponDiscounts - refundValue
      expect(runner.netSales).toBe(7497 - 100 - 2499); // 4898
      expect(runner.unitReturnRate).toBe(33.3); // (1/3)*100
      expect(runner.cogsStatus).toBe("actual");
      expect(runner.grossProfit).toBe(runner.netSales - (3 * 900)); // 4898 - 2700 = 2198
      expect(runner.grossMargin).toBe(Math.round((2198 / 4898) * 1000) / 10);
    });

    it("supports configurable lowStockThreshold parameter in product analytics", async () => {
      // With threshold=2, testProduct2 (stock=3) is "In Stock"
      const res1 = await request(app)
        .get("/api/admin/analytics/products?lowStockThreshold=2")
        .set("Authorization", `Bearer ${adminToken}`);
      const loafer1 = res1.body.products.find(p => p.productName === "LYVO Urban Loafer");
      expect(loafer1.healthTag).toBe("In Stock");

      // With threshold=5, testProduct2 (stock=3) is "Low Stock"
      const res2 = await request(app)
        .get("/api/admin/analytics/products?lowStockThreshold=5")
        .set("Authorization", `Bearer ${adminToken}`);
      const loafer2 = res2.body.products.find(p => p.productName === "LYVO Urban Loafer");
      expect(loafer2.healthTag).toBe("Low Stock");
    });
  });

  describe("3. Size & Color Analytics", () => {
    it("calculates sales, net sales, and unit return rates grouped by shoe size and color", async () => {
      const res = await request(app)
        .get("/api/admin/analytics/sizes-colors")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.sizes).toBeInstanceOf(Array);
      expect(res.body.colors).toBeInstanceOf(Array);

      const size9 = res.body.sizes.find(s => s.size === "9");
      expect(size9).toBeDefined();
      expect(size9.unitsSold).toBe(2);

      const blackColor = res.body.colors.find(c => c.color === "Black");
      expect(blackColor).toBeDefined();
      expect(blackColor.unitsSold).toBe(3);
      expect(blackColor.unitReturnRate).toBe(33.3);
    });
  });

  describe("4. Inventory Analytics, Configurable Threshold & Cost Breakdown", () => {
    it("distinguishes known cost, estimated cost, unknown cost units, and honors configurable threshold", async () => {
      const res = await request(app)
        .get("/api/admin/analytics/inventory?lowStockThreshold=5")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.kpis.totalProducts).toBe(3);
      expect(res.body.kpis.totalUnitsInStock).toBe(43); // 30 + 3 + 10
      expect(res.body.kpis.lowStockThreshold).toBe(5);
      expect(res.body.kpis.lowStockProducts).toBe(1); // testProduct2 has 3 units (<=5)

      // Cost valuation breakdown:
      // Known cost: testProduct1 (30 units * 900) = 27,000
      expect(res.body.kpis.knownCostValue).toBe(27000);
      // Estimated cost: testProduct2 (3 units * 700) = 2,100
      expect(res.body.kpis.estimatedCostValue).toBe(2100);
      // Unknown cost units: testProductUnknownCost (10 units with unknown cost)
      expect(res.body.kpis.unknownCostUnits).toBe(10);
      expect(res.body.kpis.unknownCostStyles).toBe(1);
      // Cost coverage percent: (33 / 43) * 100 = 77%
      expect(res.body.kpis.costCoveragePercent).toBe(77);

      // Verify limitation disclosure
      expect(res.body.disclosures.isHistoricalStockMovementAvailable).toBe(false);
    });
  });

  describe("5. Geography Analytics", () => {
    it("aggregates regional state and city metrics while safeguarding sensitive PII", async () => {
      const res = await request(app)
        .get("/api/admin/analytics/geography")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.states).toBeInstanceOf(Array);
      expect(res.body.cities).toBeInstanceOf(Array);

      const karnataka = res.body.states.find(s => s.state === "Karnataka");
      expect(karnataka).toBeDefined();
      expect(karnataka.orders).toBe(2); // testOrder1 & testOrderReturned (cancelled order excluded)
      expect(karnataka.uniqueCustomers).toBe(1);
    });
  });

  describe("6. Payment Analytics & Unreconciled Status", () => {
    it("breaks down payment channels and displays 'Not reconciled' for settlement status", async () => {
      const res = await request(app)
        .get("/api/admin/analytics/payments")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary.totalOrders).toBe(4);
      expect(res.body.summary.codOrders).toBe(1);
      expect(res.body.summary.prepaidOrders).toBe(3);
      expect(res.body.methods).toBeInstanceOf(Array);
      expect(res.body.settlementDisclaimer.status).toBe("unreconciled");
    });
  });

  describe("7. Shipping / Delhivery Logistics & RTO Rates", () => {
    it("reports dispatch volumes, delivery success rates, in transit parcels, and RTO rates", async () => {
      const res = await request(app)
        .get("/api/admin/analytics/shipping")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.kpis.totalOrders).toBe(4);
      expect(res.body.kpis.delivered).toBe(2);
      expect(res.body.kpis.inTransit).toBe(1);
      expect(res.body.kpis.rtoRate).toBe(0);
      expect(res.body.stateShipping).toBeInstanceOf(Array);
      expect(res.body.freightDisclaimer.status).toBe("unreconciled");
    });
  });

  describe("8. Returns & Refunds Analytics (Unit vs Order Return Rates)", () => {
    it("separates genuine customer returns from cancellations and computes accurate order and unit return rates", async () => {
      const res = await request(app)
        .get("/api/admin/analytics/returns")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary.returnRequestsCount).toBe(1);
      expect(res.body.summary.approvedReturnsCount).toBe(1);
      expect(res.body.summary.deliveredOrders).toBe(2);
      // Order Return Rate = (1 approved / 2 delivered) * 100 = 50%
      expect(res.body.summary.orderReturnRate).toBe(50);
      expect(res.body.summary.totalRefundedValue).toBe(2499);
      expect(res.body.summary.cancellationsCount).toBe(1); // Separated cancellation
      expect(res.body.returnReasons).toBeInstanceOf(Array);
      expect(res.body.returnReasons[0]._id).toBe("Size too small");
    });
  });

  describe("9. Extended Data Quality Inspector", () => {
    it("detects SKU, HSN, COGS, and shipping waybill integrity indicators", async () => {
      const res = await request(app)
        .get("/api/admin/analytics/data-quality")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.indicators.sku).toBeDefined();
      expect(res.body.indicators.sku.missingCount).toBe(0);
      expect(res.body.indicators.shippingWaybill).toBeDefined();
      expect(res.body.indicators.shippingWaybill.missingCount).toBe(0);
      expect(res.body.indicators.cogs.unknownCount).toBe(0);
    });
  });
});
