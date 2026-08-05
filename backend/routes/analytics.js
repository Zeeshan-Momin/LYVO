const r = require("express").Router(), c = require("../controllers/analyticsController");
const { protect, adminOnly } = require("../middleware/auth");
r.post("/visit", c.recordVisit);
r.get("/stats", protect, adminOnly, c.getStats);
module.exports = r;
