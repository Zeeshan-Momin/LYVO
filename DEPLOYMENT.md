# LYVO — Production Deployment & Operations Guide

This guide details the steps to build, run, monitor, and maintain the LYVO sneaker web application in production environments.

---

## 📦 1. Containerized Local Development

LYVO features full Docker configuration supporting multi-stage builds and isolated container environments.

### Prerequisite
- Docker & Docker Compose installed.

### Spin up the complete stack
Build and run the frontend, backend, and local MongoDB database instances:
```bash
docker compose up -d --build
```

### Inspect service status and logs
```bash
# Check running containers
docker compose ps

# Tail all logs
docker compose logs -f

# Tail logs of a specific service
docker compose logs -f backend
```

### Clean down the environment
```bash
docker compose down -v
```

---

## 🚀 2. Production Platform Deployments

### A. MongoDB Atlas Database Setup
1. Create a MongoDB Atlas account and provision a free or dedicated cluster.
2. Under **Network Access**, whitelist your deployment IP addresses (or permit `0.0.0.0/0` temporarily if dynamic server IPs are used).
3. Under **Database Access**, create a user with read/write privileges.
4. Copy the connection URI: `mongodb+srv://<username>:<password>@cluster.mongodb.net/lyvo?retryWrites=true&w=majority`

### B. Render / Railway Backend Deployment
1. Connect your Github Repository to the platform dashboard.
2. Select **Web Service** (Render) or **Service** (Railway).
3. Set base configurations:
   - **Environment:** Node
   - **Build Command:** `npm ci` (inside backend directory)
   - **Start Command:** `node server.js`
4. Add all environment variables listed in the Reference Table below.
5. Set up Sentry environment variables to direct application logs.

### C. Vercel Frontend static Deployment
1. Connect repository to Vercel.
2. Choose **Vite** as framework preset.
3. Configure the root directory to point to `frontend`.
4. Set Environment Variables:
   - `VITE_API_URL` to point to your deployed backend URL, e.g. `https://lyvo-api.onrender.com/api`.
5. Trigger Build and Deploy.

---

## 🛡️ 3. Environment Variables Reference

| Variable Name | Description | Type | Required? | Example Value |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | Listening port for the express server | Number | Yes | `5000` |
| `MONGO_URI` | MongoDB connection connection string | URL | Yes | `mongodb://mongodb:27017/lyvo` |
| `JWT_SECRET` | Secret token string for signing Access JWTs | String | Yes | `16+ character secure secret` |
| `JWT_REFRESH_SECRET` | Secret token string for signing Refresh JWTs | String | Yes | `16+ character secure refresh secret` |
| `CLIENT_URL` | Deployed URL of frontend client (CORS) | URL | Yes | `http://localhost:5173` |
| `NODE_ENV` | Mode of the server run | Enum | Yes | `production` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary name for image uploads | String | Yes | `my-cloud-name` |
| `CLOUDINARY_API_KEY` | Cloudinary key | String | Yes | `8172648172648` |
| `CLOUDINARY_API_SECRET` | Cloudinary secret | String | Yes | `cloudinary_secure_secret_key` |
| `RAZORPAY_KEY_ID` | Razorpay Key ID | String | Yes | `rzp_test_abc123` |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret | String | Yes | `razorpay_secure_secret` |
| `SENTRY_DSN` | Sentry DSN endpoint for backend reporting | URL | No | `https://sentry-dns-link/12345` |
| `VITE_SENTRY_DSN` | Sentry DSN endpoint for frontend client | URL | No | `https://sentry-dns-link/12345` |

---

## 🔄 4. Rollback and Disaster Recovery

### Quick Rollback via Docker Registry
If a deployment fails, push or pull the previous stable container image tag:
```bash
# Tag stable image as latest and deploy
docker tag lyvo-backend:v1.0.1 lyvo-backend:latest
docker push lyvo-backend:latest
```

### Git-based Rollback
Revert to the last stable commit and trigger Github Actions pipeline:
```bash
# Revert to last commit and push
git revert HEAD --no-edit
git push origin main
```

---

## 📝 5. Production Checklists

### 📋 Pre-Deployment Checklist
- [ ] Environment validation passes without warning logs.
- [ ] Database credentials and secrets are encrypted in vault/platform environments.
- [ ] No DSN values, credentials, or private keys are exposed in git commits.
- [ ] Production-built frontend contains lazy routing chunks.
- [ ] Helmet headers and Content-Security-Policies are registered.

### 📋 Infrastructure & Monitoring Checklist
- [ ] `/api/health`, `/api/live`, and `/api/ready` endpoints return `200` status.
- [ ] Winston rotating error files write logs daily to `/backend/logs`.
- [ ] Sentry alert thresholds are configured to notify emails on `500` server errors.
- [ ] Cors headers restrict connection requests to client domains exclusively.
