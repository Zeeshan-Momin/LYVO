const ah = require("express-async-handler");
const razorpay = require("../utils/razorpay");
const { computePricing } = require("../utils/pricing");

// POST /api/payment/create-order
// Body: { items, couponCode }
// Recomputes the total server-side (never trusts a client-sent amount) and
// creates a Razorpay Order for it.
exports.createRazorpayOrder = ah(async (req, res) => {
  const { items, couponCode } = req.body;
  if (!items?.length) return res.status(400).json({ message: "No items" });

  const { total } = await computePricing(items, couponCode);
  const amountInPaise = Math.round(total * 100);

  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: `rcpt_${Math.random().toString(36).substring(2, 11)}`,
    notes: { userId: req.user._id.toString() }
  });

  res.json({
    success: true,
    razorpayOrderId: order.id,
    amount: amountInPaise
  });
});
