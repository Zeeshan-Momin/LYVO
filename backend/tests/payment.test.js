require("./setup");
const request = require("supertest");
const app = require("../app");
const User = require("../models/User");

describe("Razorpay Integration API Tests", () => {
  let userToken, userId;

  beforeEach(async () => {
    const user = await User.create({
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
      phone: "9876543210"
    });
    userId = user._id;

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "john@example.com", password: "password123" });
    userToken = loginRes.body.token;
  });

  describe("POST /api/payment/create-order & POST /api/create-order", () => {
    it("should fail order creation without auth (return 401)", async () => {
      const res = await request(app)
        .post("/api/payment/create-order")
        .send({ amount: 500, currency: "INR" });
      expect(res.statusCode).toBe(401);
    });

    it("should fail order creation if amount < 100 paise (return 400)", async () => {
      const res = await request(app)
        .post("/api/payment/create-order")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ amount: 50, currency: "INR" });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/at least 100 paise/i);
    });

    it("should create order successfully on /api/payment/create-order (return 200)", async () => {
      const res = await request(app)
        .post("/api/payment/create-order")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ amount: 500, currency: "INR", receipt: "test_receipt" });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.amount).toBe(500);
      expect(res.body.currency).toBe("INR");
      expect(res.body).toHaveProperty("order_id");
    });

    it("should create order successfully on alias /api/create-order (return 200)", async () => {
      const res = await request(app)
        .post("/api/create-order")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ amount: 1000, currency: "INR", receipt: "test_receipt" });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.amount).toBe(1000);
      expect(res.body.currency).toBe("INR");
      expect(res.body).toHaveProperty("order_id");
    });
  });

  describe("POST /api/payment/verify-payment & POST /api/verify-payment", () => {
    it("should fail verification with missing fields (return 400)", async () => {
      const res = await request(app)
        .post("/api/payment/verify-payment")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ razorpayOrderId: "order_id" });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/missing/i);
    });

    it("should pass verification when a valid signature is provided (return 200)", async () => {
      const crypto = require("crypto");
      const orderId = "order_123456";
      const paymentId = "pay_123456";
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      const signature = crypto
        .createHmac("sha256", keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const res = await request(app)
        .post("/api/payment/verify-payment")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: signature
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Payment verified successfully");
    });

    it("should reject verification when signature is invalid / tampered (return 400)", async () => {
      // Test different length
      const resDiffLen = await request(app)
        .post("/api/payment/verify-payment")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          razorpayOrderId: "order_123456",
          razorpayPaymentId: "pay_123456",
          razorpaySignature: "invalid_short_sig"
        });

      expect(resDiffLen.statusCode).toBe(400);
      expect(resDiffLen.body.success).toBe(false);
      expect(resDiffLen.body.message).toMatch(/signature verification failed/i);

      // Test same length (64 hex characters) but incorrect digest
      const resSameLen = await request(app)
        .post("/api/payment/verify-payment")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          razorpayOrderId: "order_123456",
          razorpayPaymentId: "pay_123456",
          razorpaySignature: "0".repeat(64)
        });

      expect(resSameLen.statusCode).toBe(400);
      expect(resSameLen.body.success).toBe(false);
      expect(resSameLen.body.message).toMatch(/signature verification failed/i);
    });

    it("should fail closed rather than defaulting to paid when RAZORPAY_KEY_SECRET is unset", async () => {
      const originalSecret = process.env.RAZORPAY_KEY_SECRET;
      delete process.env.RAZORPAY_KEY_SECRET;

      try {
        const res = await request(app)
          .post("/api/payment/verify-payment")
          .set("Authorization", `Bearer ${userToken}`)
          .send({
            razorpayOrderId: "order_123456",
            razorpayPaymentId: "pay_123456",
            razorpaySignature: "some_signature"
          });

        expect(res.statusCode).toBe(500);
        expect(res.body.success).toBe(false);
      } finally {
        process.env.RAZORPAY_KEY_SECRET = originalSecret;
      }
    });

    it("should NOT bypass verification even if RAZORPAY_KEY_SECRET contains 'xxxx' or 'mock'", async () => {
      const originalSecret = process.env.RAZORPAY_KEY_SECRET;
      process.env.RAZORPAY_KEY_SECRET = "rzp_secret_mock_xxxxxxxxxxxx";

      try {
        const res = await request(app)
          .post("/api/payment/verify-payment")
          .set("Authorization", `Bearer ${userToken}`)
          .send({
            razorpayOrderId: "order_123456",
            razorpayPaymentId: "pay_123456",
            razorpaySignature: "invalid_mock_attempt"
          });

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
      } finally {
        process.env.RAZORPAY_KEY_SECRET = originalSecret;
      }
    });

    it("should allow mock verification ONLY when ALLOW_MOCK_PAYMENTS === 'true' in test environment", async () => {
      process.env.ALLOW_MOCK_PAYMENTS = "true";

      try {
        const res = await request(app)
          .post("/api/payment/verify-payment")
          .set("Authorization", `Bearer ${userToken}`)
          .send({
            razorpayOrderId: "order_123456",
            razorpayPaymentId: "pay_123456",
            razorpaySignature: "bypass_sig"
          });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toMatch(/mock mode/i);
      } finally {
        delete process.env.ALLOW_MOCK_PAYMENTS;
      }
    });
  });
});
