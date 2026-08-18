require("./setup");
const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const Session = require("../models/Session");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

describe("Enterprise Authentication Security & RTR Tests", () => {
  let userObj, testEmail = "security-test@lyvo.com";

  beforeEach(async () => {
    await Session.deleteMany({});
    await User.deleteMany({ email: testEmail });

    userObj = await User.create({
      name: "Security Tester",
      email: testEmail,
      password: "SecurePassword@123",
      phone: "9876543210",
      isActive: true,
      isEmailVerified: true
    });
  });

  it("should enforce account lockout after 5 consecutive failed logins", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password: "wrong-password" });
      expect([401, 423]).toContain(res.statusCode);
    }

    const lockRes = await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: "SecurePassword@123" });

    expect(lockRes.statusCode).toBe(423);
    expect(lockRes.body.message).toContain("locked");
  });

  it("should support google authentication mock flow", async () => {
    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "mock-google-id-token" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body.user.email).toBe("google-demo-user@lyvo.com");
  });

  it("should implement Refresh Token Rotation and reuse detection", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: "SecurePassword@123" });
    
    expect(loginRes.statusCode).toBe(200);
    const token1 = loginRes.body.refreshToken;

    const rotate1 = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: token1 });

    expect(rotate1.statusCode).toBe(200);
    const token2 = rotate1.body.refreshToken;
    expect(token2).not.toBe(token1);

    const reuseRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: token1 });

    expect(reuseRes.statusCode).toBe(401);

    const activeRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: token2 });

    expect(activeRes.statusCode).toBe(401);
  });

  it("should invalidate all sessions on password reset and enforce history rules", async () => {
    const forgotRes = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: testEmail });
    
    expect(forgotRes.statusCode).toBe(200);
    const resetToken = forgotRes.body.token;
    expect(resetToken).toBeDefined();

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: "SecurePassword@123" });
    const originalRefreshToken = loginRes.body.refreshToken;

    const weakRes = await request(app)
      .post(`/api/auth/reset-password/${resetToken}`)
      .send({ password: "weak" });
    expect(weakRes.statusCode).toBe(400);

    const historyRes = await request(app)
      .post(`/api/auth/reset-password/${resetToken}`)
      .send({ password: "SecurePassword@123" });
    expect(historyRes.statusCode).toBe(400);

    const successRes = await request(app)
      .post(`/api/auth/reset-password/${resetToken}`)
      .send({ password: "NewSecurePassword@123" });
    expect(successRes.statusCode).toBe(200);

    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: originalRefreshToken });
    expect(refreshRes.statusCode).toBe(401);
  });

  it("should support logout all devices revoking all sessions", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: "SecurePassword@123" });
    const accessToken = loginRes.body.token;
    const refreshToken = loginRes.body.refreshToken;

    const logoutAllRes = await request(app)
      .post("/api/auth/logout-all")
      .set("Authorization", `Bearer ${accessToken}`);
    
    expect(logoutAllRes.statusCode).toBe(200);

    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });
    expect(refreshRes.statusCode).toBe(401);
  });
});
