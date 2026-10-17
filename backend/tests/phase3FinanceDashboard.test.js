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
const StockInward = require("../models/StockInward");
const RazorpaySettlement = require("../models/RazorpaySettlement");
const CourierInvoice = require("../models/CourierInvoice");

describe("Phase 3B Finance Dashboard & Management P&L Suite", () => {
  let adminUser, normalUser;
  let adminToken, normalToken;
  let testCategory, testProduct1, testProduct2;

  beforeEach(async () => {
    adminUser = await User.create({
      name: "Finance Controller",
      email: "finance.controller@example.com",
      password: "Password123!",
      role: "admin",
      isActive: true
    });

    normalUser = await User.create({
      name: "Standard Shopper",
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

    testCategory = await Category.create({ name: "Running Shoes", slug: "running-shoes" });

    testProduct1 = await Product.create({
      name: "LYVO Velocity Pro",
      slug: "lyvo-velocity-pro",
      description: "High performance racing shoe",
      brand: "LYVO",
      category: testCategory._id,
      gender: "unisex",
      price: 4000,
      mrp: 5000,
      sku: "LYVO-VEL-001",
      costPrice: 1500,
      costPriceSource: "actual",
      sizes: [{ size: "9", stock: 50 }],
      totalStock: 50
    });

    testProduct2 = await Product.create({
      name: "LYVO Cloud Walker",
      slug: "lyvo-cloud-walker",
      description: "Everyday cushioned shoe",
      brand: "LYVO",
      category: testCategory._id,
      gender: "men",
      price: 3000,
      mrp: 3500,
      sku: "LYVO-CLD-002",
      costPrice: 1000,
      costPriceSource: "actual",
      sizes: [{ size: "10", stock: 30 }],
      totalStock: 30
    });
  });

  describe("1. Security & Admin Authorization Guard", () => {
    it("rejects unauthenticated requests to /overview and /pnl with 401", async () => {
      const endpoints = [
        "/api/admin/finance/overview",
        "/api/admin/finance/pnl"
      ];
      for (const ep of endpoints) {
        const res = await request(app).get(ep);
        expect(res.status).toBe(401);
      }
    });

    it("rejects non-admin users with 403 Forbidden", async () => {
      const endpoints = [
        "/api/admin/finance/overview",
        "/api/admin/finance/pnl"
      ];
      for (const ep of endpoints) {
        const res = await request(app)
          .get(ep)
          .set("Authorization", `Bearer ${normalToken}`);
        expect(res.status).toBe(403);
      }
    });

    it("allows authorized admin users to access finance overview and P&L", async () => {
      const resOverview = await request(app)
        .get("/api/admin/finance/overview")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resOverview.status).toBe(200);
      expect(resOverview.body.success).toBe(true);

      const resPnl = await request(app)
        .get("/api/admin/finance/pnl")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resPnl.status).toBe(200);
      expect(resPnl.body.success).toBe(true);
    });
  });

  describe("2. Empty Database Behavior", () => {
    it("gracefully returns zero metrics without crashing or NaN values", async () => {
      const resOverview = await request(app)
        .get("/api/admin/finance/overview")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(resOverview.status).toBe(200);
      expect(resOverview.body.kpis.revenue.netRevenue).toBe(0);
      expect(resOverview.body.kpis.revenue.grossMerchandiseSales).toBe(0);
      expect(resOverview.body.kpis.profitability.totalCogs).toBe(0);
      expect(resOverview.body.kpis.profitability.operatingExpenses).toBe(0);
      expect(resOverview.body.kpis.profitability.grossProfit).toBe(0);
      expect(resOverview.body.kpis.profitability.operatingProfit).toBe(0);
      expect(resOverview.body.expensesByCategory).toEqual([]);

      const resPnl = await request(app)
        .get("/api/admin/finance/pnl")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(resPnl.status).toBe(200);
      expect(resPnl.body.revenue.netRevenue.amount).toBe(0);
      expect(resPnl.body.operatingResult.operatingProfit.amount).toBe(0);
      expect(resPnl.body.operatingResult.isComplete).toBe(true);
    });
  });

  describe("3. Revenue Waterfall & Financial Mathematics Calculations", () => {
    beforeEach(async () => {
      // Order 1: 2 pairs of Product 1 (Price 4000, MRP 5000, Cost 1500), Coupon 500, Shipping 100, Tax 360
      // GMS = 4000 * 2 = 8000. Product discount = (5000 - 4000)*2 = 2000. Coupon = 500. Net Merch = 8000 - 500 = 7500.
      // Net Revenue = 7500 + 100 - 0 = 7600.
      // COGS = 1500 * 2 = 3000. Gross Profit = 7600 - 3000 = 4600.
      await Order.create({
        orderNumber: "LYVO-ORD-2026-001",
        user: normalUser._id,
        items: [{
          product: testProduct1._id,
          name: testProduct1.name,
          sku: testProduct1.sku,
          price: 4000,
          mrp: 5000,
          quantity: 2,
          size: "9",
          costPrice: 1500,
          costPriceSource: "actual",
          allocatedCouponDiscount: 500
        }],
        pricing: {
          subtotal: 8000,
          shippingCost: 100,
          tax: 360,
          couponDiscount: 500,
          total: 7960
        },
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        createdAt: new Date()
      });

      // Order 2: 1 pair of Product 2 (Price 3000, MRP 3500, Cost 1000), Shipping 0, Tax 150, Refund 500
      // GMS = 3000. Product discount = 500. Coupon = 0. Net Merch = 3000.
      // Net Revenue = 3000 + 0 - 500 = 2500.
      // COGS = 1000. Gross Profit = 2500 - 1000 = 1500.
      await Order.create({
        orderNumber: "LYVO-ORD-2026-002",
        user: normalUser._id,
        items: [{
          product: testProduct2._id,
          name: testProduct2.name,
          sku: testProduct2.sku,
          price: 3000,
          mrp: 3500,
          quantity: 1,
          size: "10",
          costPrice: 1000,
          costPriceSource: "actual",
          allocatedCouponDiscount: 0
        }],
        pricing: {
          subtotal: 3000,
          shippingCost: 0,
          tax: 150,
          couponDiscount: 0,
          total: 3150
        },
        paymentMethod: "upi",
        isPaid: true,
        totalRefundedAmount: 500,
        status: "delivered",
        createdAt: new Date()
      });

      // Order 3: Cancelled Order (should be excluded from revenue and COGS)
      await Order.create({
        orderNumber: "LYVO-ORD-2026-003",
        user: normalUser._id,
        items: [{
          product: testProduct1._id,
          name: testProduct1.name,
          sku: testProduct1.sku,
          price: 4000,
          quantity: 1,
          size: "9",
          costPrice: 1500,
          costPriceSource: "actual"
        }],
        pricing: { subtotal: 4000, shippingCost: 0, tax: 200, total: 4200 },
        paymentMethod: "card",
        isPaid: false,
        status: "cancelled",
        createdAt: new Date()
      });

      // Operating Expenses: Software (1000) and Marketing (2000)
      await Expense.create({
        expenseDate: new Date(),
        category: "software_it",
        description: "Cloud Hosting",
        vendor: { name: "AWS India" },
        taxableAmount: 1000,
        cgst: 90,
        sgst: 90,
        totalGst: 180,
        grossAmount: 1180,
        itcEligibility: "eligible",
        itcAmount: 180,
        status: "approved"
      });

      await Expense.create({
        expenseDate: new Date(),
        category: "marketing",
        description: "Ad Campaigns",
        vendor: { name: "Meta Ads" },
        taxableAmount: 2000,
        cgst: 180,
        sgst: 180,
        totalGst: 360,
        grossAmount: 2360,
        itcEligibility: "eligible",
        itcAmount: 360,
        status: "approved"
      });
    });

    it("verifies accurate Overview calculations across non-cancelled orders", async () => {
      const res = await request(app)
        .get("/api/admin/finance/overview")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { revenue, profitability, taxTracking } = res.body.kpis;

      // GMS = 8000 + 3000 = 11000
      expect(revenue.grossMerchandiseSales).toBe(11000);
      // Product Discounts = 2000 + 500 = 2500
      expect(revenue.productDiscounts).toBe(2500);
      // Coupon Discounts = 500
      expect(revenue.couponDiscounts).toBe(500);
      // Net Merchandise Sales = 11000 - 500 = 10500
      expect(revenue.netMerchandiseSales).toBe(10500);
      // Shipping Revenue = 100
      expect(revenue.shippingRevenue).toBe(100);
      // Refunds = 500
      expect(revenue.refundsValue).toBe(500);
      // Net Revenue = 10500 + 100 - 500 = 10100
      expect(revenue.netRevenue).toBe(10100);
      // Paid Orders = 2
      expect(revenue.paidOrders).toBe(2);

      // Total COGS = (1500 * 2) + (1000 * 1) = 4000
      expect(profitability.totalCogs).toBe(4000);
      expect(profitability.cogsStatus).toBe("actual");
      // Gross Profit = 10100 - 4000 = 6100
      expect(profitability.grossProfit).toBe(6100);
      // Gross Margin = (6100 / 10100) * 100 ≈ 60.4%
      expect(profitability.grossMarginPercent).toBe(60.4);

      // Total Expenses = 1180 + 2360 = 3540
      expect(profitability.operatingExpenses).toBe(3540);
      // Operating Profit = 6100 - 3540 = 2560
      expect(profitability.operatingProfit).toBe(2560);
      // Operating Margin = (2560 / 10100) * 100 ≈ 25.3%
      expect(profitability.operatingMarginPercent).toBe(25.3);

      // Tax tracking: Sales tax = 360 + 150 = 510
      expect(taxTracking.taxCollectedOnSales).toBe(510);
      expect(taxTracking.taxPaidOnExpenses).toBe(540); // 180 + 360
      expect(taxTracking.itcEligible).toBe(540);
    });

    it("verifies accurate Management P&L structure and line item mapping", async () => {
      const res = await request(app)
        .get("/api/admin/finance/pnl")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { revenue, cogs, operatingExpenses, operatingResult, taxInformation } = res.body;

      // Revenue Waterfall
      expect(revenue.grossMerchandiseSales.amount).toBe(11000);
      expect(revenue.grossMerchandiseSales.provenance).toBe("ACTUAL");
      expect(revenue.productDiscounts.amount).toBe(2500);
      expect(revenue.couponDiscounts.amount).toBe(500);
      expect(revenue.netMerchandiseSales.amount).toBe(10500);
      expect(revenue.netMerchandiseSales.provenance).toBe("DERIVED");
      expect(revenue.shippingRevenue.amount).toBe(100);
      expect(revenue.refunds.amount).toBe(500);
      expect(revenue.netRevenue.amount).toBe(10100);
      expect(revenue.netRevenue.provenance).toBe("DERIVED");

      // COGS
      expect(cogs.knownCogs.amount).toBe(4000);
      expect(cogs.totalCogs.amount).toBe(4000);
      expect(cogs.cogsCoveragePercent).toBe(100);
      expect(cogs.grossProfit.amount).toBe(6100);
      expect(cogs.grossProfit.provenance).toBe("DERIVED");
      expect(cogs.grossMarginPercent).toBe(60.4);

      // Operating Expenses
      expect(operatingExpenses.software_it.amount).toBe(1180);
      expect(operatingExpenses.marketing.amount).toBe(2360);
      expect(operatingExpenses.packaging.amount).toBe(0);
      expect(operatingExpenses.totalOperatingExpenses.amount).toBe(3540);

      // Operating Result
      expect(operatingResult.operatingProfit.amount).toBe(2560);
      expect(operatingResult.operatingProfit.provenance).toBe("DERIVED");
      expect(operatingResult.operatingMarginPercent).toBe(25.3);
      expect(operatingResult.isComplete).toBe(true);

      // Tax Information
      expect(taxInformation.taxCollectedOnSales).toBe(510);
      expect(taxInformation.taxPaidOnExpenses).toBe(540);
    });
  });

  describe("4. Incomplete COGS Handling & Missing Cost Price Safeguard", () => {
    it("flags Gross Profit and Operating Result as incomplete when unknown cost units exist", async () => {
      // Create an order with unknown cost price (costPriceSource: "unknown", costPrice: null)
      await Order.create({
        orderNumber: "LYVO-ORD-LEGACY-001",
        user: normalUser._id,
        items: [{
          product: testProduct1._id,
          name: "Legacy Shoe Without Cost",
          sku: "LEGACY-001",
          price: 2500,
          quantity: 2,
          costPrice: null,
          costPriceSource: "unknown"
        }],
        pricing: {
          subtotal: 5000,
          shippingCost: 0,
          tax: 0,
          couponDiscount: 0,
          total: 5000
        },
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        createdAt: new Date()
      });

      const res = await request(app)
        .get("/api/admin/finance/overview")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { profitability } = res.body.kpis;

      expect(profitability.unknownCostUnits).toBe(2);
      expect(profitability.cogsStatus).toBe("incomplete");
      expect(profitability.cogsProvenance).toBe("INCOMPLETE");
      // Gross Profit MUST be null rather than assuming cost is 0
      expect(profitability.grossProfit).toBeNull();
      expect(profitability.grossProfitProvenance).toBe("UNKNOWN");
      expect(profitability.grossMarginPercent).toBeNull();
      // Operating Profit MUST be null rather than assuming cost is 0
      expect(profitability.operatingProfit).toBeNull();
      expect(profitability.operatingProfitProvenance).toBe("UNKNOWN");

      // Verify P&L response
      const resPnl = await request(app)
        .get("/api/admin/finance/pnl")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(resPnl.status).toBe(200);
      expect(resPnl.body.cogs.grossProfit.amount).toBeNull();
      expect(resPnl.body.cogs.grossProfit.provenance).toBe("UNKNOWN");
      expect(resPnl.body.operatingResult.operatingProfit.amount).toBeNull();
      expect(resPnl.body.operatingResult.isComplete).toBe(false);
      expect(resPnl.body.operatingResult.status).toBe("incomplete");
      expect(resPnl.body.disclosures[3]).toMatch(/missing cost prices/i);
    });
  });

  describe("5. Date Filtering & Range Semantics", () => {
    it("filters orders and expenses accurately by custom date range", async () => {
      const pastDate = new Date("2026-01-15T10:00:00Z");
      const recentDate = new Date("2026-03-15T10:00:00Z");

      // Past Order (Jan 2026)
      await Order.create({
        orderNumber: "LYVO-ORD-JAN",
        user: normalUser._id,
        items: [{
          product: testProduct1._id,
          name: testProduct1.name,
          price: 4000,
          quantity: 1,
          costPrice: 1500,
          costPriceSource: "actual"
        }],
        pricing: { subtotal: 4000, shippingCost: 0, tax: 0, total: 4000 },
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        createdAt: pastDate
      });

      // Recent Order (March 2026)
      await Order.create({
        orderNumber: "LYVO-ORD-MAR",
        user: normalUser._id,
        items: [{
          product: testProduct2._id,
          name: testProduct2.name,
          price: 3000,
          quantity: 1,
          costPrice: 1000,
          costPriceSource: "actual"
        }],
        pricing: { subtotal: 3000, shippingCost: 0, tax: 0, total: 3000 },
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        createdAt: recentDate
      });

      // Filter for January only
      const resJan = await request(app)
        .get("/api/admin/finance/overview?startDate=2026-01-01&endDate=2026-01-31")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(resJan.status).toBe(200);
      expect(resJan.body.kpis.revenue.grossMerchandiseSales).toBe(4000);
      expect(resJan.body.kpis.revenue.netRevenue).toBe(4000);

      // Filter for March only
      const resMar = await request(app)
        .get("/api/admin/finance/overview?startDate=2026-03-01&endDate=2026-03-31")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(resMar.status).toBe(200);
      expect(resMar.body.kpis.revenue.grossMerchandiseSales).toBe(3000);
      expect(resMar.body.kpis.revenue.netRevenue).toBe(3000);
    });
  });

  describe("6. Gateway & Logistics Economics Aggregation", () => {
    it("aggregates Razorpay settlements and Delhivery carrier freight invoices into economics KPIs", async () => {
      // Settlement batch
      await RazorpaySettlement.create({
        settlementId: "setl_econ_01",
        settlementDate: new Date(),
        grossAmount: 50000,
        feeAmount: 1000,
        taxAmount: 180,
        feeProvenance: "actual",
        netAmount: 48820,
        reconciliationSummary: {
          totalTransactions: 10,
          matchedCount: 9,
          unmatchedCount: 1,
          mismatchCount: 0,
          status: "partially_reconciled"
        }
      });

      // Courier invoice
      await CourierInvoice.create({
        invoiceNumber: "del_econ_01",
        invoiceDate: new Date(),
        totalBilledAmount: 4500,
        reconciliationSummary: {
          matchedShipments: 30,
          unmatchedShipments: 2,
          totalActualFreight: 4500,
          status: "partially_reconciled"
        }
      });

      const res = await request(app)
        .get("/api/admin/finance/overview")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { gatewayEconomics, logisticsEconomics } = res.body.kpis;

      expect(gatewayEconomics.grossSettled).toBe(50000);
      expect(gatewayEconomics.actualGatewayFeesPaid).toBe(1000);
      expect(gatewayEconomics.actualGatewayTaxPaid).toBe(180);
      expect(gatewayEconomics.netBankSettlement).toBe(48820);
      expect(gatewayEconomics.matchedTxCount).toBe(9);
      expect(gatewayEconomics.unmatchedTxCount).toBe(1);

      expect(logisticsEconomics.actualFreightBilled).toBe(4500);
      expect(logisticsEconomics.actualFreightCost).toBe(4500);
      expect(logisticsEconomics.matchedShipmentsCount).toBe(30);
      expect(logisticsEconomics.unmatchedShipmentsCount).toBe(2);
    });
  });

  describe("7. Coupon Calculation & Double-Count Protection (A-F Audit)", () => {
    it("A. calculates order-level coupon discount accurately when allocated coupon is null", async () => {
      await Order.create({
        orderNumber: "LYVO-COUP-A",
        user: normalUser._id,
        items: [{
          product: testProduct1._id,
          name: testProduct1.name,
          price: 4000,
          quantity: 1,
          costPrice: 1500,
          costPriceSource: "actual"
        }],
        pricing: { subtotal: 4000, shippingCost: 0, tax: 0, couponDiscount: 600, total: 3400 },
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        createdAt: new Date()
      });

      const res = await request(app)
        .get("/api/admin/finance/overview")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.body.kpis.revenue.couponDiscounts).toBe(600);
      expect(res.body.kpis.revenue.netMerchandiseSales).toBe(3400);
    });

    it("B. calculates allocated line-item coupon fallback when order-level coupon is null", async () => {
      await Order.create({
        orderNumber: "LYVO-COUP-B",
        user: normalUser._id,
        items: [
          {
            product: testProduct1._id,
            name: testProduct1.name,
            price: 4000,
            quantity: 1,
            costPrice: 1500,
            costPriceSource: "actual",
            allocatedCouponDiscount: 300
          },
          {
            product: testProduct2._id,
            name: testProduct2.name,
            price: 3000,
            quantity: 1,
            costPrice: 1000,
            costPriceSource: "actual",
            allocatedCouponDiscount: 200
          }
        ],
        pricing: { subtotal: 7000, shippingCost: 0, tax: 0, couponDiscount: null, total: 6500 },
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        createdAt: new Date()
      });

      const res = await request(app)
        .get("/api/admin/finance/overview")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.body.kpis.revenue.couponDiscounts).toBe(500); // 300 + 200
      expect(res.body.kpis.revenue.netMerchandiseSales).toBe(6500);
    });

    it("C & D. strictly prevents double-counting when both order-level and allocated coupons exist", async () => {
      await Order.create({
        orderNumber: "LYVO-COUP-CD",
        user: normalUser._id,
        items: [{
          product: testProduct1._id,
          name: testProduct1.name,
          price: 4000,
          quantity: 1,
          costPrice: 1500,
          costPriceSource: "actual",
          allocatedCouponDiscount: 500
        }],
        pricing: { subtotal: 4000, shippingCost: 0, tax: 0, couponDiscount: 500, total: 3500 },
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        createdAt: new Date()
      });

      const res = await request(app)
        .get("/api/admin/finance/overview")
        .set("Authorization", `Bearer ${adminToken}`);

      // MUST be exactly 500, NOT 1000!
      expect(res.body.kpis.revenue.couponDiscounts).toBe(500);
      expect(res.body.kpis.revenue.netMerchandiseSales).toBe(3500);
    });

    it("E. handles zero coupon discount accurately", async () => {
      await Order.create({
        orderNumber: "LYVO-COUP-E",
        user: normalUser._id,
        items: [{
          product: testProduct1._id,
          name: testProduct1.name,
          price: 4000,
          quantity: 1,
          costPrice: 1500,
          costPriceSource: "actual"
        }],
        pricing: { subtotal: 4000, shippingCost: 0, tax: 0, couponDiscount: 0, total: 4000 },
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        createdAt: new Date()
      });

      const res = await request(app)
        .get("/api/admin/finance/overview")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.body.kpis.revenue.couponDiscounts).toBe(0);
      expect(res.body.kpis.revenue.netMerchandiseSales).toBe(4000);
    });

    it("F. handles multiple items sharing one order coupon without duplication", async () => {
      await Order.create({
        orderNumber: "LYVO-COUP-F",
        user: normalUser._id,
        items: [
          {
            product: testProduct1._id,
            name: testProduct1.name,
            price: 4000,
            quantity: 2,
            costPrice: 1500,
            costPriceSource: "actual",
            allocatedCouponDiscount: 400
          },
          {
            product: testProduct2._id,
            name: testProduct2.name,
            price: 3000,
            quantity: 1,
            costPrice: 1000,
            costPriceSource: "actual",
            allocatedCouponDiscount: 200
          }
        ],
        pricing: { subtotal: 11000, shippingCost: 0, tax: 0, couponDiscount: 600, total: 10400 },
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        createdAt: new Date()
      });

      const res = await request(app)
        .get("/api/admin/finance/overview")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.body.kpis.revenue.couponDiscounts).toBe(600);
      expect(res.body.kpis.revenue.grossMerchandiseSales).toBe(11000);
      expect(res.body.kpis.revenue.netMerchandiseSales).toBe(10400);
    });
  });

  describe("8. Historical COGS Immutability Safeguard", () => {
    it("proves that future StockInward GRN does NOT retroactively modify historical Order item cost snapshots", async () => {
      // 1. Order placed at T1 with estimated cost ₹1800
      const orderT1 = await Order.create({
        orderNumber: "LYVO-ORD-T1",
        user: normalUser._id,
        items: [{
          product: testProduct1._id,
          name: testProduct1.name,
          sku: testProduct1.sku,
          price: 4000,
          quantity: 1,
          costPrice: 1800,
          costPriceSource: "estimated"
        }],
        pricing: { subtotal: 4000, shippingCost: 0, tax: 0, couponDiscount: 0, total: 4000 },
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        createdAt: new Date("2026-02-01T10:00:00Z")
      });

      // 2. Inward GRN recorded at T2 with actual landed cost ₹1650
      await StockInward.create({
        grnNumber: "GRN-2026-T2",
        supplier: { name: "Apex Footwear" },
        receivedDate: new Date("2026-02-15T10:00:00Z"),
        items: [{
          product: testProduct1._id,
          name: testProduct1.name,
          sku: testProduct1.sku,
          quantityReceived: 100,
          unitCost: 1500,
          landedUnitCost: 1650
        }]
      });

      // 3. Re-fetch Order T1 and verify immutable cost snapshot
      const freshOrderT1 = await Order.findById(orderT1._id).lean();
      expect(freshOrderT1.items[0].costPrice).toBe(1800);
      expect(freshOrderT1.items[0].costPriceSource).toBe("estimated");

      // 4. Verify finance overview for Feb 2026 still computes COGS using the ₹1800 snapshot
      const res = await request(app)
        .get("/api/admin/finance/overview?startDate=2026-02-01&endDate=2026-02-28")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.body.kpis.profitability.totalCogs).toBe(1800);
      expect(res.body.kpis.profitability.cogsStatus).toBe("estimated");
      expect(res.body.kpis.profitability.grossProfit).toBe(2200); // 4000 - 1800
    });
  });

  describe("9. Refund Ledger Consistency & Partial Refund Handling", () => {
    it("deducts partial refunds accurately from Net Revenue without double-counting", async () => {
      await Order.create({
        orderNumber: "LYVO-ORD-REFUND-PARTIAL",
        user: normalUser._id,
        items: [{
          product: testProduct1._id,
          name: testProduct1.name,
          price: 4000,
          quantity: 2,
          costPrice: 1500,
          costPriceSource: "actual"
        }],
        pricing: { subtotal: 8000, shippingCost: 100, tax: 0, couponDiscount: 0, total: 8100 },
        paymentMethod: "card",
        isPaid: true,
        totalRefundedAmount: 2000, // Partial refund for 1 item
        status: "delivered",
        createdAt: new Date()
      });

      const res = await request(app)
        .get("/api/admin/finance/overview")
        .set("Authorization", `Bearer ${adminToken}`);

      // Net Merchandise = 8000. Shipping = 100. Refunds = 2000. Net Revenue = 8000 + 100 - 2000 = 6100.
      expect(res.body.kpis.revenue.grossMerchandiseSales).toBe(8000);
      expect(res.body.kpis.revenue.shippingRevenue).toBe(100);
      expect(res.body.kpis.revenue.refundsValue).toBe(2000);
      expect(res.body.kpis.revenue.netRevenue).toBe(6100);
    });
  });

  describe("10. Expense Status & Cancellation Safety", () => {
    it("strictly excludes cancelled expenses from P&L operating expenses", async () => {
      await Expense.create({
        expenseDate: new Date(),
        category: "software_it",
        description: "Valid Expense",
        vendor: { name: "Vercel" },
        taxableAmount: 5000,
        totalGst: 900,
        grossAmount: 5900,
        status: "approved"
      });

      await Expense.create({
        expenseDate: new Date(),
        category: "software_it",
        description: "Cancelled Mistaken Expense",
        vendor: { name: "Vercel" },
        taxableAmount: 10000,
        totalGst: 1800,
        grossAmount: 11800,
        status: "cancelled"
      });

      const res = await request(app)
        .get("/api/admin/finance/overview")
        .set("Authorization", `Bearer ${adminToken}`);

      // ONLY the approved 5900 must be included, NOT 5900 + 11800
      expect(res.body.kpis.profitability.operatingExpenses).toBe(5900);
      expect(res.body.expensesByCategory[0].spend).toBe(5900);
    });
  });
});
