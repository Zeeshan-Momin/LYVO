require("./setup");
const request = require("supertest");
const app = require("../server");
const User = require("../models/User");
const { Category, Coupon } = require("../models/models");

describe("Admin & Controller API Tests", () => {
  let adminToken, categoryId, couponId;

  beforeEach(async () => {
    const admin = await User.create({
      name: "Admin User",
      email: "admin@example.com",
      password: "password123",
      role: "admin",
      phone: "9999999990"
    });
    
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "password123" });
    adminToken = loginRes.body.token;

    const category = await Category.create({
      name: "Training",
      slug: "training",
      sortOrder: 2
    });
    categoryId = category._id;

    const coupon = await Coupon.create({
      code: "HOLIDAY50",
      type: "percentage",
      value: 50,
      minPurchase: 1000,
      maxDiscount: 1000,
      expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdBy: admin._id,
      isActive: true
    });
    couponId = coupon._id;
  });

  it("should block non-admins from hitting dashboard", async () => {
    await User.create({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "password123",
      phone: "9876543210"
    });
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "jane@example.com", password: "password123" });
    const userToken = loginRes.body.token;

    const res = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.statusCode).toBe(403);
  });

  it("should retrieve dashboard statistics for admin", async () => {
    const res = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("success", true);
  });

  it("should CRUD category by admin", async () => {
    const createRes = await request(app)
      .post("/api/admin/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Running Shoes", sortOrder: 3 });

    expect(createRes.statusCode).toBe(201);
    expect(createRes.body.category).toHaveProperty("slug", "running-shoes");

    const categoryId = createRes.body.category._id;

    const updateRes = await request(app)
      .put(`/api/admin/categories/${categoryId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Running Shoes New", sortOrder: 4 });

    expect(updateRes.statusCode).toBe(200);

    const deleteRes = await request(app)
      .delete(`/api/admin/categories/${categoryId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(deleteRes.statusCode).toBe(200);
  });

  it("should CRUD coupon by admin", async () => {
    const createRes = await request(app)
      .post("/api/admin/coupons")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: "SALE20",
        type: "percentage",
        value: 20,
        minPurchase: 500,
        maxDiscount: 200,
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

    expect(createRes.statusCode).toBe(201);
    expect(createRes.body.coupon).toHaveProperty("code", "SALE20");

    const testCouponId = createRes.body.coupon._id;

    const updateRes = await request(app)
      .put(`/api/admin/coupons/${testCouponId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: "SALE20UPDATED",
        type: "percentage",
        value: 20,
        minPurchase: 500,
        maxDiscount: 200,
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

    expect(updateRes.statusCode).toBe(200);

    const deleteRes = await request(app)
      .delete(`/api/admin/coupons/${testCouponId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(deleteRes.statusCode).toBe(200);
  });
});
