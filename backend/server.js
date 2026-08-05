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

const express   = require("express");
const cors      = require("cors");
const helmet    = require("helmet");
const rateLimit = require("express-rate-limit");
const path      = require("path");
const compression = require("compression");
const mongoSanitize = require("express-mongo-sanitize");
const connectDB = require("./config/db");
connectDB();

const app = express();

app.set("trust proxy", 1);
app.use(compression());

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: [
          "'self'",
          "data:",
          "https://res.cloudinary.com",
          "https://images.unsplash.com",
          "https://checkout.razorpay.com"
        ],
        frameSrc: ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
        connectSrc: [
          "'self'",
          "https://api.razorpay.com",
          "https://checkout.razorpay.com"
        ],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin" },
  })
);

app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use(mongoSanitize());
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use(cors({ origin: [process.env.CLIENT_URL || "http://localhost:5173"], credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      ip: req.ip,
      duration
    });
  });
  next();
});

app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  maxAge: "30d",
  etag: true,
  lastModified: true
}));

app.get("/api/live", (_, res) => res.status(200).json({ status: "alive" }));

app.get("/api/ready", async (_, res) => {
  const mongoose = require("mongoose");
  const dbConnected = mongoose.connection.readyState === 1;
  if (dbConnected) {
    return res.status(200).json({ status: "ready" });
  } else {
    return res.status(503).json({ status: "not ready", database: "disconnected" });
  }
});

app.get("/api/health", async (_, res) => {
  const mongoose = require("mongoose");
  const dbStatus = ["disconnected", "connected", "connecting", "disconnecting"][mongoose.connection.readyState] || "unknown";
  
  res.json({
    status: mongoose.connection.readyState === 1 ? "healthy" : "unhealthy",
    timestamp: new Date(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: {
      status: dbStatus
    },
    env: process.env.NODE_ENV,
    version: require("./package.json").version || "1.0.0"
  });
});

app.use("/api/auth",     require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/orders",   require("./routes/orders"));
app.use("/api/users",    require("./routes/users"));
app.use("/api/admin",    require("./routes/admin"));
app.use("/api/upload",   require("./routes/upload"));
app.use("/api/reviews",  require("./routes/reviews"));
app.use("/api/coupons",  require("./routes/coupons"));
app.use("/api/payment",  require("./routes/payment"));
app.use("/api/analytics",require("./routes/analytics"));
app.use("*", (req, res) => res.status(404).json({ message: `${req.originalUrl} not found` }));

if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

app.use((err, req, res, next) => {
  console.error("❌ INTERNAL ERROR LOG:", err);

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "Field";
    return res.status(400).json({ message: `${field} already exists` });
  }
  if (err.name === "ValidationError") {
    return res.status(400).json({ message: Object.values(err.errors).map(e => e.message).join(", ") });
  }

  const isClientError = err.statusCode && err.statusCode < 500;
  const isProduction = process.env.NODE_ENV === "production";
  const errorMessage = (isClientError || !isProduction) ? err.message : "An unexpected server error occurred";

  res.status(err.statusCode || 500).json({ message: errorMessage || "Server Error" });
});

const PORT = process.env.PORT || 5000;
let server;
if (process.env.NODE_ENV !== "test") {
  server = app.listen(PORT, () => logger.info(`🚀 LYVO API running on port ${PORT}`));
}

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

if (process.env.NODE_ENV !== "test") {
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

module.exports = app;
