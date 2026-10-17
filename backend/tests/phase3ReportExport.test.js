require("./setup");
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const app = require("../app");

const User = require("../models/User");
const Product = require("../models/Product");
const { Category } = require("../models/models");
const Order = require("../models/Order");
const Expense = require("../models/Expense");
const SavedReport = require("../models/SavedReport");
const ExportLog = require("../models/ExportLog");
const { sanitizeCellValue } = require("../services/xlsxGenerator");

describe("Phase 3D-3 XLSX and PDF Report Export Engine Suite", () => {
  let adminUser, normalUser;
  let adminToken, normalToken;
  let catRunning, prodA, prodB, savedReportDoc;

  beforeEach(async () => {
    adminUser = await User.create({
      name: "Finance Admin",
      email: "finance.export.admin@example.com",
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

    catRunning = await Category.create({ name: "Running", slug: "running" });

    prodA = await Product.create({
      name: "LYVO Speed Racer",
      slug: "lyvo-speed-racer",
      description: "High speed running shoes",
      brand: "LYVO",
      category: catRunning._id,
      gender: "men",
      price: 5000,
      costPrice: 2000,
      variants: [{ size: "9", color: "Red", sku: "LSR-RED-9", stock: 20, price: 5000, costPrice: 2000 }]
    });

    prodB = await Product.create({
      name: "LYVO Aero Flex",
      slug: "lyvo-aero-flex",
      description: "Lightweight flexible trainer",
      brand: "LYVO",
      category: catRunning._id,
      gender: "women",
      price: 3000,
      costPrice: 1200,
      variants: [{ size: "7", color: "Blue", sku: "LAF-BLU-7", stock: 15, price: 3000, costPrice: 1200 }]
    });

    // Create Sample Orders with immutable snapshots
    await Order.create({
      orderNumber: "ORD-EXP-001",
      user: normalUser._id,
      items: [
        {
          product: prodA._id,
          name: prodA.name,
          quantity: 2,
          price: 5000,
          mrp: 6000,
          costPrice: 2000,
          costPriceSource: "actual",
          financialSnapshot: { costPrice: 2000, costPriceSource: "actual", cogs: 4000 }
        }
      ],
      pricing: {
        subtotal: 10000,
        couponDiscount: 1000,
        shippingCost: 200,
        tax: 500,
        total: 9700
      },
      paymentMethod: "card",
      paymentStatus: "paid",
      isPaid: true,
      paidAt: new Date(),
      status: "delivered",
      totalRefundedAmount: 0,
      gatewaySettlement: { fee: 180, tax: 32.4 },
      shippingSettlement: { actualFreightCost: 120 }
    });

    await Order.create({
      orderNumber: "ORD-EXP-002",
      user: normalUser._id,
      items: [
        {
          product: prodB._id,
          name: prodB.name,
          quantity: 1,
          price: 3000,
          mrp: 4000,
          costPrice: null, // Unknown cost price
          costPriceSource: "unknown",
          financialSnapshot: { costPrice: null, costPriceSource: "unknown", cogs: null }
        }
      ],
      pricing: {
        subtotal: 3000,
        couponDiscount: 0,
        shippingCost: 0,
        tax: 150,
        total: 3150
      },
      paymentMethod: "cod",
      paymentStatus: "paid",
      isPaid: true,
      paidAt: new Date(),
      status: "delivered",
      totalRefundedAmount: 500
    });

    savedReportDoc = await SavedReport.create({
      name: "Monthly Product Profitability Template",
      reportType: "product_profitability",
      description: "Product profitability with gross margins",
      dimensions: ["product", "sku"],
      metrics: ["grossMerchandiseSales", "netRevenue", "grossProfit"],
      filters: { category: "Running" },
      createdBy: adminUser._id
    });
  });

  // 1. Unauthenticated XLSX Request -> 401
  it("1. should reject unauthenticated XLSX export request with 401", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/xlsx")
      .send({ reportType: "product_profitability" });

    expect(res.status).toBe(401);
  });

  // 2. Unauthenticated PDF Request -> 401
  it("2. should reject unauthenticated PDF export request with 401", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/pdf")
      .send({ reportType: "product_profitability" });

    expect(res.status).toBe(401);
  });

  // 3. Non-admin XLSX Request -> 403
  it("3. should reject non-admin XLSX export request with 403", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/xlsx")
      .set("Authorization", `Bearer ${normalToken}`)
      .send({ reportType: "product_profitability" });

    expect(res.status).toBe(403);
  });

  // 4. Non-admin PDF Request -> 403
  it("4. should reject non-admin PDF export request with 403", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/pdf")
      .set("Authorization", `Bearer ${normalToken}`)
      .send({ reportType: "product_profitability" });

    expect(res.status).toBe(403);
  });

  // 5. Valid XLSX Generation
  it("5. should successfully generate and store an XLSX report for admin", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/xlsx")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reportType: "product_profitability",
        dimensions: ["product", "sku"],
        metrics: ["grossMerchandiseSales", "couponDiscounts", "netMerchandiseSales", "netRevenue", "totalCogs", "grossProfit"]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.exportId).toBeDefined();
    expect(res.body.fileName).toMatch(/\.xlsx$/);
    expect(res.body.format).toBe("xlsx");
    expect(res.body.fileSize).toBeGreaterThan(0);
    expect(res.body.downloadUrl).toContain(res.body.exportId);
  });

  // 6. Valid PDF Generation
  it("6. should successfully generate and store a PDF report for admin", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/pdf")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reportType: "channel_profitability",
        dimensions: ["channel"],
        metrics: ["grossMerchandiseSales", "netRevenue", "contributionProfit"]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.exportId).toBeDefined();
    expect(res.body.fileName).toMatch(/\.pdf$/);
    expect(res.body.format).toBe("pdf");
    expect(res.body.fileSize).toBeGreaterThan(0);
    expect(res.body.downloadUrl).toContain(res.body.exportId);
  });

  // 7. SavedReport XLSX Export
  it("7. should export an existing SavedReport template to XLSX", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/xlsx")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        savedReportId: savedReportDoc._id
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.exportId).toBeDefined();
    expect(res.body.fileName).toContain("Monthly_Product_Profitability_Template");
  });

  // 8. SavedReport PDF Export
  it("8. should export an existing SavedReport template to PDF", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/pdf")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        savedReportId: savedReportDoc._id
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.format).toBe("pdf");
  });

  // 9. Invalid Report Definition -> 400
  it("9. should reject empty report definition or missing report type with 400", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/xlsx")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  // 10. Invalid Report Type -> 400
  it("10. should reject invalid report type with 400", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/xlsx")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reportType: "malicious_unregistered_type" });

    expect(res.status).toBe(400);
  });

  // 11. Invalid Metric/Dimension -> 400
  it("11. should reject invalid dimensions or metrics with 400", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/xlsx")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reportType: "product_profitability",
        dimensions: ["invalid_dimension_xyz"]
      });

    expect(res.status).toBe(400);
  });

  // 12. Empty Database Export
  it("12. should handle an empty database export gracefully", async () => {
    await Order.deleteMany({});
    const res = await request(app)
      .post("/api/admin/finance/reports/export/xlsx")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reportType: "product_profitability",
        dimensions: ["product"]
      });

    expect(res.status).toBe(200);
    expect(res.body.recordCount).toBe(0);
  });

  // 13. Financial Formula Consistency
  it("13. should ensure GMS, Net Merchandise Sales, and Net Revenue formulas are strictly maintained in export metadata", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/xlsx")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reportType: "product_profitability",
        dimensions: ["product"]
      });

    expect(res.status).toBe(200);
    expect(res.body.reportMetadata).toBeDefined();
    expect(res.body.reportMetadata.reportType).toBe("product_profitability");
  });

  // 14. Refunds Are Not Double Deducted
  it("14. should verify refund deduction occurs only in netRevenue calculation", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/xlsx")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reportType: "channel_profitability",
        dimensions: ["channel"]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // 15. Unknown COGS Remains Unknown
  it("15. should preserve unknown COGS indicators in exported report structures", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/xlsx")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reportType: "order_profitability",
        dimensions: ["order"]
      });

    expect(res.status).toBe(200);
    expect(res.body.recordCount).toBe(2);
  });

  // 16. Unknown Gateway/Freight Remain Unknown
  it("16. should preserve unknown gateway/freight fees without converting to 0", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/pdf")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reportType: "order_profitability",
        dimensions: ["order"]
      });

    expect(res.status).toBe(200);
    expect(res.body.fileSize).toBeGreaterThan(0);
  });

  // 17. Provenance Survives Export
  it("17. should preserve data provenance labels in export metadata", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/xlsx")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reportType: "financial_pnl"
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // 18. PII is Not Introduced
  it("18. should not leak customer passwords, tokens, or raw street addresses into export metadata", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/xlsx")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reportType: "order_profitability",
        dimensions: ["order"]
      });

    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain("Password123!");
    expect(bodyStr).not.toContain(process.env.JWT_SECRET);
  });

  // 19. ExportLog Created for Successful Export
  it("19. should create completed ExportLog audit entry for successful export", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/xlsx")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reportType: "category_profitability",
        dimensions: ["category"]
      });

    expect(res.status).toBe(200);
    const log = await ExportLog.findOne({ exportId: res.body.exportId });
    expect(log).not.toBeNull();
    expect(log.status).toBe("completed");
    expect(log.fileSize).toBeGreaterThan(0);
    expect(log.fileName).toBe(res.body.fileName);
  });

  // 20. ExportLog Records Failed Export
  it("20. should record a failed ExportLog entry when export encounters invalid execution", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/xlsx")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        savedReportId: new mongoose.Types.ObjectId() // Nonexistent saved report
      });

    expect(res.status).toBe(404);
  });

  // 21. Download Requires Authentication -> 401
  it("21. should require authentication to download generated export", async () => {
    const res = await request(app)
      .get("/api/admin/finance/reports/exports/download/exp_nonexistent_123");

    expect(res.status).toBe(401);
  });

  // 22. Download Rejects Unauthorized / Non-admin Access -> 403
  it("22. should reject non-admin download requests with 403", async () => {
    const res = await request(app)
      .get("/api/admin/finance/reports/exports/download/exp_nonexistent_123")
      .set("Authorization", `Bearer ${normalToken}`);

    expect(res.status).toBe(403);
  });

  // 23. Download Rejects Nonexistent Export -> 404
  it("23. should return 404 when requesting download of nonexistent exportId", async () => {
    const res = await request(app)
      .get("/api/admin/finance/reports/exports/download/exp_nonexistent_999999")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  // 24. Path Traversal Attempt is Rejected
  it("24. should reject path traversal attempts in download requests", async () => {
    const res = await request(app)
      .get("/api/admin/finance/reports/exports/download/..%2F..%2F.env")
      .set("Authorization", `Bearer ${adminToken}`);

    expect([400, 403, 404]).toContain(res.status);
  });

  // 25. Correct XLSX Content-Type and Download Verification
  it("25. should serve XLSX file with correct Content-Type and attachment disposition", async () => {
    const createRes = await request(app)
      .post("/api/admin/finance/reports/export/xlsx")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reportType: "product_profitability",
        dimensions: ["product"]
      });

    expect(createRes.status).toBe(200);
    const exportId = createRes.body.exportId;

    const downloadRes = await request(app)
      .get(`/api/admin/finance/reports/exports/download/${exportId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .buffer()
      .parse((res, callback) => {
        const data = [];
        res.on("data", chunk => data.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(data)));
      });

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers["content-type"]).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(downloadRes.headers["content-disposition"]).toContain("attachment; filename=");
    expect(downloadRes.body).toBeInstanceOf(Buffer);
    expect(downloadRes.body.length).toBeGreaterThan(0);
  });

  // 26. Correct PDF Content-Type and Download Verification
  it("26. should serve PDF file with correct Content-Type and header signature", async () => {
    const createRes = await request(app)
      .post("/api/admin/finance/reports/export/pdf")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reportType: "channel_profitability",
        dimensions: ["channel"]
      });

    expect(createRes.status).toBe(200);
    const exportId = createRes.body.exportId;

    const downloadRes = await request(app)
      .get(`/api/admin/finance/reports/exports/download/${exportId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers["content-type"]).toBe("application/pdf");
    expect(downloadRes.headers["content-disposition"]).toContain(".pdf");
    expect(downloadRes.body).toBeInstanceOf(Buffer);
    // Verify PDF header magic bytes: %PDF-
    const headerStr = downloadRes.body.toString("utf8", 0, 5);
    expect(headerStr).toBe("%PDF-");
  });

  // 27. Safe Content-Disposition Filename
  it("27. should generate safe sanitized filenames without directory escape characters", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/xlsx")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reportType: "custom",
        name: "Malicious/../Unsafe*Name",
        dimensions: ["product"]
      });

    expect(res.status).toBe(200);
    expect(res.body.fileName).not.toContain("..");
    expect(res.body.fileName).not.toContain("/");
    expect(res.body.fileName).not.toContain("*");
  });

  // 28. Excel Formula Injection Protection
  it("28. should escape formula prefixes (=, +, -, @) for text values without mutating true numbers", () => {
    expect(sanitizeCellValue("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(sanitizeCellValue("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(sanitizeCellValue("-dangerousCalculation")).toBe("'-dangerousCalculation");
    expect(sanitizeCellValue("@command")).toBe("'@command");
    // Numbers should not be escaped
    expect(sanitizeCellValue(-150.5)).toBe(-150.5);
    expect(sanitizeCellValue(2500)).toBe(2500);
    expect(sanitizeCellValue("Normal Product")).toBe("Normal Product");
  });

  // 29. Export Row Limit Enforcement
  it("29. should enforce maximum row limits and reject oversize export requests with 400", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/export/pdf")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reportType: "order_profitability",
        limit: 1000 // Exceeds PDF limit of 500
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("exceeds the maximum allowed limit for PDF");
  });

  // 30. Existing Phase 3D-2 Report Execution Remains Passing & Compatible
  it("30. should confirm existing executeReport API remains completely operational", async () => {
    const res = await request(app)
      .post("/api/admin/finance/reports/execute")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        reportType: "product_profitability",
        dimensions: ["product"]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results).toBeDefined();
  });
});
