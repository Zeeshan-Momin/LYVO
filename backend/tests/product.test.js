require("./setup");
const request = require("supertest");
const app = require("../server");
const Product = require("../models/Product");
const { Category } = require("../models/models");
const User = require("../models/User");

describe("Product Catalog API Tests", () => {
  let adminToken, categoryId, productObj;

  beforeEach(async () => {
    const admin = await User.create({
      name: "Admin User",
      email: "admin@example.com",
      password: "password123",
      role: "admin",
      phone: "9999999999"
    });
    
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "password123" });
    adminToken = loginRes.body.token;

    const category = await Category.create({
      name: "Running",
      slug: "running",
      sortOrder: 1
    });
    categoryId = category._id;

    productObj = await Product.create({
      name: "Nike Air Max",
      description: "Comfortable running shoe of high quality",
      brand: "Nike",
      category: categoryId,
      gender: "men",
      price: 10000,
      sizes: [{ size: "UK 9", stock: 10 }],
      totalStock: 10,
      isActive: true
    });
  });

  it("should get all products", async () => {
    const res = await request(app).get("/api/products");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body.products.length).toBe(1);
    expect(res.body.products[0]).toHaveProperty("name", "Nike Air Max");
  });

  it("should filter products by gender", async () => {
    const res = await request(app).get("/api/products?gender=men");
    expect(res.statusCode).toBe(200);
    expect(res.body.products.length).toBe(1);

    const emptyRes = await request(app).get("/api/products?gender=women");
    expect(emptyRes.statusCode).toBe(200);
    expect(emptyRes.body.products.length).toBe(0);
  });

  it("should filter products by maxPrice", async () => {
    const res = await request(app).get("/api/products?maxPrice=12000");
    expect(res.statusCode).toBe(200);
    expect(res.body.products.length).toBe(1);

    const emptyRes = await request(app).get("/api/products?maxPrice=8000");
    expect(emptyRes.statusCode).toBe(200);
    expect(emptyRes.body.products.length).toBe(0);
  });

  it("should search suggestions by brand prefix", async () => {
    const res = await request(app).get("/api/products/search?q=Nik");
    expect(res.statusCode).toBe(200);
    expect(res.body.suggestions.length).toBe(1);
    expect(res.body.suggestions[0]).toHaveProperty("brand", "Nike");
  });
});
