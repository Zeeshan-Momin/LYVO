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
const TaxRule = require("../models/TaxRule");

describe("Phase 3C Tax & GST Management Analytics Suite", () => {
  let adminUser, normalUser;
  let adminToken, normalToken;
  let testCategory, testProduct1, testProduct2;

  beforeEach(async () => {
    adminUser = await User.create({
      name: "Tax Controller",
      email: "tax.controller@example.com",
      password: "Password123!",
      role: "admin",
      isActive: true
    });

    normalUser = await User.create({
      name: "Standard Shopper",
      email: "shopper.tax@example.com",
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
      name: "LYVO Cloud Runner",
      slug: "lyvo-cloud-runner",
      description: "Comfort trainer",
      brand: "LYVO",
      category: testCategory._id,
      gender: "unisex",
      price: 2000,
      mrp: 2500,
      costPrice: 800,
      hsn: "6404",
      variants: [{ size: "UK-8", color: "Black", stock: 50, sku: "CR-BLK-8" }]
    });

    testProduct2 = await Product.create({
      name: "LYVO Apex Carbon",
      slug: "lyvo-apex-carbon",
      description: "Marathon racer",
      brand: "LYVO",
      category: testCategory._id,
      gender: "unisex",
      price: 5000,
      mrp: 6000,
      costPrice: 2000,
      hsn: "6404",
      variants: [{ size: "UK-9", color: "Volt", stock: 30, sku: "AC-VLT-9" }]
    });
  });

  describe("1. Authorization Security & Route Protection (Phase 3C-1 & 3C-2)", () => {
    test("rejects unauthenticated requests with 401 across all 7 endpoints", async () => {
      const endpoints = [
        "/api/admin/tax/overview",
        "/api/admin/tax/hsn",
        "/api/admin/tax/states",
        "/api/admin/tax/rates",
        "/api/admin/tax/input-tax",
        "/api/admin/tax/data-quality",
        "/api/admin/tax/reconciliation"
      ];

      for (const endpoint of endpoints) {
        const res = await request(app).get(endpoint);
        expect(res.status).toBe(401);
      }
    });

    test("rejects non-admin users with 403 across all 7 endpoints", async () => {
      const endpoints = [
        "/api/admin/tax/overview",
        "/api/admin/tax/hsn",
        "/api/admin/tax/states",
        "/api/admin/tax/rates",
        "/api/admin/tax/input-tax",
        "/api/admin/tax/data-quality",
        "/api/admin/tax/reconciliation"
      ];

      for (const endpoint of endpoints) {
        const res = await request(app)
          .get(endpoint)
          .set("Authorization", `Bearer ${normalToken}`);
        expect(res.status).toBe(403);
      }
    });
  });

  describe("2. Empty Database Resilience", () => {
    test("returns clean zero structures when no orders or expenses exist", async () => {
      const resOverview = await request(app)
        .get("/api/admin/tax/overview")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resOverview.status).toBe(200);
      expect(resOverview.body.data.summary.grossSales.value).toBe(0);
      expect(resOverview.body.data.summary.totalOutputTax.value).toBe(0);

      const resHsn = await request(app)
        .get("/api/admin/tax/hsn")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resHsn.status).toBe(200);
      expect(resHsn.body.data.hsnRecords).toEqual([]);

      const resStates = await request(app)
        .get("/api/admin/tax/states")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resStates.status).toBe(200);
      expect(resStates.body.data.stateRecords).toEqual([]);

      const resRates = await request(app)
        .get("/api/admin/tax/rates")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resRates.status).toBe(200);
      expect(resRates.body.data.rateRecords).toEqual([]);

      const resInputTax = await request(app)
        .get("/api/admin/tax/input-tax")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resInputTax.status).toBe(200);
      expect(resInputTax.body.data.summary.totalExpenseGst).toBe(0);

      const resQuality = await request(app)
        .get("/api/admin/tax/data-quality")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resQuality.status).toBe(200);
      expect(resQuality.body.data.summary.totalAnomalies).toBe(0);
      expect(resQuality.body.data.summary.healthStatus).toBe("CLEAN");

      const resRecon = await request(app)
        .get("/api/admin/tax/reconciliation")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resRecon.status).toBe(200);
      expect(resRecon.body.data.orderTaxReconciliation.ordersChecked).toBe(0);
      expect(resRecon.body.data.orderTaxReconciliation.status).toBe("RECONCILED");
    });
  });

  describe("3. Phase 3C-1 Core Analytics Regressions", () => {
    beforeEach(async () => {
      // Intrastate order (Maharashtra)
      await Order.create({
        user: normalUser._id,
        items: [{
          product: testProduct1._id,
          name: testProduct1.name,
          sku: "CR-BLK-8",
          price: 2000,
          quantity: 2,
          hsn: "6404",
          taxRate: 18,
          taxableValue: 3389.83,
          cgst: 305.08,
          sgst: 305.08,
          totalTax: 610.17
        }],
        pricing: { subtotal: 4000, discount: 0, shipping: 0, tax: 610.17, total: 4000 },
        shippingAddress: { fullName: "Intrastate", address: "A", city: "Mumbai", state: "Maharashtra", postalCode: "400001", phone: "1" },
        financialSnapshot: { placeOfSupply: "Maharashtra", isInterState: false, taxCollected: 610.17 },
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        orderStatus: "Delivered",
        createdAt: new Date()
      });

      // Interstate order (Karnataka)
      await Order.create({
        user: normalUser._id,
        items: [{
          product: testProduct2._id,
          name: testProduct2.name,
          sku: "AC-VLT-9",
          price: 5000,
          quantity: 1,
          hsn: "6404",
          taxRate: 18,
          taxableValue: 4237.29,
          igst: 762.71,
          totalTax: 762.71
        }],
        pricing: { subtotal: 5000, discount: 0, shipping: 0, tax: 762.71, total: 5000 },
        shippingAddress: { fullName: "Interstate", address: "B", city: "BLR", state: "Karnataka", postalCode: "560001", phone: "2" },
        financialSnapshot: { placeOfSupply: "Karnataka", isInterState: true, taxCollected: 762.71 },
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        orderStatus: "Delivered",
        createdAt: new Date()
      });
    });

    test("computes accurate tax overview, HSN, State, and Rate analytics", async () => {
      const res = await request(app)
        .get("/api/admin/tax/overview")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.summary.grossSales.value).toBe(9000);
      expect(res.body.data.summary.taxableSales.value).toBe(7627.12);
      expect(res.body.data.summary.totalOutputTax.value).toBe(1372.88);

      const resHsn = await request(app).get("/api/admin/tax/hsn").set("Authorization", `Bearer ${adminToken}`);
      expect(resHsn.body.data.hsnRecords[0].hsn).toBe("6404");

      const resStates = await request(app).get("/api/admin/tax/states").set("Authorization", `Bearer ${adminToken}`);
      expect(resStates.body.data.stateRecords.length).toBe(2);

      const resRates = await request(app).get("/api/admin/tax/rates").set("Authorization", `Bearer ${adminToken}`);
      expect(resRates.body.data.rateRecords[0].taxRate).toBe(18);
    });
  });

  describe("4. Phase 3C-2 Tax Data Quality Anomaly Auditing", () => {
    test("detects ERR_MISSING_HSN on items with blank or null HSN", async () => {
      await Order.create({
        user: normalUser._id,
        items: [{
          product: testProduct1._id,
          sku: "NO-HSN-SKU",
          name: "Shoe without HSN",
          price: 1500,
          quantity: 1,
          hsn: "", // MISSING
          taxRate: 18,
          taxableValue: 1271.19,
          cgst: 114.41,
          sgst: 114.41,
          totalTax: 228.81
        }],
        pricing: { subtotal: 1500, tax: 228.81, total: 1500 },
        shippingAddress: { fullName: "User", state: "Maharashtra" },
        financialSnapshot: { placeOfSupply: "Maharashtra", isInterState: false, taxCollected: 228.81 },
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        orderStatus: "Delivered",
        createdAt: new Date()
      });

      const res = await request(app)
        .get("/api/admin/tax/data-quality")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const hsnAnomaly = res.body.data.anomalies.find(a => a.code === "ERR_MISSING_HSN");
      expect(hsnAnomaly).toBeDefined();
      expect(hsnAnomaly.severity).toBe("HIGH");
      expect(hsnAnomaly.provenance).toBe("UNKNOWN");
      expect(res.body.data.anomalyCountsByCode.ERR_MISSING_HSN).toBe(1);
    });

    test("detects ERR_MISSING_TAXABLE_VAL on paid items with zero or null taxableValue", async () => {
      await Order.create({
        user: normalUser._id,
        items: [{
          product: testProduct1._id,
          sku: "NO-TAXABLE-VAL",
          name: "Shoe without Taxable Value",
          price: 2000,
          quantity: 1,
          hsn: "6404",
          taxRate: 18,
          taxableValue: 0, // MISSING / ZERO on a paid item
          cgst: 152.54,
          sgst: 152.54,
          totalTax: 305.08
        }],
        pricing: { subtotal: 2000, tax: 305.08, total: 2000 },
        shippingAddress: { fullName: "User", state: "Maharashtra" },
        financialSnapshot: { placeOfSupply: "Maharashtra", isInterState: false, taxCollected: 305.08 },
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        orderStatus: "Delivered",
        createdAt: new Date()
      });

      const res = await request(app)
        .get("/api/admin/tax/data-quality")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const taxValAnomaly = res.body.data.anomalies.find(a => a.code === "ERR_MISSING_TAXABLE_VAL");
      expect(taxValAnomaly).toBeDefined();
      expect(taxValAnomaly.severity).toBe("CRITICAL");
    });

    test("detects ERR_TAX_SUM_MISMATCH for component mismatch and header vs item mismatch", async () => {
      // Order with component sum mismatch (CGST + SGST = 300, totalTax = 350)
      await Order.create({
        user: normalUser._id,
        items: [{
          product: testProduct1._id,
          sku: "MISMATCH-SKU",
          price: 2000,
          quantity: 1,
          hsn: "6404",
          taxRate: 18,
          taxableValue: 1694.92,
          cgst: 150.00,
          sgst: 150.00,
          totalTax: 350.00 // MISMATCH (300 vs 350)
        }],
        pricing: { subtotal: 2000, tax: 350.00, total: 2000 },
        shippingAddress: { fullName: "User", state: "Maharashtra" },
        financialSnapshot: { placeOfSupply: "Maharashtra", isInterState: false, taxCollected: 350.00 },
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        orderStatus: "Delivered",
        createdAt: new Date()
      });

      const res = await request(app)
        .get("/api/admin/tax/data-quality")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const sumAnomaly = res.body.data.anomalies.find(a => a.code === "ERR_TAX_SUM_MISMATCH");
      expect(sumAnomaly).toBeDefined();
      expect(sumAnomaly.severity).toBe("CRITICAL");
      expect(sumAnomaly.details.difference).toBe(50);
    });

    test("detects ERR_NEGATIVE_TAX on items with negative tax components", async () => {
      await Order.create({
        user: normalUser._id,
        items: [{
          product: testProduct1._id,
          sku: "NEG-TAX-SKU",
          price: 1000,
          quantity: 1,
          hsn: "6404",
          taxRate: 18,
          taxableValue: 847.46,
          cgst: -50.00, // NEGATIVE
          sgst: 76.27,
          totalTax: 26.27
        }],
        pricing: { subtotal: 1000, tax: 26.27, total: 1000 },
        shippingAddress: { fullName: "User", state: "Maharashtra" },
        financialSnapshot: { placeOfSupply: "Maharashtra", isInterState: false, taxCollected: 26.27 },
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        orderStatus: "Delivered",
        createdAt: new Date()
      });

      const res = await request(app)
        .get("/api/admin/tax/data-quality")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const negAnomaly = res.body.data.anomalies.find(a => a.code === "ERR_NEGATIVE_TAX");
      expect(negAnomaly).toBeDefined();
      expect(negAnomaly.severity).toBe("CRITICAL");
    });

    test("detects ERR_INVALID_GEO_SPLIT for intrastate order with IGST and interstate with CGST/SGST", async () => {
      // Intrastate order with invalid IGST
      await Order.create({
        user: normalUser._id,
        items: [{
          product: testProduct1._id,
          sku: "GEO-ERR-SKU",
          price: 1000,
          quantity: 1,
          hsn: "6404",
          taxRate: 18,
          taxableValue: 847.46,
          cgst: 0,
          sgst: 0,
          igst: 152.54, // INVALID for Intrastate
          totalTax: 152.54
        }],
        pricing: { subtotal: 1000, tax: 152.54, total: 1000 },
        shippingAddress: { fullName: "User", state: "Maharashtra" },
        financialSnapshot: { placeOfSupply: "Maharashtra", isInterState: false, taxCollected: 152.54 },
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        orderStatus: "Delivered",
        createdAt: new Date()
      });

      const res = await request(app)
        .get("/api/admin/tax/data-quality")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const geoAnomaly = res.body.data.anomalies.find(a => a.code === "ERR_INVALID_GEO_SPLIT");
      expect(geoAnomaly).toBeDefined();
      expect(geoAnomaly.severity).toBe("HIGH");
    });

    test("detects ERR_MISSING_POS when placeOfSupply is blank", async () => {
      await Order.create({
        user: normalUser._id,
        items: [{
          product: testProduct1._id,
          sku: "CR-BLK-8",
          price: 1000,
          quantity: 1,
          hsn: "6404",
          taxRate: 18,
          taxableValue: 847.46,
          cgst: 76.27,
          sgst: 76.27,
          totalTax: 152.54
        }],
        pricing: { subtotal: 1000, tax: 152.54, total: 1000 },
        shippingAddress: { fullName: "User", state: "" },
        financialSnapshot: { placeOfSupply: "", isInterState: false, taxCollected: 152.54 }, // BLANK POS
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        orderStatus: "Delivered",
        createdAt: new Date()
      });

      const res = await request(app)
        .get("/api/admin/tax/data-quality")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const posAnomaly = res.body.data.anomalies.find(a => a.code === "ERR_MISSING_POS");
      expect(posAnomaly).toBeDefined();
      expect(posAnomaly.severity).toBe("MEDIUM");
    });

    test("detects ERR_UNVERIFIED_RULE when item references unverified or inactive TaxRule", async () => {
      const inactiveRule = await TaxRule.create({
        ruleCode: "GST_UNVERIFIED_TEST",
        name: "Unverified Rule",
        hsnCode: "6404",
        version: 1,
        ratePercent: 18,
        cgstPercent: 9,
        sgstPercent: 9,
        igstPercent: 18,
        effectiveFrom: new Date("2026-01-01"),
        isActive: false, // INACTIVE
        verifiedByAccountant: false // UNVERIFIED
      });

      await Order.create({
        user: normalUser._id,
        items: [{
          product: testProduct1._id,
          sku: "CR-BLK-8",
          price: 1000,
          quantity: 1,
          hsn: "6404",
          taxRate: 18,
          taxRuleId: inactiveRule._id,
          taxableValue: 847.46,
          cgst: 76.27,
          sgst: 76.27,
          totalTax: 152.54
        }],
        pricing: { subtotal: 1000, tax: 152.54, total: 1000 },
        shippingAddress: { fullName: "User", state: "Maharashtra" },
        financialSnapshot: { placeOfSupply: "Maharashtra", isInterState: false, taxCollected: 152.54 },
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        orderStatus: "Delivered",
        createdAt: new Date()
      });

      const res = await request(app)
        .get("/api/admin/tax/data-quality")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const ruleAnomaly = res.body.data.anomalies.find(a => a.code === "ERR_UNVERIFIED_RULE");
      expect(ruleAnomaly).toBeDefined();
      expect(ruleAnomaly.severity).toBe("MEDIUM");
    });

    test("detects ERR_EXPENSE_GST_MISMATCH and ERR_INVALID_ITC_AMOUNT on Expense records", async () => {
      // Expense 1: GST mismatch (cgst=100, sgst=100, totalGst=300) - insert directly to simulate raw legacy data
      await Expense.collection.insertOne({
        expenseDate: new Date(),
        category: "marketing",
        description: "Ad spend",
        vendor: { name: "Ad Network" },
        taxableAmount: 1000,
        cgst: 100,
        sgst: 100,
        igst: 0,
        cess: 0,
        totalGst: 300, // MISMATCH
        grossAmount: 1300,
        itcEligibility: "eligible",
        itcAmount: 350, // INVALID (exceeds totalGst)
        status: "approved"
      });

      // Expense 2: Blocked ITC with non-zero claimable amount - insert directly to simulate raw legacy data
      await Expense.collection.insertOne({
        expenseDate: new Date(),
        category: "rent_utilities",
        description: "Staff meal",
        vendor: { name: "Restaurant" },
        taxableAmount: 500,
        cgst: 25,
        sgst: 25,
        igst: 0,
        cess: 0,
        totalGst: 50,
        grossAmount: 550,
        itcEligibility: "blocked",
        itcAmount: 50, // INVALID for blocked ITC
        status: "approved"
      });

      const res = await request(app)
        .get("/api/admin/tax/data-quality")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.anomalyCountsByCode.ERR_EXPENSE_GST_MISMATCH).toBe(1);
      expect(res.body.data.anomalyCountsByCode.ERR_INVALID_ITC_AMOUNT).toBe(2);
    });
  });

  describe("5. Phase 3C-2 Management Tax Reconciliation", () => {
    beforeEach(async () => {
      // 1 Reconciled Order
      await Order.create({
        user: normalUser._id,
        items: [{
          product: testProduct1._id,
          sku: "CR-BLK-8",
          price: 2000,
          quantity: 1,
          hsn: "6404",
          taxRate: 18,
          taxableValue: 1694.92,
          cgst: 152.54,
          sgst: 152.54,
          totalTax: 305.08
        }],
        pricing: { subtotal: 2000, tax: 305.08, total: 2000 },
        shippingAddress: { fullName: "User", state: "Maharashtra" },
        financialSnapshot: { placeOfSupply: "Maharashtra", isInterState: false, taxCollected: 305.08 },
        paymentMethod: "card",
        isPaid: true,
        status: "delivered",
        orderStatus: "Delivered",
        createdAt: new Date()
      });

      // 1 Reconciled Expense + 1 Pending Verification Expense
      await Expense.create({
        expenseDate: new Date(),
        category: "logistics_freight",
        description: "Delhivery Freight",
        vendor: { name: "Delhivery" },
        taxableAmount: 5000,
        cgst: 450,
        sgst: 450,
        totalGst: 900,
        grossAmount: 5900,
        itcEligibility: "eligible",
        itcClaimed: true,
        itcAmount: 900,
        status: "approved"
      });

      await Expense.create({
        expenseDate: new Date(),
        category: "software_it",
        description: "Cloud Hosting",
        vendor: { name: "Cloud Co" },
        taxableAmount: 2000,
        cgst: 180,
        sgst: 180,
        totalGst: 360,
        grossAmount: 2360,
        itcEligibility: "pending_verification",
        itcAmount: 0,
        status: "approved"
      });
    });

    test("computes accurate order tax, refund tax, expense GST, and ITC reconciliation metrics", async () => {
      const res = await request(app)
        .get("/api/admin/tax/reconciliation")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { orderTaxReconciliation, expenseGstReconciliation, itcReconciliation } = res.body.data;

      // Order reconciliation
      expect(orderTaxReconciliation.ordersChecked).toBe(1);
      expect(orderTaxReconciliation.ordersReconciled).toBe(1);
      expect(orderTaxReconciliation.ordersWithMismatch).toBe(0);
      expect(orderTaxReconciliation.itemTaxTotal).toBe(305.08);
      expect(orderTaxReconciliation.headerTaxTotal).toBe(305.08);
      expect(orderTaxReconciliation.status).toBe("RECONCILED");

      // Expense reconciliation
      expect(expenseGstReconciliation.expensesChecked).toBe(2);
      expect(expenseGstReconciliation.expensesReconciled).toBe(2);
      expect(expenseGstReconciliation.expensesWithMismatch).toBe(0);
      expect(expenseGstReconciliation.componentGstTotal).toBe(1260); // 900 + 360
      expect(expenseGstReconciliation.recordedTotalGst).toBe(1260);
      expect(expenseGstReconciliation.status).toBe("RECONCILED");

      // ITC reconciliation (pending verification remains separate from eligible)
      expect(itcReconciliation.eligibleItc).toBe(900);
      expect(itcReconciliation.pendingVerificationItc).toBe(360);
      expect(itcReconciliation.claimedItc).toBe(900);
      expect(itcReconciliation.totalExpenseGst).toBe(1260);
    });
  });

  describe("6. Date Filtering & Safety Validations", () => {
    test("rejects invalid date range with 400 on data-quality and reconciliation", async () => {
      const resDQ = await request(app)
        .get("/api/admin/tax/data-quality?startDate=2026-10-01&endDate=2026-09-01")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resDQ.status).toBe(400);

      const resRecon = await request(app)
        .get("/api/admin/tax/reconciliation?startDate=2026-10-01&endDate=2026-09-01")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resRecon.status).toBe(400);
    });

    test("strictly excludes cancelled orders from data-quality and reconciliation", async () => {
      await Order.create({
        user: normalUser._id,
        items: [{
          product: testProduct1._id,
          sku: "CANCELLED-SKU",
          price: 1000,
          quantity: 1,
          hsn: "", // missing HSN on cancelled order
          taxRate: 18,
          taxableValue: 847.46,
          cgst: 76.27,
          sgst: 76.27,
          totalTax: 152.54
        }],
        pricing: { subtotal: 1000, tax: 152.54, total: 1000 },
        shippingAddress: { fullName: "Cancelled User", state: "Maharashtra" },
        financialSnapshot: { placeOfSupply: "Maharashtra", isInterState: false, taxCollected: 152.54 },
        paymentMethod: "card",
        isPaid: false,
        status: "cancelled",
        orderStatus: "Cancelled",
        createdAt: new Date()
      });

      const res = await request(app)
        .get("/api/admin/tax/data-quality")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.totalOrdersAudited).toBe(0);
      expect(res.body.data.summary.totalAnomalies).toBe(0);
    });
  });
});
