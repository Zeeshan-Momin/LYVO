const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const shippingController = require("../controllers/shippingController");
const { protect, adminOnly } = require("../middleware/auth");

// Public rate limiter for pincode lookups (e.g. 60 requests per 15 minutes per IP)
const pincodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many pincode lookup requests, please try again later."
  }
});

// Stage 1: Health & verification endpoint (Admin only)
router.get("/health", protect, adminOnly, shippingController.getShippingHealth);

// Stage 2A: Pincode serviceability lookup (Public with rate limit)
router.get("/pincode/:pincode", pincodeLimiter, shippingController.checkPincodeServiceability);

// Stage 2B: Shipping rate calculation endpoint (Public with rate limit)
router.post("/calculate-rate", pincodeLimiter, shippingController.calculateShippingRate);

// Stage 2C: Admin-only forward shipment creation & AWB generation
router.post("/admin/shipment/:orderId", protect, adminOnly, shippingController.createShipmentForOrder);

module.exports = router;
