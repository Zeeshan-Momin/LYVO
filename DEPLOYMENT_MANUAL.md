# LYVO — Production Deployment & DevOps Manual

This document serves as the architectural overview, deployment blueprint, and operational runbook for launching and running LYVO in production.

---

## 🏗️ 1. Architecture Overview

LYVO uses a cloud-native, decoupled, and horizontally scalable architecture:

```mermaid
graph TD
    Client[Browser / Client] -->|HTTPS| Nginx[Nginx Reverse Proxy / Static Cache]
    Nginx -->|Route /| Frontend[Frontend Build Assets]
    Nginx -->|Route /api| Backend[Express Backend Cluster]
    Backend -->|Database Queries| MongoDB[(MongoDB Database)]
    Backend -->|Distributed Pub/Sub Caching| Redis[(Redis Cache)]
```

- **Frontend Container:** An optimized multi-stage Node build compiled into static assets and served using a highly performant **Nginx** server (with Gzip compression and 1-year static assets caching).
- **Backend Container:** A Node/Express cluster running under user privilege separation. Exposes Prometheus `/metrics` scraping paths, liveness `/api/live` indicators, readiness `/api/ready` checks, and request tracing IDs.
- **Caching & Sessions:** Uses a hybrid cache layer. Ultra-fast local in-memory queries are synchronized distributedly across scaled backend instances using **Redis Pub/Sub** invalidation events.

---

## 📋 2. Environment Variables Specification

Ensure all variables are populated inside `.env` on target environments:

### Backend Configuration
```ini
PORT=5000
NODE_ENV=production
MONGO_URI=mongodb://lyvo-user:password@hostname:27017/lyvo
REDIS_URL=redis://redis-host:6379
JWT_SECRET=your_32_character_security_secret
JWT_REFRESH_SECRET=your_32_character_refresh_secret
CLIENT_URL=https://lyvo.yourdomain.com
SENTRY_DSN=https://sentry.io/project-id
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
VITE_FIREBASE_API_KEY=production-firebase-api-key
```

---

## 🐳 3. Container Orchestration & Local Builds

### Building optimized local containers:
```bash
# Build and run MongoDB, Redis, Backend, and Frontend reverse proxies:
docker-compose up --build -d
```

### Checking health checks:
```bash
# Check running service states:
docker-compose ps
```

---

## 🚀 4. Deployment Guides

### AWS EC2 (Docker Compose)
1. Provision an Ubuntu EC2 instance. Associate an Elastic IP.
2. Allow incoming traffic on port `80` (HTTP) and `443` (HTTPS) via Security Groups.
3. Install Docker and Docker Compose on the host.
4. Clone the repository and copy configurations.
5. Create production `.env` files and start services:
   ```bash
   docker-compose up -d
   ```

### DigitalOcean (Droplets / App Platform)
1. Use **DigitalOcean App Platform** for managed scaling.
2. Map the `frontend/` directory to a Static Site worker.
3. Map the `backend/` directory to a Web Service worker (set port `5000` and link to DO Managed MongoDB database).

### Render & Railway
1. Push configurations. Railway/Render will automatically parse `docker-compose.yml` or sub-directory `Dockerfile` targets.
2. Bind environment variables inside the dashboard manager.
3. Link services securely using dynamic hostnames (e.g. `REDIS_URL=${{Redis.REDIS_URL}}`).

---

## 🧹 5. Database Backup, Restores & Migrations

### Dynamic Backups:
```bash
# Execute local database dump:
chmod +x scripts/backup.sh
./scripts/backup.sh
```

### Restoring backups:
```bash
# Execute database restore:
chmod +x scripts/restore.sh
./scripts/restore.sh ./backups/backup-2026-08-06_13-00-00
```

### Dynamic schema migrations:
```bash
# Run schema upgrades:
node scripts/migrate.js
```

---

## 🚨 6. Disaster Recovery Procedures (DRP)

### In case of Redis Outage
- **Action:** Backend automatically triggers the fallback logic. Connections to Redis will fail, logging warnings, while the server defaults back to local in-memory caching (`cacheStore`), guaranteeing 100% uptime.

### Database Connection Failure
- **Action:** If MongoDB shuts down, `/api/ready` will return a `503 Service Unavailable` status. Healthcheck scrapers will trigger target container rebuilds or restart policies automatically.
