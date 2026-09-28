const ah = require("express-async-handler");
const razorpay = require("../utils/razorpay");
const { computePricing } = require("../utils/pricing");

// POST /api/payment/create-order
// Body: { items, couponCode } OR { amount, currency, receipt }
exports.createRazorpayOrder = ah(async (req, res) => {
  const { items, couponCode, amount, currency, receipt } = req.body;

  // Standalone order integration (supporting custom amount, currency, and receipt)
  if (amount !== undefined) {
    const amountVal = Number(amount);
    if (isNaN(amountVal) || amountVal < 100) {
      return res.status(400).json({ message: "Amount must be a number and at least 100 paise" });
    }

    try {
      const order = await razorpay.orders.create({
        amount: amountVal,
        currency: currency || "INR",
        receipt: receipt || `rcpt_${Math.random().toString(36).substring(2, 11)}`,
        notes: { userId: req.user?._id?.toString() || "guest" }
      });

      return res.json({
        success: true,
        order_id: order.id,
        razorpayOrderId: order.id,
        amount: order.amount,
        currency: order.currency
      });
    } catch (err) {
      console.error("❌ Razorpay Create Order Error:", err);
      return res.status(500).json({ message: err.message || "Failed to create Razorpay order" });
    }
  }

  // E-commerce items-based order integration
  if (!items?.length) return res.status(400).json({ message: "No items" });

  const { total } = await computePricing(items, couponCode);
  const amountInPaise = Math.round(total * 100);

  if (amountInPaise < 100) {
    return res.status(400).json({ message: "Amount must be at least 100 paise" });
  }

  try {
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `rcpt_${Math.random().toString(36).substring(2, 11)}`,
      notes: { userId: req.user._id.toString() }
    });

    res.json({
      success: true,
      order_id: order.id,
      razorpayOrderId: order.id,
      amount: amountInPaise,
      currency: "INR"
    });
  } catch (err) {
    console.error("❌ Razorpay Create Order Error:", err);
    return res.status(500).json({ message: err.message || "Failed to create Razorpay order" });
  }
});

// POST /api/payment/verify-payment
// Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature }
exports.verifyRazorpayPayment = ah(async (req, res) => {
  const razorpayOrderId = req.body.razorpayOrderId || req.body.razorpay_order_id || req.body.order_id;
  const razorpayPaymentId = req.body.razorpayPaymentId || req.body.razorpay_payment_id || req.body.payment_id;
  const razorpaySignature = req.body.razorpaySignature || req.body.razorpay_signature || req.body.signature;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({ message: "Missing Razorpay payment details" });
  }

  // Strict mock mode: ONLY allowed when NODE_ENV is "test" AND ALLOW_MOCK_PAYMENTS is explicitly "true"
  if (process.env.NODE_ENV === "test" && process.env.ALLOW_MOCK_PAYMENTS === "true") {
    console.warn("⚠️ WARNING: MOCK PAYMENTS ARE ENABLED (ALLOW_MOCK_PAYMENTS=true). NEVER USE THIS IN PRODUCTION!");
    return res.json({ success: true, message: "Payment verified successfully (Mock Mode)" });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return res.status(500).json({ success: false, message: "Payment configuration error: RAZORPAY_KEY_SECRET is not configured" });
  }

  const crypto = require("crypto");
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expectedSignature, "utf8");
  const actualBuf = Buffer.from(typeof razorpaySignature === "string" ? razorpaySignature : "", "utf8");

  const isMatch = expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);

  if (!isMatch) {
    return res.status(400).json({ success: false, message: "Signature verification failed" });
  }

  res.json({ success: true, message: "Payment verified successfully" });
});
