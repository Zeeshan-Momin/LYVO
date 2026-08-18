const jwt = require("jsonwebtoken");
const User = require("../models/User");
exports.protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    req.user = await User.findById(decoded.id).select("-password -refreshToken");
    if (!req.user || !req.user.isActive) return res.status(401).json({ message: "Unauthorised" });
    req.tokenFamily = decoded.tokenFamily || "";
    next();
  } catch { res.status(401).json({ message: "Token invalid" }); }
};
exports.adminOnly = (req, res, next) => { if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin only" }); next(); };
exports.optionalAuth = async (req, res, next) => {
  try { const t = req.headers.authorization?.split(" ")[1]; if (t) { const d = jwt.verify(t, process.env.JWT_SECRET, { algorithms: ["HS256"] }); req.user = await User.findById(d.id).select("-password"); } } catch {}
  next();
};
exports.generateToken = (id, tokenFamily = "") => jwt.sign({ id, tokenFamily }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: process.env.JWT_EXPIRE || "15m" });
exports.generateRefreshToken = (id, tokenFamily = "", tokenId = "") => jwt.sign({ id, tokenFamily, tokenId }, process.env.JWT_REFRESH_SECRET, { algorithm: "HS256", expiresIn: "7d" });
