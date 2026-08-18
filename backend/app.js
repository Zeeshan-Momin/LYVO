const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const compression = require("compression");
const mongoSanitize = require("express-mongo-sanitize");
const Sentry = require("@sentry/node");
const logger = require("./utils/logger");
const crypto = require("crypto");

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

// Prometheus counter metrics trackers
let totalRequests = 0;
const statusCounts = {};

// Request tracing ID middleware
app.use((req, res, next) => {
  req.id = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  totalRequests++;
  next();
});

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
    const status = res.statusCode;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    logger.info(`${req.method} ${req.originalUrl} ${status} - ${duration}ms`, {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      status: status,
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

app.get("/metrics", (req, res) => {
  res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  let body = "";
  body += `# HELP lyvo_http_requests_total Total number of HTTP requests\n`;
  body += `# TYPE lyvo_http_requests_total counter\n`;
  body += `lyvo_http_requests_total ${totalRequests}\n\n`;
  
  body += `# HELP lyvo_http_response_status_total Total number of HTTP responses by status code\n`;
  body += `# TYPE lyvo_http_response_status_total counter\n`;
  Object.keys(statusCounts).forEach((status) => {
    body += `lyvo_http_response_status_total{status="${status}"} ${statusCounts[status]}\n`;
  });
  
  const memory = process.memoryUsage();
  body += `\n# HELP lyvo_memory_rss_bytes Resident set size memory\n`;
  body += `# TYPE lyvo_memory_rss_bytes gauge\n`;
  body += `lyvo_memory_rss_bytes ${memory.rss}\n`;
  body += `\n# HELP lyvo_memory_heap_total_bytes Heap total memory\n`;
  body += `# TYPE lyvo_memory_heap_total_bytes gauge\n`;
  body += `lyvo_memory_heap_total_bytes ${memory.heapTotal}\n`;
  body += `\n# HELP lyvo_memory_heap_used_bytes Heap used memory\n`;
  body += `# TYPE lyvo_memory_heap_used_bytes gauge\n`;
  body += `lyvo_memory_heap_used_bytes ${memory.heapUsed}\n`;
  
  res.send(body);
});

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

app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/users", require("./routes/users"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/coupons", require("./routes/coupons"));
app.use("/api/payment", require("./routes/payment"));
app.use("/api/analytics", require("./routes/analytics"));
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

module.exports = app;
