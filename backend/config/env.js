const logger = require("../utils/logger");

const validateEnv = () => {
  const required = [
    "MONGO_URI",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET"
  ];

  const missing = [];
  required.forEach((key) => {
    if (!process.env[key]) {
      missing.push(key);
    }
  });

  if (missing.length > 0) {
    logger.error(`❌ CRITICAL: Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }

  if (!/^mongodb(\+srv)?:\/\/.+/i.test(process.env.MONGO_URI)) {
    logger.error("❌ CRITICAL: MONGO_URI must be a valid MongoDB URI (starting with mongodb:// or mongodb+srv://)");
    process.exit(1);
  }

  if (process.env.PORT) {
    const port = Number(process.env.PORT);
    if (isNaN(port) || port < 1 || port > 65535) {
      logger.error("❌ CRITICAL: PORT must be a number between 1 and 65535");
      process.exit(1);
    }
  }

  if (process.env.JWT_SECRET.length < 16) {
    logger.error("❌ CRITICAL: JWT_SECRET must be at least 16 characters long for security");
    process.exit(1);
  }

  if (process.env.JWT_REFRESH_SECRET.length < 16) {
    logger.error("❌ CRITICAL: JWT_REFRESH_SECRET must be at least 16 characters long for security");
    process.exit(1);
  }

  const validEnvs = ["development", "production", "test"];
  if (process.env.NODE_ENV && !validEnvs.includes(process.env.NODE_ENV.toLowerCase())) {
    logger.error(`❌ CRITICAL: NODE_ENV must be one of: ${validEnvs.join(", ")}`);
    process.exit(1);
  }

  logger.info("🛡️ Environment validation passed successfully");
};

module.exports = validateEnv;
