# LYVO — Full-Stack Sneaker Ecommerce
### Live Your Vision Out ⚡

A complete, production-ready ecommerce platform with a customer storefront and admin dashboard.

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment
```bash
cd backend
cp .env.example .env
```
Edit `.env` — at minimum set:
- `MONGO_URI` (local MongoDB or [MongoDB Atlas](https://cloud.mongodb.com))
- `JWT_SECRET` and `JWT_REFRESH_SECRET` (any long random strings)

Cloudinary keys are optional — without them, product image uploads from the admin panel won't work, but the seeded demo products (which use Unsplash URLs) will still display fine.

### 3. Seed the database
```bash
cd backend
npm run seed
```
This creates:
- **Admin:** `admin@lyvo.com` / `Admin@123456`
- **User:** `user@lyvo.com` / `User@123456`
- 5 categories, 6 sample products, 3 coupons (`LYVO10`, `VISION20`, `HUSTLE15`)

### 4. Run the app
```bash
# Terminal 1
cd backend && npm run dev      # → http://localhost:5000

# Terminal 2
cd frontend && npm run dev     # → http://localhost:5173
```

- 🛒 **Storefront:** http://localhost:5173
- 🔧 **Admin Panel:** http://localhost:5173/admin

---

## 🏗 Tech Stack
| Layer    | Technology |
|----------|-----------|
| Frontend | React 18 + Vite, Tailwind CSS, Framer Motion, Recharts |
| Backend  | Node.js + Express REST API |
| Database | MongoDB + Mongoose |
| Auth     | JWT (access + refresh tokens) |
| Uploads  | Cloudinary (optional) |

## 📁 Project Structure
```
lyvo-ecommerce/
├── backend/
│   ├── config/db.js              MongoDB connection
│   ├── models/                   User, Product, Order, Category, Review, Coupon
│   ├── controllers/              Business logic for each resource
│   ├── middleware/                JWT auth, file upload
│   ├── routes/                   Express routers
│   ├── utils/seeder.js           Demo data seeder
│   └── server.js                 App entry point
│
└── frontend/
    └── src/
        ├── api/                  Axios service layer (all backend calls)
        ├── context/              AuthContext, CartContext (global state)
        ├── components/
        │   ├── common/           Navbar, Footer, Loading
        │   ├── product/          ProductCard
        │   └── cart/             CartDrawer
        ├── pages/                Home, Products, ProductDetail, Cart, Checkout,
        │                         Login, Profile, OrderHistory, OrderDetail, Wishlist
        └── pages/admin/          AdminLayout, Dashboard, AdminProducts, AdminOrders,
                                  AdminUsers, AdminAnalytics, AdminCategories, AdminCoupons
```

## ✨ Features

### User-Facing
- Animated hero homepage with featured product carousel
- Product catalog: filters by category, gender, size, price; live search
- Product detail: image gallery with zoom, color/size selection, reviews
- Persistent cart (localStorage) with slide-in drawer
- 3-step checkout: Address → Payment → Review
- Order history with live status tracking
- Wishlist, profile editing, multiple saved addresses

### Admin Dashboard
- Stats overview: revenue, orders, users, low-stock alerts
- Revenue charts (monthly line chart, order-status pie chart)
- Full product CRUD with multi-image upload
- Order management: update status, add tracking number
- User management: edit roles, activate/deactivate accounts
- Category and coupon management
- Sales analytics: category breakdown, top products, gender split

## 🔌 Key API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| GET | `/api/products` | List + filter products |
| GET | `/api/products/:id` | Product detail |
| POST | `/api/orders` | Place an order |
| GET | `/api/orders/my` | Customer's order history |
| GET | `/api/admin/dashboard` | Admin stats (admin only) |
| POST | `/api/products` | Create product (admin only) |
| PATCH | `/api/orders/admin/:id/status` | Update order status (admin only) |

## 🎨 Customizing Brand Colors
Edit `frontend/tailwind.config.js`:
```js
colors: {
  acid: { DEFAULT: "#DFFF00" },  // primary brand color
  fire: { DEFAULT: "#FF3A1A" },  // sale / error accent
  gold: { DEFAULT: "#FFD166" },  // premium accent
}
```

## 🛒 Test Coupons (after seeding)
| Code | Discount | Minimum Purchase |
|------|----------|-------------------|
| `LYVO10` | 10% off (max ₹500) | ₹999 |
| `VISION20` | 20% off (max ₹800) | ₹1999 |
| `HUSTLE15` | ₹150 off | ₹799 |

---

**LYVO — Live Your Vision Out** 👟
