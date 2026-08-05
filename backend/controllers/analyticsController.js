const ah = require("express-async-handler");
const SiteStats = require("../models/SiteStats");

// POST /api/analytics/visit — public, called once per browser session from the frontend
exports.recordVisit = ah(async (req, res) => {
  const stats = await SiteStats.incrementVisit();
  res.json({ success: true, totalVisits: stats.totalVisits });
});

// GET /api/analytics/stats — admin only
exports.getStats = ah(async (req, res) => {
  const stats = await SiteStats.findOne({ key: "global" });
  res.json({ success: true, totalVisits: stats?.totalVisits || 0 });
});
