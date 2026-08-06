require("dotenv").config();
const Sentry = require("@sentry/node");
const logger = require("./utils/logger");

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.1
  });
}

const validateEnv = require("./config/env");
validateEnv();

process.on("uncaughtException", (err) => {
  logger.error("❌ CRITICAL: Uncaught Exception caught:", err);
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("❌ CRITICAL: Unhandled Rejection at promise:", promise, "reason:", reason);
  if (process.env.SENTRY_DSN) Sentry.captureException(reason);
  process.exit(1);
});

const connectDB = require("./config/db");
connectDB();

const app = require("./app");

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => logger.info(`🚀 LYVO API running on port ${PORT}`));

const gracefulShutdown = (signal) => {
  logger.info(`⚙️ Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info("🌐 HTTP server closed.");
      try {
        const mongoose = require("mongoose");
        await mongoose.connection.close();
        logger.info("🔌 MongoDB connection closed.");
        process.exit(0);
      } catch (err) {
        logger.error("❌ Error closing MongoDB connection:", err);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }

  setTimeout(() => {
    logger.error("⚠️ Forcefully shutting down because graceful close timed out.");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
