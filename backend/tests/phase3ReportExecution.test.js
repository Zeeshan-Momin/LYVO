require("./setup");
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../app");

const User = require("../models/User");
const Product = require("../models/Product");
const { Category } = require("../models/models");
const Order = require("../models/Order");
const Expense = require("../models/Expense");
const SavedReport = require("../models/SavedReport");
const RazorpaySettlement = require("../models/RazorpaySettlement");
const CourierInvoice = require("../models/CourierInvoice");

describe("Phase 3D-2 Report Builder & Execution Engine Suite", () => {
  let adminUser, normalUser;
  let adminToken, normalToken;
  let prodA, prodB, catSneakers;

  beforeEach(async () => {
    adminUser = await User.create({
      name: "Reporting Admin",
      email: "report.admin@example.com",
      password: "Password123!",
      role: "admin",
      isActive: true
    });

    normalUser = await User.create({
      name: "Store Customer",
      email: "shopper@example.com",
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

    catSneakers = await Category.create({ name: "Running Shoes", slug: "running-shoes" });

    prodA = await Product.create({
      name: "LYVO Turbo Sneaker",
      slug: "lyvo-turbo-sneaker",
      description: "Performance running shoes",
      brand: "LYVO",
      category: catSneakers._id,
      gender: "men",
      price: 4000,
      costPrice: 1500,
      variants: [{ size: "10", color: "Blue", sku: "LYVO-TRB-BLU-10", stock: 50, price: 4000, mrp: 4500 }]
    });

    prodB = await Product.create({
      name: "LYVO Pace Sandal",
      slug: "lyvo-pace-sandal",
      description: "Lightweight sandals",
      brand: "LYVO",
      category: catSneakers._id,
      gender: "women",
      price: 2000,
      costPrice: 800,
      variants: [{ size: "6", color: "Black", sku: "LYVO-PACE-BLK-6", stock: 30, price: 2000, mrp: 2500 }]
    });
  });

  describe("1. Security, Authentication & Input Validation", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const res1 = await request(app).post("/api/admin/finance/reports/execute").send({ reportType: "financial_pnl" });
      expect(res1.status).toBe(401);

      const res2 = await request(app).get(`/api/admin/finance/reports/saved/${new mongoose.Types.ObjectId()}/execute`);
      expect(res2.status).toBe(401);
    });

    it("rejects non-admin users with 403", async () => {
      const res1 = await request(app)
        .post("/api/admin/finance/reports/execute")
        .set("Authorization", `Bearer ${normalToken}`)
        .send({ reportType: "financial_pnl" });
      expect(res1.status).toBe(403);

      const res2 = await request(app)
        .get(`/api/admin/finance/reports/saved/${new mongoose.Types.ObjectId()}/execute`)
        .set("Authorization", `Bearer ${normalToken}`);
      expect(res2.status).toBe(403);
    });

    it("rejects invalid report types with 400", async () => {
      const res = await request(app)
        .post("/api/admin/finance/reports/execute")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reportType: "invalid_hacked_report_type" });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Invalid report type");
    });

    it("rejects invalid dimensions with 400", async () => {
      const res = await request(app)
        .post("/api/admin/finance/reports/execute")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          reportType: "custom",
          dimensions: ["invalid_database_table_column"]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Invalid dimension");
    });

    it("rejects invalid metrics with 400", async () => {
      const res = await request(app)
        .post("/api/admin/finance/reports/execute")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          reportType: "custom",
          metrics: ["unauthorized_profit_formula"]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Invalid metric");
    });

    it("rejects raw MongoDB query operator injection attempts with 400", async () => {
      const res = await request(app)
        .post("/api/admin/finance/reports/execute")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          reportType: "custom",
          filters: {
            category: { $gt: "" } // Operator injection attempt
          }
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Invalid filter operator structure");
    });
  });

  describe("2. Empty Database & Basic Report Execution", () => {
    it("handles empty database gracefully across report types", async () => {
      const res = await request(app)
        .post("/api/admin/finance/reports/execute")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reportType: "product_profitability" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results).toEqual([]);
      expect(res.body.reportMetadata.rowCount).toBe(0);
    });

    it("executes financial_pnl report type with complete P&L statement", async () => {
      const res = await request(app)
        .post("/api/admin/finance/reports/execute")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reportType: "financial_pnl" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.rawStatement.statementType).toContain("Management P&L");
    });

    it("executes expenses report type with category breakdown", async () => {
      await Expense.create({
        expenseDate: new Date(),
        category: "software_it",
        description: "Cloud Hosting Monthly",
        vendor: { name: "AWS India" },
        taxableAmount: 5000,
        cgst: 450,
        sgst: 450,
        totalGst: 900,
        grossAmount: 5900,
        itcEligibility: "eligible",
        status: "approved",
        createdBy: adminUser._id
      });

      const res = await request(app)
        .post("/api/admin/finance/reports/execute")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reportType: "expenses" });

      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(1);
      expect(res.body.results[0].category).toBe("software_it");
      expect(res.body.results[0].grossAmount).toBe(5900);
    });
  });

  describe("3. Multi-Dimensional Execution & Financial Formula Integrity", () => {
    beforeEach(async () => {
      // Create paid order with known costs and coupon
      await Order.create({
        orderNumber: "ORD-REP-001",
        user: normalUser._id,
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        pricing: { subtotal: 4000, couponDiscount: 300, shippingCost: 100, tax: 200, total: 4000 },
        shippingAddress: { fullName: "Alice Smith", phone: "9876543210", city: "Bengaluru", state: "Karnataka" },
        items: [{
          product: prodA._id,
          name: "LYVO Turbo Sneaker",
          sku: "LYVO-TRB-BLU-10",
          category: "Running Shoes",
          gender: "men",
          price: 4000,
          mrp: 4500,
          quantity: 1,
          allocatedCouponDiscount: 300,
          costPrice: 1500,
          costPriceSource: "actual"
        }],
        gatewaySettlement: { fee: 80, tax: 14.4, feeSource: "actual" },
        shippingSettlement: { actualFreightCost: 110, fuelSurcharge: 10, codHandlingFee: 0, rtoCost: 0 }
      });
    });

    it("executes product dimension report and verifies Net Merchandise Sales = GMS - Coupon", async () => {
      const res = await request(app)
        .post("/api/admin/finance/reports/execute")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          reportType: "product_profitability",
          dimensions: ["product", "sku"]
        });

      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(1);
      const row = res.body.results[0];
      expect(row.grossMerchandiseSales).toBe(4000);
      expect(row.couponAllocated).toBe(300);
      expect(row.netMerchandiseSales).toBe(3700); // 4000 - 300 (Refunds NOT subtracted here)
      expect(row.totalCogs).toBe(1500);
      expect(row.grossProfit).toBe(2200); // 3700 - 1500
      expect(row.provenance).toBe("DERIVED");
    });

    it("executes category dimension report accurately", async () => {
      const res = await request(app)
        .post("/api/admin/finance/reports/execute")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          reportType: "category_profitability",
          dimensions: ["category"]
        });

      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(1);
      const row = res.body.results[0];
      expect(row.category).toBe("Running Shoes");
      expect(row.grossMerchandiseSales).toBe(4000);
      expect(row.netMerchandiseSales).toBe(3700);
      expect(row.grossProfit).toBe(2200);
    });

    it("executes channel dimension report and verifies contribution profit = Gross Profit - Gateway - Freight", async () => {
      const res = await request(app)
        .post("/api/admin/finance/reports/execute")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          reportType: "channel_profitability",
          dimensions: ["channel"]
        });

      expect(res.status).toBe(200);
      const prepaid = res.body.results.find(r => r.channel === "prepaid");
      expect(prepaid).toBeDefined();
      expect(prepaid.grossMerchandiseSales).toBe(4000);
      expect(prepaid.netMerchandiseSales).toBe(3700); // 4000 - 300
      expect(prepaid.shippingRevenue).toBe(100);
      expect(prepaid.refunds).toBe(0);
      expect(prepaid.netRevenue).toBe(3800); // 3700 + 100
      expect(prepaid.totalCogs).toBe(1500);
      expect(prepaid.grossProfit).toBe(2300); // 3800 - 1500
      expect(prepaid.gatewayFee).toBe(80);
      expect(prepaid.freightCost).toBe(110);
      expect(prepaid.contributionProfit).toBe(2110); // 2300 - 80 - 110
      expect(prepaid.contributionProvenance).toBe("DERIVED");
    });

    it("executes order_profitability report and verifies NO customer phone/PII leakage", async () => {
      const res = await request(app)
        .post("/api/admin/finance/reports/execute")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          reportType: "order_profitability"
        });

      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(1);
      const row = res.body.results[0];
      expect(row.orderNumber).toBe("ORD-REP-001");
      expect(row.grossMerchandiseSales).toBe(4000);
      expect(row.couponDiscounts).toBe(300);
      expect(row.netMerchandiseSales).toBe(3700);
      expect(row.shippingRevenue).toBe(100);
      expect(row.netRevenue).toBe(3800);

      // Security check: Verify customer phone and sensitive address are NOT in results
      expect(row.phone).toBeUndefined();
      expect(row.shippingAddress).toBeUndefined();
      expect(row.password).toBeUndefined();
    });

    it("handles refunds and verifies no double deduction in net revenue", async () => {
      // Add a second order with partial refund
      await Order.create({
        orderNumber: "ORD-REP-REFUND-02",
        user: normalUser._id,
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        pricing: { subtotal: 2000, couponDiscount: 0, shippingCost: 0, tax: 100, total: 2100 },
        totalRefundedAmount: 500,
        refunds: [{ refundId: "ref_101", amount: 500, type: "partial_item", status: "processed" }],
        items: [{
          product: prodB._id,
          name: "LYVO Pace Sandal",
          sku: "LYVO-PACE-BLK-6",
          category: "Running Shoes",
          gender: "women",
          price: 2000,
          quantity: 1,
          costPrice: 800,
          costPriceSource: "actual"
        }],
        gatewaySettlement: { fee: 40, tax: 7.2, feeSource: "actual" },
        shippingSettlement: { actualFreightCost: 90, fuelSurcharge: 0, codHandlingFee: 0, rtoCost: 0 }
      });

      const res = await request(app)
        .post("/api/admin/finance/reports/execute")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          reportType: "order_profitability",
          filters: {
            paymentMethod: "card"
          }
        });

      expect(res.status).toBe(200);
      const refundedOrder = res.body.results.find(r => r.orderNumber === "ORD-REP-REFUND-02");
      expect(refundedOrder).toBeDefined();
      expect(refundedOrder.grossMerchandiseSales).toBe(2000);
      expect(refundedOrder.netMerchandiseSales).toBe(2000);
      expect(refundedOrder.refunds).toBe(500);
      expect(refundedOrder.netRevenue).toBe(1500); // 2000 - 500
      expect(refundedOrder.totalCogs).toBe(800);
      expect(refundedOrder.grossProfit).toBe(700); // 1500 - 800
      expect(refundedOrder.contributionProfit).toBe(570); // 700 - 40 - 90
    });

    it("projects only selected columns when selectedColumns is passed", async () => {
      const res = await request(app)
        .post("/api/admin/finance/reports/execute")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          reportType: "product_profitability",
          selectedColumns: ["grossMerchandiseSales", "totalCogs", "grossProfit"]
        });

      expect(res.status).toBe(200);
      const row = res.body.results[0];
      expect(row.grossMerchandiseSales).toBeDefined();
      expect(row.totalCogs).toBeDefined();
      expect(row.grossProfit).toBeDefined();
      expect(row.productDiscounts).toBeUndefined();
    });
  });

  describe("4. Saved Report Execution", () => {
    let savedTemplate;

    beforeEach(async () => {
      savedTemplate = await SavedReport.create({
        name: "Monthly Product Margins",
        description: "Template for tracking product profitability",
        reportType: "product_profitability",
        filters: { category: "Running Shoes" },
        selectedColumns: ["grossMerchandiseSales", "netMerchandiseSales", "totalCogs", "grossProfit"],
        sortBy: "grossMerchandiseSales",
        sortDir: "desc",
        createdBy: adminUser._id
      });
    });

    it("successfully executes a saved report template by ID", async () => {
      const res = await request(app)
        .get(`/api/admin/finance/reports/saved/${savedTemplate._id}/execute`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.savedReportInfo.name).toBe("Monthly Product Margins");
      expect(res.body.reportMetadata.reportType).toBe("product_profitability");
    });

    it("returns 404 if saved report ID does not exist", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/admin/finance/reports/saved/${fakeId}/execute`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("Saved report template not found");
    });

    it("returns 400 for malformed saved report ID", async () => {
      const res = await request(app)
        .get("/api/admin/finance/reports/saved/invalid-id-format/execute")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Invalid or missing Saved Report ID");
    });
  });
});
