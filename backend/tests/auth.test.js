require("./setup");
const request = require("supertest");
const app = require("../app");
const mongoose = require("mongoose");
const User = require("../models/User");

describe("Authentication API Tests", () => {
  const registerPayload = {
    name: "John Doe",
    email: "john@example.com",
    password: "password123",
    phone: "9876543210"
  };

  it("should successfully register a new user", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send(registerPayload);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body.user).toHaveProperty("email", "john@example.com");
    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("refreshToken");
  });

  it("should fail when registering a duplicate email", async () => {
    await request(app).post("/api/auth/register").send(registerPayload);

    const res = await request(app)
      .post("/api/auth/register")
      .send(registerPayload);

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toMatch(/registered/i);
  });

  it("should successfully login an existing user", async () => {
    await request(app).post("/api/auth/register").send(registerPayload);

    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: "john@example.com",
        password: "password123"
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("token");
  });

  it("should fail login with invalid password", async () => {
    await request(app).post("/api/auth/register").send(registerPayload);

    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: "john@example.com",
        password: "wrongpassword"
      });

    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty("message");
  });

  it("should block access to protected profile route without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.statusCode).toBe(401);
  });

  it("should permit access to profile route with a valid JWT token", async () => {
    const regRes = await request(app).post("/api/auth/register").send(registerPayload);
    const token = regRes.body.token;

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.user).toHaveProperty("email", "john@example.com");
  });
});
