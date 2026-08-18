# Release Notes — LYVO v1.1.0 (Production Cert)

We are proud to announce the certification and launch prep of LYVO v1.1.0, upgrading the platform into a cloud-native, highly observable, and highly secure commercial apparel store.

---

## 🔑 Key Upgrades in this Release

### 1. Enterprise Security Certification
- **Refresh Token Rotation (RTR):** Enforces token rotation, revoking entire login sessions on token reuse anomaly detection.
- **Account Lockouts:** Protects credentials against brute force using lockouts.
- **Password History Policies:** Prevents recycling the last 3 passwords during resets.

### 2. DevOps & High Availability
- **Redis Cache & Pub/Sub Sync:** Distributed caching with local memory fallbacks.
- **Prometheus Metrics Scrapers:** Outlines HTTP status and RAM telemetry metrics.
- **Container Health:** Highly optimized Node 20 multi-stage containers.

### 3. Accessible Design & SEO
- **WCAG compliance:** Integrated focus outline visual indicators and skip-to-content links.
- **SEO Optimization:** Open Graph metadata rendering and crawler sitemaps.
