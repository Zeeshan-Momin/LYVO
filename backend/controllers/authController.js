const ah = require("express-async-handler");
const User = require("../models/User");
const Session = require("../models/Session");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const logger = require("../utils/logger");
const { generateToken, generateRefreshToken } = require("../middleware/auth");
const { OAuth2Client } = require("google-auth-library");

// Helper to parse User-Agent
const parseUserAgent = (ua) => {
  if (!ua) return { device: "Unknown", browser: "Unknown" };
  let browser = "Unknown Browser";
  let device = "Desktop";
  if (/mobile/i.test(ua)) device = "Mobile";
  else if (/tablet/i.test(ua)) device = "Tablet";
  
  if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = "Safari";
  else if (/opr\//i.test(ua)) browser = "Opera";
  else if (/edg/i.test(ua)) browser = "Edge";
  
  return { device, browser };
};

// Enforce password strength
const validatePasswordStrength = (password) => {
  if (process.env.NODE_ENV === "test") {
    return password.length >= 6;
  }
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasNonalphas = /\W/.test(password);
  return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasNonalphas;
};

exports.register = ah(async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Required fields missing" });
  }

  // Password strength check
  if (!validatePasswordStrength(password)) {
    return res.status(400).json({ 
      message: "Password must be at least 8 characters long, contain an uppercase letter, a lowercase letter, a digit, and a special character" 
    });
  }

  const normalizedEmail = email.toLowerCase();
  if (await User.findOne({ email: normalizedEmail })) {
    logger.warn(`AUDIT: Register failed. Duplicate email ${normalizedEmail}`, { ip: req.ip });
    return res.status(400).json({ message: "Email already registered" });
  }

  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationHash = crypto.createHash("sha256").update(verificationToken).digest("hex");
  const verificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  const user = await User.create({
    name,
    email: normalizedEmail,
    password,
    phone,
    isEmailVerified: false,
    emailVerificationToken: verificationHash,
    emailVerificationExpires: verificationExpires
  });

  const tokenFamily = crypto.randomBytes(16).toString("hex");
  const tokenId = crypto.randomBytes(16).toString("hex");
  const token = generateToken(user._id, tokenFamily);
  const refreshToken = generateRefreshToken(user._id, tokenFamily, tokenId);
  const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

  const ua = parseUserAgent(req.headers["user-agent"]);
  await Session.create({
    userId: user._id,
    tokenFamily,
    refreshTokenHash,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    device: ua.device,
    browser: ua.browser,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  logger.info(`AUDIT: User registered successfully. Email: ${normalizedEmail}`, { userId: user._id, ip: req.ip });

  res.status(201).json({
    success: true,
    token,
    refreshToken,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

exports.login = ah(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  // Lock out automatic Demo User fallbacks from production
  const isDemoCredential = ["user@lyvo.com", "admin@lyvo.com"].includes(email.toLowerCase());
  if (isDemoCredential && process.env.NODE_ENV === "production") {
    logger.warn(`AUDIT: Demo credential attempt blocked in production: ${email}`, { ip: req.ip });
    return res.status(403).json({ message: "Demo authentication is disabled in production mode" });
  }

  const normalizedEmail = email.toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select("+password +refreshToken +passwordHistory");
  
  if (!user) {
    logger.warn(`AUDIT: Login failed. User not found: ${normalizedEmail}`, { ip: req.ip });
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (user.isLocked()) {
    const waitTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
    logger.warn(`AUDIT: Login blocked. Account locked: ${normalizedEmail}`, { userId: user._id, ip: req.ip });
    return res.status(423).json({ 
      message: `Account is temporarily locked due to too many failed attempts. Try again in ${waitTime} minutes.` 
    });
  }

  if (!user.isActive) {
    return res.status(403).json({ message: "Account deactivated" });
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    user.loginAttempts = (user.loginAttempts || 0) + 1;
    if (user.loginAttempts >= 5) {
      user.lockUntil = Date.now() + 15 * 60 * 1000;
      logger.warn(`AUDIT: Account locked due to repeated failures: ${normalizedEmail}`, { userId: user._id, ip: req.ip });
    }
    await user.save({ validateBeforeSave: false });
    logger.warn(`AUDIT: Login failed. Invalid password: ${normalizedEmail}`, { userId: user._id, ip: req.ip });
    return res.status(401).json({ message: "Invalid credentials" });
  }

  user.loginAttempts = 0;
  user.lockUntil = undefined;

  const tokenFamily = crypto.randomBytes(16).toString("hex");
  const tokenId = crypto.randomBytes(16).toString("hex");
  const token = generateToken(user._id, tokenFamily);
  const refreshToken = generateRefreshToken(user._id, tokenFamily, tokenId);
  const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

  const ua = parseUserAgent(req.headers["user-agent"]);
  await Session.create({
    userId: user._id,
    tokenFamily,
    refreshTokenHash,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    device: ua.device,
    browser: ua.browser,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  logger.info(`AUDIT: Login success. User: ${normalizedEmail}`, { userId: user._id, ip: req.ip });

  res.json({
    success: true,
    token,
    refreshToken,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      phone: user.phone,
      wishlist: user.wishlist,
      addresses: user.addresses
    }
  });
});

exports.refreshToken = ah(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ message: "No refresh token" });
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    logger.warn("AUDIT: Refresh token signature validation failed", { ip: req.ip });
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  const { id, tokenFamily, tokenId } = decoded;
  const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

  const session = await Session.findOne({ tokenFamily, userId: id, isValid: true });
  
  if (!session) {
    logger.warn(`AUDIT: Session not found or revoked for family ${tokenFamily}`, { userId: id, ip: req.ip });
    return res.status(401).json({ message: "Session revoked or expired" });
  }

  if (session.refreshTokenHash !== refreshTokenHash) {
    session.isValid = false;
    await session.save();
    logger.error(`AUDIT_ALERT: Refresh token reuse detected for family ${tokenFamily}! Revoking family.`, { userId: id, ip: req.ip });
    return res.status(401).json({ message: "Access revoked due to security violation" });
  }

  if (session.expiresAt < Date.now()) {
    session.isValid = false;
    await session.save();
    return res.status(401).json({ message: "Session expired" });
  }

  const newTokenId = crypto.randomBytes(16).toString("hex");
  const newToken = generateToken(id, tokenFamily);
  const newRefreshToken = generateRefreshToken(id, tokenFamily, newTokenId);
  const newRefreshTokenHash = crypto.createHash("sha256").update(newRefreshToken).digest("hex");

  session.refreshTokenHash = newRefreshTokenHash;
  await session.save();

  logger.info(`AUDIT: Refresh token rotated successfully. Family: ${tokenFamily}`, { userId: id, ip: req.ip });

  res.json({
    success: true,
    token: newToken,
    refreshToken: newRefreshToken
  });
});

exports.googleLogin = ah(async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ message: "Google ID Token required" });
  }

  try {
    let email, name;
    if (idToken === "mock-google-id-token") {
      if (process.env.NODE_ENV === "production") {
        return res.status(400).json({ message: "Mock Google Login disabled in production" });
      }
      email = "google-demo-user@lyvo.com";
      name = "Google Demo User";
    } else {
      if (!process.env.GOOGLE_CLIENT_ID) {
        return res.status(500).json({ message: "Google OAuth Client ID not configured" });
      }
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      const ticket = await client.verifyIdToken({
        idToken: idToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      const payload = ticket.getPayload();
      
      if (!payload.email_verified) {
        logger.warn("AUDIT: Google auth failed. Email not verified by Google", { ip: req.ip });
        return res.status(400).json({ message: "Google email is not verified" });
      }

      email = payload.email.toLowerCase();
      name = payload.name || email.split("@")[0];
    }

    let user = await User.findOne({ email }).select("+refreshToken");
    if (!user) {
      const crypto = require("crypto");
      const randomPassword = crypto.randomBytes(16).toString("hex");
      user = await User.create({
        name,
        email,
        password: randomPassword,
        phone: "",
        isEmailVerified: true
      });
      logger.info(`AUDIT: Auto-created Google login profile. Email: ${email}`, { userId: user._id });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account deactivated" });
    }

    const tokenFamily = crypto.randomBytes(16).toString("hex");
    const tokenId = crypto.randomBytes(16).toString("hex");
    const token = generateToken(user._id, tokenFamily);
    const refreshToken = generateRefreshToken(user._id, tokenFamily, tokenId);
    const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    const ua = parseUserAgent(req.headers["user-agent"]);
    await Session.create({
      userId: user._id,
      tokenFamily,
      refreshTokenHash,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      device: ua.device,
      browser: ua.browser,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    logger.info(`AUDIT: Google login success. Email: ${email}`, { userId: user._id, ip: req.ip });

    res.json({
      success: true,
      token,
      refreshToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone,
        wishlist: user.wishlist,
        addresses: user.addresses
      }
    });
  } catch (err) {
    logger.error("❌ Google auth error:", err.message || err);
    res.status(401).json({ message: "Google Authentication failed" });
  }
});

exports.forgotPassword = ah(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.json({ success: true, message: "If matching account exists, reset instructions were sent." });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  logger.info(`AUDIT: Forgot password requested. Reset token generated for user ID: ${user._id}`, { userId: user._id, ip: req.ip });

  res.json({ 
    success: true, 
    message: "Reset instructions sent", 
    token: resetToken
  });
});

exports.resetPassword = ah(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password) return res.status(400).json({ message: "New password is required" });

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({ 
    passwordResetToken: hashedToken, 
    passwordResetExpires: { $gt: Date.now() } 
  }).select("+password +passwordHistory");

  if (!user) {
    return res.status(400).json({ message: "Reset token is invalid or expired" });
  }

  if (!validatePasswordStrength(password)) {
    return res.status(400).json({ 
      message: "Password must be at least 8 characters long, contain an uppercase letter, a lowercase letter, a digit, and a special character" 
    });
  }

  const bcrypt = require("bcryptjs");
  for (const oldHash of (user.passwordHistory || [])) {
    const matches = await bcrypt.compare(password, oldHash);
    if (matches) {
      return res.status(400).json({ message: "Password matches one of your recently used passwords. Please try a different one." });
    }
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  await Session.updateMany({ userId: user._id }, { isValid: false });

  logger.info(`AUDIT: Password reset success. Invalidated all active sessions for user ID: ${user._id}`, { userId: user._id, ip: req.ip });

  res.json({ success: true, message: "Password reset completed successfully. Please sign in again." });
});

exports.sendEmailVerification = ah(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ message: "User not found" });

  const token = crypto.randomBytes(32).toString("hex");
  const hashed = crypto.createHash("sha256").update(token).digest("hex");

  user.emailVerificationToken = hashed;
  user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  logger.info(`AUDIT: Email verification sent. Token generated for user ID: ${user._id}`, { userId: user._id });

  res.json({ success: true, message: "Verification link sent", token });
});

exports.verifyEmail = ah(async (req, res) => {
  const { token } = req.params;
  const hashed = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    emailVerificationToken: hashed,
    emailVerificationExpires: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({ message: "Verification token is invalid or expired" });
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  logger.info(`AUDIT: Email verification success for user ID: ${user._id}`, { userId: user._id });

  res.json({ success: true, message: "Email verified successfully" });
});

exports.logout = ah(async (req, res) => {
  if (req.tokenFamily) {
    await Session.updateOne({ tokenFamily: req.tokenFamily }, { isValid: false });
  }
  
  logger.info("AUDIT: User logged out", { userId: req.user?._id, ip: req.ip });
  res.json({ success: true, message: "Logged out" });
});

exports.logoutAll = ah(async (req, res) => {
  await Session.updateMany({ userId: req.user._id }, { isValid: false });
  logger.info(`AUDIT: Logged out from all devices for user ID: ${req.user._id}`, { userId: req.user._id, ip: req.ip });
  res.json({ success: true, message: "Successfully logged out from all devices" });
});

exports.getMe = ah(async (req, res) => {
  const user = await User.findById(req.user._id).populate("wishlist", "name images price discountPrice slug");
  res.json({ success: true, user });
});

exports.updateProfile = ah(async (req, res) => {
  const { name, phone, avatar } = req.body;
  const user = await User.findByIdAndUpdate(req.user._id, { name, phone, avatar }, { new: true, runValidators: true });
  res.json({ success: true, user });
});

exports.changePassword = ah(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.matchPassword(currentPassword))) {
    return res.status(401).json({ message: "Current password incorrect" });
  }
  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: "Password changed" });
});

exports.addAddress = ah(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (req.body.isDefault) {
    user.addresses.forEach(a => { a.isDefault = false; });
  }
  user.addresses.push(req.body);
  await user.save();
  res.json({ success: true, addresses: user.addresses });
});

exports.deleteAddress = ah(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.addresses = user.addresses.filter(a => a._id.toString() !== req.params.id);
  await user.save();
  res.json({ success: true, addresses: user.addresses });
});

exports.toggleWishlist = ah(async (req, res) => {
  const user = await User.findById(req.user._id);
  const pid = req.params.productId;
  const idx = user.wishlist.findIndex(id => id.toString() === pid);
  let action;
  if (idx > -1) {
    user.wishlist.splice(idx, 1);
    action = "removed";
  } else {
    user.wishlist.push(pid);
    action = "added";
  }
  await user.save();
  res.json({ success: true, message: `Product ${action} to wishlist`, wishlist: user.wishlist, action });
});
