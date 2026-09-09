const r = require("express").Router(), c = require("../controllers/paymentController");
const { protect } = require("../middleware/auth");
r.post("/create-order", protect, c.createRazorpayOrder);
r.post("/verify-payment", protect, c.verifyRazorpayPayment);
module.exports = r;
