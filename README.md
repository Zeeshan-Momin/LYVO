# LYVO — Flagship Luxury E-Commerce Platform
### Live Your Vision Out ⚡

[![Build Status](https://img.shields.io/badge/Build-Passing-acid?style=for-the-badge)](file:///d:/Projects/lyvo-proj/TECHNICAL_SYSTEMS_GUIDE.md)
[![Security Level](https://img.shields.io/badge/Security-Enterprise_Certified-blue?style=for-the-badge)](file:///d:/Projects/lyvo-proj/SECURITY.md)
[![WCAG Compliance](https://img.shields.io/badge/WCAG-2.1_AA_Compliant-green?style=for-the-badge)](file:///d:/Projects/lyvo-proj/CODE_OF_CONDUCT.md)
[![License](https://img.shields.io/badge/License-MIT-black?style=for-the-badge)](file:///d:/Projects/lyvo-proj/LICENSE)

LYVO is an enterprise-grade, cloud-native street apparel e-commerce platform built to meet high-performance commercial workloads. It features a stunning luxury user experience, advanced account security, real-time distributed caching, and containerized DevOps telemetry.

---

## 🏗️ Technical Architecture Overview

LYVO separates storefront static assets from Express backend controllers, orchestrating them within Docker bridge networks:

- **Frontend Container:** Served via an optimized **Nginx** container with Gzip compression and 1-year expires Cache-Control headers for static files.
- **Backend API Cluster:** Serves Express route handlers with Winston structured loggers, Sentry error trackers, and custom Prometheus metrics.
- **Session & Caching:** Utilizes a hybrid caching layer: local in-memory queries synchronized distributedly across scaled pods using **Redis Pub/Sub** invalidation events.

For architecture blueprints, entity relationship models, and API definitions, consult the [Technical Systems Guide](file:///d:/Projects/lyvo-proj/TECHNICAL_SYSTEMS_GUIDE.md).

---

## ✨ Feature Showcases

### User Experience & Personalization
- **Luxury Branding:** Custom neon aesthetics and smooth layout flows built with vanilla CSS.
- **Support Chatbot Assistant:** Slide-out virtual concierge answering delivery, return, and sizing FAQs.
- **Bundle Builder Recommendations:** Dynamic "Frequently Bought Together" bundle checkout interface.
- **Onboarding Guides:** Welcoming tutorial walkthrough overlays for new visitors.
- **WCAG 2.1 AA Compliant:** Keyboard navigation outlines, skip links, and semantic tags.

### Enterprise Security
- **Refresh Token Rotation (RTR):** Standard rotation sequences. Invalides entire login families on reuse anomalies.
- **Progressive Account Lockouts:** Automatically locks credentials for 15 minutes after 5 failures.
- **Password History Rules:** Blocks recycling the last 3 passwords during resets.

---

## 🚀 Development Quick Start

### 1. Installation
```bash
# Install backend and frontend dependencies
cd backend && npm install
cd ../frontend && npm install
```

### 2. Seeding Demo Accounts
```bash
# Seed standard accounts and products
cd backend
npm run seed
```
Seeds default credentials:
- **Admin:** `admin@lyvo.com` / `Admin@123456`
- **User:** `user@lyvo.com` / `User@123456`

### 3. Execution
```bash
# Run backend (Terminal 1)
cd backend && npm run dev

# Run frontend (Terminal 2)
cd frontend && npm run dev
```

---

## 🐳 4. Production Container Deployment

Build and orchestrate local servers using docker-compose:
```bash
docker-compose up --build -d
```
Runs:
- MongoDB on port `27017`
- Redis cache on port `6379`
- Express API on port `5000`
- Nginx & Frontend static pages on port `80`

---

## 🧹 5. Technical Operations Guides

- **Deploying to Cloud Hostings:** Detailed setup steps for AWS EC2, DigitalOcean, Render, and Railway are listed in the [Deployment Manual](file:///d:/Projects/lyvo-proj/DEPLOYMENT_MANUAL.md).
- **Automated Database Backups:** Run `./scripts/backup.sh` to package data.
- **Database Restoration:** Run `./scripts/restore.sh <path>` to reload state.
- **Database Schema Upgrades:** Run `node scripts/migrate.js` to trigger migrations.
