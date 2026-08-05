const r = require("express").Router(), c = require("../controllers/paymentController");
const { protect } = require("../middleware/auth");
r.post("/create-order", protect, c.createRazorpayOrder);
module.exports = r;
