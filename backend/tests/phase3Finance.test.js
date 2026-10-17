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
const SavedReport = require("../models/SavedReport");
const ExportLog = require("../models/ExportLog");

describe("Phase 3A Financial Control & Reconciliation Architecture Suite", () => {
  let adminUser, normalUser;
  let adminToken, normalToken;
  let testProduct, testOrder;

  beforeEach(async () => {
    adminUser = await User.create({
      name: "Finance Admin",
      email: "finance.admin@example.com",
      password: "Password123!",
      role: "admin",
      isActive: true
    });

    normalUser = await User.create({
      name: "Store Customer",
      email: "customer@example.com",
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

    const cat = await Category.create({ name: "Running Footwear", slug: "running-footwear" });

    testProduct = await Product.create({
      name: "LYVO Cloud Stride",
      slug: "lyvo-cloud-stride",
      description: "High performance running shoe",
      brand: "LYVO",
      category: cat._id,
      gender: "men",
      price: 3499,
      sku: "LYVO-RUN-001",
      costPrice: 1200,
      costPriceSource: "actual",
      sizes: [{ size: "9", stock: 25 }],
      totalStock: 25
    });

    testOrder = await Order.create({
      orderNumber: "LYVO-ORD-2026-901",
      user: normalUser._id,
      items: [{
        product: testProduct._id,
        name: testProduct.name,
        sku: testProduct.sku,
        price: 3499,
        quantity: 1,
        size: "9",
        costPrice: 1200,
        costPriceSource: "actual"
      }],
      pricing: {
        subtotal: 3499,
        shippingCost: 0,
        tax: 0,
        couponDiscount: 0,
        total: 3499
      },
      paymentMethod: "card",
      isPaid: true,
      paidAt: new Date(),
      razorpayOrderId: "order_rzp_901",
      razorpayPaymentId: "pay_rzp_901",
      status: "shipped",
      shipping: {
        courier: "delhivery",
        waybill: "998877665544",
        status: "in_transit",
        delhiveryStatus: "In Transit"
      }
    });
  });

  describe("1. Security & Admin Authorization Guard", () => {
    it("rejects unauthenticated requests to finance endpoints with 401", async () => {
      const endpoints = [
        "/api/admin/finance/expenses",
        "/api/admin/finance/procurement/inward",
        "/api/admin/finance/reconciliation/razorpay",
        "/api/admin/finance/reconciliation/delhivery",
        "/api/admin/finance/reconciliation/summary",
        "/api/admin/finance/reports/saved"
      ];
      for (const ep of endpoints) {
        const res = await request(app).get(ep);
        expect(res.status).toBe(401);
      }
    });

    it("rejects non-admin users with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/admin/finance/expenses")
        .set("Authorization", `Bearer ${normalToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe("2. Expense Management, GST Breakdown & ITC Safety", () => {
    it("creates an expense with accurate GST breakdown and ITC eligibility", async () => {
      const expensePayload = {
        expenseDate: new Date(),
        category: "software_it",
        subcategory: "Cloud Hosting",
        description: "AWS Cloud Infrastructure - Monthly",
        vendor: {
          name: "Amazon Web Services India",
          gstin: "29AABCA1234F1Z5"
        },
        invoiceNumber: "AWS-INV-2026-09",
        taxableAmount: 10000,
        cgst: 900,
        sgst: 900,
        igst: 0,
        grossAmount: 11800,
        paymentMethod: "bank_transfer",
        paymentStatus: "paid",
        itcEligibility: "eligible"
      };

      const res = await request(app)
        .post("/api/admin/finance/expenses")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(expensePayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.expense.description).toBe("AWS Cloud Infrastructure - Monthly");
      expect(res.body.expense.totalGst).toBe(1800);
      expect(res.body.expense.grossAmount).toBe(11800);
      expect(res.body.expense.itcEligibility).toBe("eligible");
      expect(res.body.expense.itcAmount).toBe(1800); // 1800 eligible ITC
    });

    it("validates that blocked/ineligible ITC is safely set to ₹0 ITC amount", async () => {
      const expensePayload = {
        expenseDate: new Date(),
        category: "other",
        description: "Staff Refreshments / Canteen",
        vendor: {
          name: "Cafe Prime",
          gstin: "29BBBBB1234F1Z1"
        },
        taxableAmount: 5000,
        cgst: 250,
        sgst: 250,
        itcEligibility: "blocked"
      };

      const res = await request(app)
        .post("/api/admin/finance/expenses")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(expensePayload);

      expect(res.status).toBe(201);
      expect(res.body.expense.totalGst).toBe(500);
      expect(res.body.expense.itcEligibility).toBe("blocked");
      expect(res.body.expense.itcAmount).toBe(0); // Safely 0 for blocked ITC
    });

    it("fetches expense summary and categorizes ITC statuses accurately", async () => {
      // Create one eligible and one blocked expense
      await Expense.create({
        expenseDate: new Date(),
        category: "software_it",
        description: "Software License",
        vendor: { name: "Adobe" },
        taxableAmount: 10000,
        cgst: 900,
        sgst: 900,
        totalGst: 1800,
        grossAmount: 11800,
        itcEligibility: "eligible",
        itcAmount: 1800,
        status: "approved"
      });

      await Expense.create({
        expenseDate: new Date(),
        category: "other",
        description: "Food",
        vendor: { name: "Cafe" },
        taxableAmount: 5000,
        cgst: 250,
        sgst: 250,
        totalGst: 500,
        grossAmount: 5500,
        itcEligibility: "blocked",
        itcAmount: 0,
        status: "approved"
      });

      const res = await request(app)
        .get("/api/admin/finance/expenses/summary")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.totals.totalExpenses).toBe(2);
      expect(res.body.totals.taxableSpend).toBe(15000);
      expect(res.body.totals.totalGstPaid).toBe(2300);
      expect(res.body.totals.totalItcEligible).toBe(1800);
    });

    it("supports soft cancellation of an expense for financial auditability", async () => {
      const expense = await Expense.create({
        expenseDate: new Date(),
        category: "other",
        description: "Mistaken Entry",
        vendor: { name: "Vendor Y" },
        taxableAmount: 1000,
        totalGst: 0,
        grossAmount: 1000,
        status: "approved"
      });

      const res = await request(app)
        .delete(`/api/admin/finance/expenses/${expense._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.expense.status).toBe("cancelled");
    });
  });

  describe("3. Stock Inward (Procurement GRN Foundation)", () => {
    it("records a stock inward GRN with landed cost calculations without altering catalog stock automatically", async () => {
      const inwardPayload = {
        grnNumber: "GRN-2026-001",
        supplier: {
          name: "Apex Footwear Manufacturers",
          gstin: "27AABCA5555F1Z2",
          contact: "+91-9876500000"
        },
        invoiceNumber: "APEX-2026-881",
        invoiceDate: new Date(),
        receivedDate: new Date(),
        items: [{
          product: testProduct._id,
          sku: testProduct.sku,
          name: testProduct.name,
          quantityReceived: 50,
          unitCost: 1000,
          taxAmount: 6000, // 12% GST = 120/pair
          freightShare: 1500, // 30/pair
          landedUnitCost: 1150
        }]
      };

      const res = await request(app)
        .post("/api/admin/finance/procurement/inward")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(inwardPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.stockInward.grnNumber).toBe("GRN-2026-001");
      expect(res.body.stockInward.totalQuantity).toBe(50);
      expect(res.body.stockInward.totalGrossCost).toBe(50000);
      expect(res.body.stockInward.totalLandedCost).toBe(57500);

      // Verify catalog stock is not arbitrarily rewritten
      const productInDb = await Product.findById(testProduct._id);
      expect(productInDb.totalStock).toBe(25);
    });

    it("prevents duplicate GRN number creation", async () => {
      await StockInward.create({
        grnNumber: "GRN-2026-001",
        supplier: { name: "Supplier 1" },
        receivedDate: new Date(),
        items: [{
          product: testProduct._id,
          name: testProduct.name,
          quantityReceived: 10,
          unitCost: 1000,
          landedUnitCost: 1000
        }]
      });

      const duplicatePayload = {
        grnNumber: "GRN-2026-001",
        supplier: { name: "Another Supplier" },
        items: [{
          product: testProduct._id,
          name: testProduct.name,
          quantityReceived: 10,
          unitCost: 1000,
          landedUnitCost: 1000
        }]
      };

      const res = await request(app)
        .post("/api/admin/finance/procurement/inward")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(duplicatePayload);

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it("rejects GRN with invalid/non-existent product reference", async () => {
      const invalidProductPayload = {
        grnNumber: "GRN-2026-999",
        supplier: { name: "Supplier X" },
        items: [{
          product: new mongoose.Types.ObjectId(),
          name: "Nonexistent Shoe",
          quantityReceived: 10,
          unitCost: 1000,
          landedUnitCost: 1000
        }]
      };

      const res = await request(app)
        .post("/api/admin/finance/procurement/inward")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invalidProductPayload);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/does not exist in catalog/i);
    });
  });

  describe("4. Razorpay Settlement Ingestion & Reconciliation Engine", () => {
    it("imports Razorpay settlement, matches known orders, detects amount mismatches and unknown orders", async () => {
      const settlementPayload = {
        settlementId: "setl_test_2026_001",
        settlementDate: new Date(),
        grossAmount: 8498,
        feeAmount: 169.96, // Gateway fee
        taxAmount: 30.59,  // GST on fee
        feeProvenance: "actual",
        netAmount: 8297.45,
        utr: "HDFC20260901001",
        transactions: [
          // 1. Matched Order
          {
            paymentId: "pay_rzp_901",
            orderId: "order_rzp_901",
            amount: 3499,
            fee: 69.98,
            tax: 12.60
          },
          // 2. Amount Mismatch
          {
            paymentId: "pay_rzp_mismatch",
            orderId: "order_rzp_901",
            lyvoOrderNumber: "LYVO-ORD-2026-901",
            amount: 2999, // Mismatched vs order total 3499
            fee: 59.98,
            tax: 10.80
          },
          // 3. Unknown Order
          {
            paymentId: "pay_rzp_unknown_999",
            orderId: "order_rzp_unknown",
            amount: 2000,
            fee: 40.00,
            tax: 7.20
          },
          // 4. Duplicate payment in batch
          {
            paymentId: "pay_rzp_901",
            orderId: "order_rzp_901",
            amount: 3499
          }
        ]
      };

      const res = await request(app)
        .post("/api/admin/finance/reconciliation/razorpay/import")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(settlementPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.settlement.settlementId).toBe("setl_test_2026_001");
      expect(res.body.settlement.reconciliationSummary.matchedCount).toBe(1);
      expect(res.body.settlement.reconciliationSummary.mismatchCount).toBe(1);
      expect(res.body.settlement.reconciliationSummary.unmatchedCount).toBe(1);
      expect(res.body.settlement.reconciliationSummary.duplicateCount).toBe(1);
      expect(res.body.settlement.reconciliationSummary.status).toBe("partially_reconciled");
    });

    it("strictly prevents duplicate settlement ingestion (idempotency guard)", async () => {
      await RazorpaySettlement.create({
        settlementId: "setl_test_2026_001",
        settlementDate: new Date(),
        grossAmount: 5000,
        feeAmount: 100,
        taxAmount: 18,
        netAmount: 4882
      });

      const duplicatePayload = {
        settlementId: "setl_test_2026_001",
        settlementDate: new Date(),
        grossAmount: 5000,
        feeAmount: 100,
        taxAmount: 18,
        netAmount: 4882
      };

      const res = await request(app)
        .post("/api/admin/finance/reconciliation/razorpay/import")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(duplicatePayload);

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already been imported/i);
    });
  });

  describe("5. Delhivery Courier Freight Reconciliation Engine", () => {
    it("imports carrier freight invoice, matches AWBs, and flags unknown and duplicate waybills", async () => {
      const invoicePayload = {
        invoiceNumber: "DEL-INV-2026-SEP-01",
        invoiceDate: new Date(),
        carrier: "delhivery",
        totalBilledAmount: 250,
        lineItems: [
          // 1. Matched waybill
          {
            waybill: "998877665544",
            chargedWeightGrams: 900,
            freight: 120,
            fuelSurcharge: 15,
            codHandling: 0,
            taxAmount: 24.3,
            totalCarrierCharge: 159.3
          },
          // 2. Unknown waybill
          {
            waybill: "000000000000",
            chargedWeightGrams: 500,
            freight: 70,
            totalCarrierCharge: 70
          },
          // 3. Duplicate waybill in batch
          {
            waybill: "998877665544",
            totalCarrierCharge: 159.3
          }
        ]
      };

      const res = await request(app)
        .post("/api/admin/finance/reconciliation/delhivery/import")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invoicePayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.invoice.invoiceNumber).toBe("DEL-INV-2026-SEP-01");
      expect(res.body.invoice.reconciliationSummary.matchedShipments).toBe(1);
      expect(res.body.invoice.reconciliationSummary.unmatchedShipments).toBe(1);
      expect(res.body.invoice.reconciliationSummary.duplicateCount).toBe(1);
    });

    it("strictly prevents duplicate carrier invoice ingestion (idempotency guard)", async () => {
      await CourierInvoice.create({
        invoiceNumber: "DEL-INV-2026-SEP-01",
        invoiceDate: new Date(),
        carrier: "delhivery",
        totalBilledAmount: 1000
      });

      const duplicatePayload = {
        invoiceNumber: "DEL-INV-2026-SEP-01",
        invoiceDate: new Date(),
        totalBilledAmount: 1000
      };

      const res = await request(app)
        .post("/api/admin/finance/reconciliation/delhivery/import")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(duplicatePayload);

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already been imported/i);
    });
  });

  describe("6. Saved Reports & Export Logs Management", () => {
    it("creates, fetches, and deletes saved report templates", async () => {
      const createRes = await request(app)
        .post("/api/admin/finance/reports/saved")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Monthly P&L Custom View",
          description: "Filtered by footwear categories and completed orders",
          reportType: "financial_pnl",
          filters: { category: "Running Footwear" },
          selectedColumns: ["grossMerchandiseSales", "couponDiscounts", "netSales", "totalCogs", "grossProfit"]
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.report.name).toBe("Monthly P&L Custom View");

      const listRes = await request(app)
        .get("/api/admin/finance/reports/saved")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.reports.length).toBe(1);

      const deleteRes = await request(app)
        .delete(`/api/admin/finance/reports/saved/${createRes.body.report._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);
    });

    it("logs export requests and tracks status transitions in export history", async () => {
      const logRes = await request(app)
        .post("/api/admin/finance/reports/exports/log")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          exportId: "exp_test_2026_01",
          reportName: "Quarterly Tax Report",
          reportType: "tax_liability",
          format: "xlsx",
          filters: { dateRange: "last_90_days" },
          recordCount: 145
        });

      expect(logRes.status).toBe(201);
      expect(logRes.body.log.status).toBe("pending");

      const historyRes = await request(app)
        .get("/api/admin/finance/reports/exports/history")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.logs.length).toBe(1);
      expect(historyRes.body.logs[0].exportId).toBe("exp_test_2026_01");
    });
  });

  describe("7. Reconciliation Center Summary", () => {
    it("returns aggregated payment and shipping reconciliation status summary", async () => {
      // Seed a settlement and a courier invoice
      await RazorpaySettlement.create({
        settlementId: "setl_summary_01",
        settlementDate: new Date(),
        grossAmount: 3499,
        feeAmount: 70,
        taxAmount: 12.6,
        netAmount: 3416.4,
        reconciliationSummary: {
          totalTransactions: 1,
          matchedCount: 1,
          unmatchedCount: 0,
          status: "fully_reconciled"
        }
      });

      await CourierInvoice.create({
        invoiceNumber: "del_summary_01",
        invoiceDate: new Date(),
        totalBilledAmount: 159.3,
        reconciliationSummary: {
          matchedShipments: 1,
          unmatchedShipments: 0,
          totalActualFreight: 159.3,
          status: "reconciled"
        }
      });

      const res = await request(app)
        .get("/api/admin/finance/reconciliation/summary")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.payments).toBeDefined();
      expect(res.body.payments.totalSettlements).toBe(1);
      expect(res.body.payments.matchedTxCount).toBe(1);
      expect(res.body.shipping).toBeDefined();
      expect(res.body.shipping.totalInvoices).toBe(1);
      expect(res.body.shipping.matchedShipmentCount).toBe(1);
    });
  });
});
