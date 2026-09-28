require("./setup");
const request = require("supertest");
const app = require("../app");
const Product = require("../models/Product");
const { Category, Coupon } = require("../models/models");
const User = require("../models/User");

describe("Order API Tests & Concurrency Checks", () => {
  let userToken, userId, productObj, couponCode;

  beforeEach(async () => {
    const user = await User.create({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "password123",
      phone: "9876543211"
    });
    userId = user._id;

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "jane@example.com", password: "password123" });
    userToken = loginRes.body.token;

    const category = await Category.create({ name: "Life", slug: "life", sortOrder: 1 });

    productObj = await Product.create({
      name: "Limited Edition Sneakers",
      description: "Only one pair in stock!",
      brand: "Puma",
      category: category._id,
      gender: "unisex",
      price: 5000,
      sizes: [{ size: "UK 9", stock: 1 }],
      totalStock: 1,
      isActive: true
    });

    const coupon = await Coupon.create({
      code: "SAVE10",
      type: "percentage",
      value: 10,
      minPurchase: 1000,
      maxDiscount: 1000,
      expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdBy: userId,
      isActive: true
    });
    couponCode = coupon.code;
  });

  it("should successfully apply coupon and calculate pricing math", async () => {
    const res = await request(app)
      .post("/api/coupons/validate")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        code: couponCode,
        cartTotal: 5000
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.discount).toBe(500);
  });

  it("should place COD order successfully and deduct stock", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        items: [{
          product: productObj._id.toString(),
          name: productObj.name,
          price: productObj.price,
          size: "UK 9",
          quantity: 1
        }],
        shippingAddress: {
          fullName: "Jane Doe",
          phone: "9876543211",
          address: "123 Main St",
          city: "Metropolis",
          state: "NY",
          zipCode: "10001",
          country: "USA"
        },
        paymentMethod: "cod"
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.order).toHaveProperty("orderNumber");

    const updatedProd = await Product.findById(productObj._id);
    expect(updatedProd.sizes[0].stock).toBe(0);
    expect(updatedProd.totalStock).toBe(0);
  });

  it("should prevent stock race conditions when 2 orders are placed concurrently", async () => {
    const orderPayload = {
      items: [{
        product: productObj._id.toString(),
        name: productObj.name,
        price: productObj.price,
        size: "UK 9",
        quantity: 1
      }],
      shippingAddress: {
        fullName: "Jane Doe",
        phone: "9876543211",
        address: "123 Main St",
        city: "Metropolis",
        state: "NY",
        zipCode: "10001",
        country: "USA"
      },
      paymentMethod: "cod"
    };

    const responses = await Promise.all([
      request(app).post("/api/orders").set("Authorization", `Bearer ${userToken}`).send(orderPayload),
      request(app).post("/api/orders").set("Authorization", `Bearer ${userToken}`).send(orderPayload)
    ]);

    const statusCodes = responses.map(r => r.statusCode);
    expect(statusCodes).toContain(201);
    expect(statusCodes).toContain(400);

    const errorResponse = responses.find(r => r.statusCode === 400);
    expect(errorResponse.body.message).toMatch(/insufficient stock/i);
  });

  describe("Razorpay Payment Verification in placeOrder", () => {
    const crypto = require("crypto");

    it("should place order with valid Razorpay signature and mark isPaid=true", async () => {
      const orderId = "order_rzp_123";
      const paymentId = "pay_rzp_123";
      const signature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const res = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          items: [{
            product: productObj._id.toString(),
            name: productObj.name,
            price: productObj.price,
            size: "UK 9",
            quantity: 1
          }],
          shippingAddress: {
            fullName: "Jane Doe",
            phone: "9876543211",
            address: "123 Main St",
            city: "Metropolis",
            state: "NY",
            zipCode: "10001",
            country: "USA"
          },
          paymentMethod: "card",
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: signature
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.order.isPaid).toBe(true);
      expect(res.body.order.paidAt).toBeDefined();
    });

    it("should reject order when Razorpay signature is invalid and not deduct stock", async () => {
      const res = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          items: [{
            product: productObj._id.toString(),
            name: productObj.name,
            price: productObj.price,
            size: "UK 9",
            quantity: 1
          }],
          shippingAddress: {
            fullName: "Jane Doe",
            phone: "9876543211",
            address: "123 Main St",
            city: "Metropolis",
            state: "NY",
            zipCode: "10001",
            country: "USA"
          },
          paymentMethod: "card",
          razorpayOrderId: "order_rzp_123",
          razorpayPaymentId: "pay_rzp_123",
          razorpaySignature: "invalid_tampered_signature"
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/signature verification failed/i);

      // Stock should still be 1
      const prod = await Product.findById(productObj._id);
      expect(prod.sizes[0].stock).toBe(1);
    });

    it("should fail closed and not create order when RAZORPAY_KEY_SECRET is unset", async () => {
      const originalSecret = process.env.RAZORPAY_KEY_SECRET;
      delete process.env.RAZORPAY_KEY_SECRET;

      try {
        const res = await request(app)
          .post("/api/orders")
          .set("Authorization", `Bearer ${userToken}`)
          .send({
            items: [{
              product: productObj._id.toString(),
              name: productObj.name,
              price: productObj.price,
              size: "UK 9",
              quantity: 1
            }],
            shippingAddress: {
              fullName: "Jane Doe",
              phone: "9876543211",
              address: "123 Main St",
              city: "Metropolis",
              state: "NY",
              zipCode: "10001",
              country: "USA"
            },
            paymentMethod: "card",
            razorpayOrderId: "order_rzp_123",
            razorpayPaymentId: "pay_rzp_123",
            razorpaySignature: "dummy_sig"
          });

        expect(res.statusCode).toBe(500);
        expect(res.body.message).toMatch(/RAZORPAY_KEY_SECRET/i);

        // Stock should still be 1
        const prod = await Product.findById(productObj._id);
        expect(prod.sizes[0].stock).toBe(1);
      } finally {
        process.env.RAZORPAY_KEY_SECRET = originalSecret;
      }
    });
  });
});
