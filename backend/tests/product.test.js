require("./setup");
const request = require("supertest");
const app = require("../app");
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

  it("should create a product with shipping dimensions and image metadata", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Adidas Ultraboost",
        description: "High performance running shoe",
        brand: "Adidas",
        category: categoryId,
        gender: "unisex",
        price: 15000,
        sizes: JSON.stringify([{ size: "UK 8", stock: 5 }]),
        weightGrams: 850,
        lengthCm: 32,
        widthCm: 20,
        heightCm: 12
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.product).toHaveProperty("weightGrams", 850);
    expect(res.body.product).toHaveProperty("lengthCm", 32);
    expect(res.body.product).toHaveProperty("widthCm", 20);
    expect(res.body.product).toHaveProperty("heightCm", 12);
  });

  it("should update product and preserve existing image metadata", async () => {
    const res = await request(app)
      .put(`/api/products/${productObj._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Nike Air Max 90 Updated",
        existingImages: JSON.stringify([
          { url: "https://res.cloudinary.com/test/image/upload/v1/sample.jpg", publicId: "lyvo/products/test/sample", isPrimary: true }
        ])
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.product.name).toBe("Nike Air Max 90 Updated");
    expect(res.body.product.images.length).toBe(1);
    expect(res.body.product.images[0].isPrimary).toBe(true);
  });

  it("should delete a single image from a product", async () => {
    const prod = await Product.create({
      name: "Shoe with images",
      description: "Test description",
      brand: "Puma",
      category: categoryId,
      gender: "unisex",
      price: 5000,
      images: [
        { url: "https://res.cloudinary.com/test/1.jpg", publicId: "lyvo/products/p1/img1", isPrimary: true },
        { url: "https://res.cloudinary.com/test/2.jpg", publicId: "lyvo/products/p1/img2", isPrimary: false }
      ]
    });

    const res = await request(app)
      .delete(`/api/products/${prod._id}/image`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ publicId: "lyvo/products/p1/img1" });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.images.length).toBe(1);
    expect(res.body.images[0].publicId).toBe("lyvo/products/p1/img2");
    expect(res.body.images[0].isPrimary).toBe(true);
  });

  it("should delete a product and return success", async () => {
    const res = await request(app)
      .delete(`/api/products/${productObj._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const check = await Product.findById(productObj._id);
    expect(check).toBeNull();
  });
});
