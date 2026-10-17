require("./setup");
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../app");

const User = require("../models/User");
const Product = require("../models/Product");
const { Category } = require("../models/models");
const Order = require("../models/Order");
const RazorpaySettlement = require("../models/RazorpaySettlement");
const CourierInvoice = require("../models/CourierInvoice");

describe("Phase 3D-1 Profitability & Unit Economics Backend Suite", () => {
  let adminUser, normalUser;
  let adminToken, normalToken;
  let prodA, prodB, prodC;

  beforeEach(async () => {
    adminUser = await User.create({
      name: "Finance Controller",
      email: "controller@example.com",
      password: "Password123!",
      role: "admin",
      isActive: true
    });

    normalUser = await User.create({
      name: "Standard Customer",
      email: "buyer@example.com",
      password: "Password123!",
      role: "user",
      isActive: true
    });

    adminToken = jwt.sign(
      { id: adminUser._id, role: "admin" },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    normalToken = jwt.sign(
      { id: normalUser._id, role: "user" },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const catSneakers = await Category.create({ name: "Sneakers", slug: "sneakers" });
    const catSandals = await Category.create({ name: "Sandals", slug: "sandals" });

    prodA = await Product.create({
      name: "LYVO Velocity Sneaker",
      slug: "lyvo-velocity-sneaker",
      description: "High performance running sneakers",
      brand: "LYVO",
      category: catSneakers._id,
      gender: "men",
      price: 3000,
      costPrice: 1200,
      variants: [{ size: "9", color: "Black", sku: "LYVO-VEL-BLK-9", stock: 50, price: 3000, mrp: 3500 }]
    });

    prodB = await Product.create({
      name: "LYVO Aeroflow Sandal",
      slug: "lyvo-aeroflow-sandal",
      description: "Comfort lightweight sandals",
      brand: "LYVO",
      category: catSandals._id,
      gender: "women",
      price: 1500,
      costPrice: 600,
      variants: [{ size: "7", color: "Tan", sku: "LYVO-AERO-TAN-7", stock: 30, price: 1500, mrp: 2000 }]
    });

    prodC = await Product.create({
      name: "LYVO Legacy Runner",
      slug: "lyvo-legacy-runner",
      description: "Vintage retro style runner",
      brand: "LYVO",
      category: catSneakers._id,
      gender: "unisex",
      price: 4000,
      costPrice: null,
      variants: [{ size: "8", color: "White", sku: "LYVO-LEG-WHT-8", stock: 20, price: 4000, mrp: 4000 }]
    });
  });

  describe("1. Security, Route Protection & Empty State", () => {
    it("rejects unauthenticated requests with 401 across all 4 profitability endpoints", async () => {
      const endpoints = [
        "/api/admin/finance/profitability/products",
        "/api/admin/finance/profitability/categories",
        "/api/admin/finance/profitability/channels",
        `/api/admin/finance/profitability/orders/${new mongoose.Types.ObjectId()}`
      ];

      for (const ep of endpoints) {
        const res = await request(app).get(ep);
        expect(res.status).toBe(401);
      }
    });

    it("rejects non-admin users with 403 across all 4 profitability endpoints", async () => {
      const endpoints = [
        "/api/admin/finance/profitability/products",
        "/api/admin/finance/profitability/categories",
        "/api/admin/finance/profitability/channels",
        `/api/admin/finance/profitability/orders/${new mongoose.Types.ObjectId()}`
      ];

      for (const ep of endpoints) {
        const res = await request(app)
          .get(ep)
          .set("Authorization", `Bearer ${normalToken}`);
        expect(res.status).toBe(403);
      }
    });

    it("returns clean zero structures when no orders exist", async () => {
      const resProd = await request(app)
        .get("/api/admin/finance/profitability/products")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resProd.status).toBe(200);
      expect(resProd.body.summary.totalProducts).toBe(0);
      expect(resProd.body.summary.grossMerchandiseSales).toBe(0);
      expect(resProd.body.summary.netMerchandiseSales).toBe(0);
      expect(resProd.body.summary.netRevenue).toBe(0);
      expect(resProd.body.products).toEqual([]);

      const resCat = await request(app)
        .get("/api/admin/finance/profitability/categories")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resCat.status).toBe(200);
      expect(resCat.body.byCategory).toEqual([]);
      expect(resCat.body.byGender).toEqual([]);

      const resChan = await request(app)
        .get("/api/admin/finance/profitability/channels")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resChan.status).toBe(200);
      expect(resChan.body.channels).toEqual([]);
    });

    it("returns 404 when requested order unit economics does not exist", async () => {
      const randomId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/admin/finance/profitability/orders/${randomId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Order record not found");
    });
  });

  describe("2. Product & SKU Profitability", () => {
    it("computes accurate product/SKU profitability with aligned Net Merchandise Sales = GMS - Coupon", async () => {
      // Order 1: Prod A (Actual COGS 1000, price 3000, qty 2, mrp 3500, coupon 200)
      await Order.create({
        orderNumber: "ORD-PROD-001",
        user: normalUser._id,
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        pricing: { subtotal: 6000, couponDiscount: 200, shippingCost: 0, tax: 300, total: 6100 },
        items: [{
          product: prodA._id,
          name: "LYVO Velocity Sneaker",
          sku: "LYVO-VEL-BLK-9",
          category: "Sneakers",
          gender: "men",
          price: 3000,
          mrp: 3500,
          quantity: 2,
          allocatedCouponDiscount: 200,
          costPrice: 1000,
          costPriceSource: "actual"
        }]
      });

      // Order 2: Prod B (Estimated COGS 500, price 1500, qty 1, mrp 2000, coupon 0)
      await Order.create({
        orderNumber: "ORD-PROD-002",
        user: normalUser._id,
        paymentMethod: "upi",
        isPaid: true,
        status: "delivered",
        pricing: { subtotal: 1500, couponDiscount: 0, shippingCost: 50, tax: 75, total: 1625 },
        items: [{
          product: prodB._id,
          name: "LYVO Aeroflow Sandal",
          sku: "LYVO-AERO-TAN-7",
          category: "Sandals",
          gender: "women",
          price: 1500,
          mrp: 2000,
          quantity: 1,
          allocatedCouponDiscount: 0,
          costPrice: 500,
          costPriceSource: "estimated"
        }]
      });

      const res = await request(app)
        .get("/api/admin/finance/profitability/products")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.summary.totalProducts).toBe(2);
      expect(res.body.summary.grossMerchandiseSales).toBe(7500); // (3000*2) + (1500*1)
      expect(res.body.summary.couponAllocated).toBe(200);
      expect(res.body.summary.netMerchandiseSales).toBe(7300); // GMS (7500) - Coupon (200)
      expect(res.body.summary.netRevenue).toBe(7300);
      expect(res.body.summary.knownCogs).toBe(2000); // 1000 * 2
      expect(res.body.summary.estimatedCogs).toBe(500); // 500 * 1
      expect(res.body.summary.totalCogs).toBe(2500);
      expect(res.body.summary.grossProfit).toBe(4800); // 7300 - 2500
      expect(res.body.summary.grossMarginPercent).toBe(65.8);

      const sneakerRow = res.body.products.find(p => p.sku === "LYVO-VEL-BLK-9");
      expect(sneakerRow).toBeDefined();
      expect(sneakerRow.unitsSold).toBe(2);
      expect(sneakerRow.grossMerchandiseSales).toBe(6000);
      expect(sneakerRow.productDiscounts).toBe(1000);
      expect(sneakerRow.couponAllocated).toBe(200);
      expect(sneakerRow.netMerchandiseSales).toBe(5800); // 6000 - 200
      expect(sneakerRow.netRevenue).toBe(5800);
      expect(sneakerRow.knownCogs).toBe(2000);
      expect(sneakerRow.cogsStatus).toBe("actual");
      expect(sneakerRow.grossProfit).toBe(3800); // 5800 - 2000
      expect(sneakerRow.grossMarginPercent).toBe(65.5);
      expect(sneakerRow.provenance).toBe("DERIVED");

      const sandalRow = res.body.products.find(p => p.sku === "LYVO-AERO-TAN-7");
      expect(sandalRow).toBeDefined();
      expect(sandalRow.cogsStatus).toBe("estimated");
      expect(sandalRow.grossProfit).toBe(1000); // 1500 - 500
      expect(sandalRow.provenance).toBe("ESTIMATED");
    });

    it("flags cogsStatus as incomplete and sets grossProfit to null when unknown costPrice exists", async () => {
      await Order.create({
        orderNumber: "ORD-PROD-UNKNOWN",
        user: normalUser._id,
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        pricing: { subtotal: 4000, couponDiscount: 0, shippingCost: 0, tax: 200, total: 4200 },
        items: [{
          product: prodC._id,
          name: "LYVO Legacy Runner",
          sku: "LYVO-LEG-WHT-8",
          category: "Sneakers",
          gender: "unisex",
          price: 4000,
          mrp: 4000,
          quantity: 1,
          allocatedCouponDiscount: 0,
          costPrice: null,
          costPriceSource: "unknown"
        }]
      });

      const res = await request(app)
        .get("/api/admin/finance/profitability/products")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const row = res.body.products.find(p => p.sku === "LYVO-LEG-WHT-8");
      expect(row.cogsStatus).toBe("incomplete");
      expect(row.unknownCostUnits).toBe(1);
      expect(row.cogsCoveragePercent).toBe(0);
      expect(row.grossProfit).toBeNull();
      expect(row.grossMarginPercent).toBeNull();
      expect(row.provenance).toBe("UNKNOWN");
      expect(res.body.summary.grossProfit).toBeNull();
    });

    it("preserves immutable historical item snapshots and ignores subsequent Catalog costPrice changes", async () => {
      await Order.create({
        orderNumber: "ORD-IMMUTABLE-01",
        user: normalUser._id,
        paymentMethod: "upi",
        isPaid: true,
        status: "delivered",
        pricing: { subtotal: 3000, couponDiscount: 0, shippingCost: 0, tax: 150, total: 3150 },
        items: [{
          product: prodA._id,
          name: "LYVO Velocity Sneaker",
          sku: "LYVO-VEL-BLK-9",
          category: "Sneakers",
          gender: "men",
          price: 3000,
          quantity: 1,
          costPrice: 1000,
          costPriceSource: "actual"
        }]
      });

      await Product.findByIdAndUpdate(prodA._id, { costPrice: 2500 });

      const res = await request(app)
        .get("/api/admin/finance/profitability/products")
        .set("Authorization", `Bearer ${adminToken}`);

      const row = res.body.products.find(p => p.sku === "LYVO-VEL-BLK-9");
      expect(row.knownCogs).toBe(1000);
      expect(row.grossProfit).toBe(2000); // 3000 - 1000
    });
  });

  describe("3. Category & Gender Profitability", () => {
    it("aggregates profitability accurately across categories and genders with aligned Net Merchandise Sales", async () => {
      await Order.create({
        orderNumber: "ORD-CAT-001",
        user: normalUser._id,
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        pricing: { subtotal: 4500, couponDiscount: 500, shippingCost: 0, tax: 225, total: 4725 },
        items: [
          {
            product: prodA._id,
            name: "LYVO Velocity Sneaker",
            sku: "LYVO-VEL-BLK-9",
            category: "Sneakers",
            gender: "men",
            price: 3000,
            quantity: 1,
            allocatedCouponDiscount: 350,
            costPrice: 1000,
            costPriceSource: "actual"
          },
          {
            product: prodB._id,
            name: "LYVO Aeroflow Sandal",
            sku: "LYVO-AERO-TAN-7",
            category: "Sandals",
            gender: "women",
            price: 1500,
            quantity: 1,
            allocatedCouponDiscount: 150,
            costPrice: 600,
            costPriceSource: "actual"
          }
        ]
      });

      const res = await request(app)
        .get("/api/admin/finance/profitability/categories")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.byCategory.length).toBe(2);
      expect(res.body.byGender.length).toBe(2);

      const sneakerCat = res.body.byCategory.find(c => c.category === "Sneakers");
      expect(sneakerCat.grossMerchandiseSales).toBe(3000);
      expect(sneakerCat.couponAllocated).toBe(350);
      expect(sneakerCat.netMerchandiseSales).toBe(2650); // 3000 - 350
      expect(sneakerCat.netRevenue).toBe(2650);
      expect(sneakerCat.totalCogs).toBe(1000);
      expect(sneakerCat.grossProfit).toBe(1650); // 2650 - 1000

      const sandalCat = res.body.byCategory.find(c => c.category === "Sandals");
      expect(sandalCat.grossMerchandiseSales).toBe(1500);
      expect(sandalCat.netMerchandiseSales).toBe(1350); // 1500 - 150
      expect(sandalCat.totalCogs).toBe(600);
      expect(sandalCat.grossProfit).toBe(750); // 1350 - 600
    });
  });

  describe("4. Channel & Payment Method Profitability", () => {
    it("distinguishes Prepaid vs COD channel economics with full revenue flow and contribution profit", async () => {
      await Order.create({
        orderNumber: "ORD-CHAN-PREPAID",
        user: normalUser._id,
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        pricing: { subtotal: 3000, couponDiscount: 100, shippingCost: 100, tax: 150, total: 3150 },
        items: [{
          product: prodA._id,
          name: "LYVO Velocity Sneaker",
          price: 3000,
          quantity: 1,
          costPrice: 1000,
          costPriceSource: "actual"
        }],
        gatewaySettlement: { fee: 65, tax: 11.7, feeSource: "actual" },
        shippingSettlement: { actualFreightCost: 120, fuelSurcharge: 10, codHandlingFee: 0, rtoCost: 0 }
      });

      await Order.create({
        orderNumber: "ORD-CHAN-COD",
        user: normalUser._id,
        paymentMethod: "cod",
        isPaid: true,
        status: "delivered",
        pricing: { subtotal: 1500, couponDiscount: 0, shippingCost: 50, tax: 75, total: 1625 },
        items: [{
          product: prodB._id,
          name: "LYVO Aeroflow Sandal",
          price: 1500,
          quantity: 1,
          costPrice: 500,
          costPriceSource: "actual"
        }],
        shippingSettlement: { actualFreightCost: 120, fuelSurcharge: 10, codHandlingFee: 40, rtoCost: 0 }
      });

      const res = await request(app)
        .get("/api/admin/finance/profitability/channels")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.channels.length).toBe(2);

      const prepaid = res.body.channels.find(c => c.channel === "prepaid");
      expect(prepaid.grossMerchandiseSales).toBe(3000);
      expect(prepaid.couponDiscounts).toBe(100);
      expect(prepaid.netMerchandiseSales).toBe(2900); // 3000 - 100
      expect(prepaid.shippingRevenue).toBe(100);
      expect(prepaid.refunds).toBe(0);
      expect(prepaid.netRevenue).toBe(3000); // 2900 (Net Merch) + 100 (Shipping) - 0 (Refunds)
      expect(prepaid.totalCogs).toBe(1000);
      expect(prepaid.grossProfit).toBe(2000); // 3000 - 1000
      expect(prepaid.gatewayFee).toBe(65);
      expect(prepaid.freightCost).toBe(120);
      expect(prepaid.contributionProfit).toBe(1815); // 2000 - 65 - 120

      const cod = res.body.channels.find(c => c.channel === "cod");
      expect(cod.grossMerchandiseSales).toBe(1500);
      expect(cod.netMerchandiseSales).toBe(1500);
      expect(cod.shippingRevenue).toBe(50);
      expect(cod.netRevenue).toBe(1550); // 1500 + 50
      expect(cod.totalCogs).toBe(500);
      expect(cod.grossProfit).toBe(1050); // 1550 - 500
      expect(cod.gatewayFee).toBe(0);
      expect(cod.gatewayFeeProvenance).toBe("NOT_APPLICABLE");
      expect(cod.freightCost).toBe(120);
      expect(cod.contributionProfit).toBe(930); // 1050 - 0 - 120
    });
  });

  describe("5. Order Unit Economics Breakdown & Refund Handling", () => {
    it("verifies Net Merchandise Sales excludes refunds and Refunds reduce Net Revenue (not deducted twice)", async () => {
      const order = await Order.create({
        orderNumber: "ORD-UNIT-REFUND-01",
        user: normalUser._id,
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        pricing: { subtotal: 3000, couponDiscount: 200, shippingCost: 100, tax: 150, total: 3050 },
        totalRefundedAmount: 400,
        refunds: [
          { refundId: "ref_1", amount: 250, type: "partial_item", status: "processed" },
          { refundId: "ref_2", amount: 150, type: "goodwill_adjustment", status: "processed" }
        ],
        items: [{
          product: prodA._id,
          name: "LYVO Velocity Sneaker",
          sku: "LYVO-VEL-BLK-9",
          price: 3000,
          quantity: 1,
          allocatedCouponDiscount: 200,
          costPrice: 1000,
          costPriceSource: "actual"
        }],
        gatewaySettlement: { fee: 60, tax: 10.8, feeSource: "actual" },
        shippingSettlement: { actualFreightCost: 100, fuelSurcharge: 10, codHandlingFee: 0, rtoCost: 0 }
      });

      const res = await request(app)
        .get(`/api/admin/finance/profitability/orders/${order._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const d = res.body.data;
      const rev = d.revenue;

      // 1. GMS
      expect(rev.grossMerchandiseSales).toBe(3000);
      // 2. Coupon
      expect(rev.couponDiscount).toBe(200);
      // 3. Net Merchandise Sales = GMS - Coupon (Refunds NOT subtracted here!)
      expect(rev.netMerchandiseSales).toBe(2800);
      // 4. Shipping
      expect(rev.shippingRevenue).toBe(100);
      // 5. Refunds (multiple refunds summed = 250 + 150 = 400)
      expect(rev.refunds).toBe(400);
      // 6. Net Revenue = Net Merchandise Sales (2800) + Shipping (100) - Refunds (400) = 2500
      expect(rev.netRevenue).toBe(2500);
      // 7. COGS
      expect(d.cogs.totalCogs).toBe(1000);
      // 8. Gross Profit = Net Revenue (2500) - COGS (1000) = 1500
      expect(d.grossProfit.amount).toBe(1500);
      expect(d.grossProfit.marginPercent).toBe(60.0); // 1500 / 2500 * 100
      // 9. Gateway & Freight
      expect(d.gatewayEconomics.fee).toBe(60);
      expect(d.logisticsEconomics.totalFreight).toBe(110); // 100 + 10 fuel
      // 10. Contribution Profit = Gross Profit (1500) - Gateway (60) - Freight (110) = 1330
      expect(d.contribution.profit).toBe(1330);
      expect(d.contribution.marginPercent).toBe(53.2); // 1330 / 2500 * 100
      expect(d.contribution.isComplete).toBe(true);
    });

    it("handles full refund scenario safely without double deduction", async () => {
      const order = await Order.create({
        orderNumber: "ORD-FULL-REFUND",
        user: normalUser._id,
        paymentMethod: "card",
        isPaid: true,
        status: "refunded",
        pricing: { subtotal: 3000, couponDiscount: 0, shippingCost: 100, tax: 150, total: 3250 },
        totalRefundedAmount: 3100, // full order value returned
        refunds: [{ refundId: "ref_full", amount: 3100, type: "return_refund", status: "processed" }],
        items: [{
          product: prodA._id,
          name: "LYVO Velocity Sneaker",
          price: 3000,
          quantity: 1,
          costPrice: 1000,
          costPriceSource: "actual"
        }],
        gatewaySettlement: { fee: 65, tax: 11.7, feeSource: "actual" },
        shippingSettlement: { actualFreightCost: 100, fuelSurcharge: 0, codHandlingFee: 0, rtoCost: 50 }
      });

      const res = await request(app)
        .get(`/api/admin/finance/profitability/orders/${order._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const rev = res.body.data.revenue;
      expect(rev.grossMerchandiseSales).toBe(3000);
      expect(rev.netMerchandiseSales).toBe(3000);
      expect(rev.shippingRevenue).toBe(100);
      expect(rev.refunds).toBe(3100);
      expect(rev.netRevenue).toBe(0); // (3000 + 100) - 3100 = 0
      expect(res.body.data.grossProfit.amount).toBe(-1000); // 0 - 1000
    });
  });

  describe("6. Date Filtering & Cancelled Orders Safety", () => {
    it("excludes cancelled orders from all profitability aggregations", async () => {
      await Order.create({
        orderNumber: "ORD-CANCELLED-99",
        user: normalUser._id,
        paymentMethod: "card",
        isPaid: false,
        status: "cancelled",
        orderStatus: "Cancelled",
        pricing: { subtotal: 3000, couponDiscount: 0, shippingCost: 0, tax: 150, total: 3150 },
        items: [{
          product: prodA._id,
          name: "LYVO Velocity Sneaker",
          price: 3000,
          quantity: 1,
          costPrice: 1000,
          costPriceSource: "actual"
        }]
      });

      const res = await request(app)
        .get("/api/admin/finance/profitability/products")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.summary.totalUnitsSold).toBe(0);
      expect(res.body.products).toEqual([]);
    });

    it("rejects invalid date range with 400 status", async () => {
      const res = await request(app)
        .get("/api/admin/finance/profitability/products?startDate=2026-12-31&endDate=2026-01-01")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Start date cannot be after end date");
    });
  });
});
