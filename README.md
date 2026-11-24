# MERN E-Commerce Platform

A responsive, scalable e-commerce web application built with the **MERN stack** (MongoDB, Express.js, React, Node.js). Customers browse products, manage a cart, place orders (Cash on Delivery or online payment), like products and leave reviews. Admins control the whole store through a dedicated dashboard.

> **Status:** Architecture & planning document. This README describes the design, features and scaling strategy of the project.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [User Roles & Features](#user-roles--features)
4. [Admin Revenue Dashboard](#admin-revenue-dashboard)
5. [System Architecture](#system-architecture)
6. [Performance & Scalability](#performance--scalability)
   - [Load Balancing](#1-load-balancing)
   - [Caching](#2-caching)
   - [Latency Reduction](#3-latency-reduction)
   - [Scaling](#4-scaling)
7. [Payments](#payments)
8. [Responsive Design](#responsive-design)
9. [Data Model](#data-model)
10. [API Overview](#api-overview)
11. [Project Structure](#project-structure)
12. [Environment Variables](#environment-variables)
13. [Getting Started](#getting-started)
14. [Security](#security)
15. [Testing & Monitoring](#testing--monitoring)
16. [Roadmap](#roadmap)

---

## Overview

| Item | Detail |
|---|---|
| Type | Full-stack e-commerce web app |
| Stack | MongoDB, Express, React, Node.js |
| Roles | User (customer) and Admin |
| Payments | Cash on Delivery (COD) + Online payment |
| Core flow | Browse → Cart → Checkout → Order → Review |
| Design goal | Fast, responsive, horizontally scalable |

---

## Tech Stack

**Frontend**
- React (with React Router)
- State management: Redux Toolkit or Context API for cart/auth
- Data fetching & client cache: React Query (TanStack Query)
- Styling: Tailwind CSS (mobile-first, responsive)
- Build tool: Vite

**Backend**
- Node.js + Express.js (REST API)
- JWT authentication (access + refresh tokens), bcrypt password hashing
- Validation: Joi / Zod
- File uploads: Multer → cloud storage (Cloudinary / S3)

**Database & Infrastructure**
- MongoDB (Atlas or self-hosted replica set)
- Redis (caching, sessions, rate limiting)
- Nginx (reverse proxy & load balancer)
- Docker & Docker Compose (Kubernetes optional for large scale)
- CDN (Cloudflare / CloudFront) for static assets and images

---

## User Roles & Features

### Customer (User)
- Register, log in, log out, reset password
- Browse products with **pagination, search, filters, and sorting** (category, price, rating)
- View product details (images, description, stock, ratings)
- **Shopping cart**: add, remove, update quantity, persists across sessions
- **Like / wishlist** products
- Checkout with **Cash on Delivery** or **Online Payment**
- View order history and track order status
- **Leave reviews and ratings** (only on products they purchased, one per product)
- Edit profile and manage delivery addresses

### Admin
- Secure admin dashboard (role-based access)
- **Full CRUD on products** (name, price, stock, images, category, discounts)
- **Full CRUD on categories**
- Manage **orders**: view, update status (Pending → Confirmed → Shipped → Delivered / Cancelled), mark COD as paid on delivery
- Manage **users**: view, block/unblock, change roles
- **Moderate reviews**: view and delete inappropriate content
- Manage coupons / discounts (optional)
- **Revenue dashboard**: revenue, orders, and customer metrics with charts (see [Admin Revenue Dashboard](#admin-revenue-dashboard))
- Inventory alerts for low stock

---

## Admin Revenue Dashboard

A central page in the admin panel that shows how the store is performing at a glance.

### KPI Cards (top row)
| Metric | Description |
|---|---|
| **Total Revenue** | Sum of paid orders (online paid + COD marked as collected) |
| **Revenue Today / This Week / This Month** | With % change vs the previous period |
| **Total Orders** | Count, with breakdown by status (Pending, Confirmed, Shipped, Delivered, Cancelled) |
| **Average Order Value (AOV)** | Revenue ÷ number of orders |
| **New Customers** | Registered users in the selected period |
| **Pending COD Cash** | COD orders delivered but not yet marked as paid, plus COD orders still in transit |
| **Refunds / Cancellations** | Value and count, deducted from net revenue |

### Charts
- **Revenue over time**: line/area chart (daily, weekly, monthly, yearly toggle)
- **Orders over time**: bar chart compared with revenue
- **Payment method split**: COD vs Online (donut chart)
- **Revenue by category**: bar chart
- **Order status distribution**: donut or stacked bar
- **Customer growth**: new vs returning customers

### Tables & Insights
- **Top selling products** (by units and by revenue)
- **Low stock alerts** (products below threshold)
- **Recent orders** with quick status update
- **Top customers** by lifetime spend
- **Most liked / best rated products**

### Controls
- **Date range picker**: today, 7 days, 30 days, this year, custom range
- **Filters**: payment method, category, order status
- **Export**: CSV / PDF report of the selected range
- **Revenue rules**: revenue counts only when `paymentStatus = Paid`; cancelled and refunded orders are excluded

### How It Stays Fast
- Heavy numbers are computed with **MongoDB aggregation pipelines** on indexed fields (`createdAt`, `paymentStatus`, `orderStatus`), run on a **read replica** so the live store is not slowed down.
- Results are **cached in Redis** (short TTL, about 1 to 5 minutes) and refreshed when an order changes status.
- For large volumes, a **nightly background job** pre-computes daily summaries into a `DailyStats` collection, so charts read a few rows instead of scanning all orders.
- Charts are rendered on the client (Recharts / Chart.js) with lazy loading, and the page uses skeleton loaders.
- Fully responsive: KPI cards stack on mobile, charts resize, tables scroll horizontally.

### Dashboard Endpoints (Admin only)
| Endpoint | Purpose |
|---|---|
| `GET /admin/dashboard/summary?from=&to=` | KPI cards |
| `GET /admin/dashboard/revenue?interval=day\|week\|month` | Revenue time series |
| `GET /admin/dashboard/payment-split` | COD vs Online |
| `GET /admin/dashboard/top-products` | Best sellers |
| `GET /admin/dashboard/categories` | Revenue by category |
| `GET /admin/dashboard/export?format=csv\|pdf` | Report download |

---

## System Architecture

```
                         ┌──────────────┐
   Users / Admins  ───►  │     CDN      │  (static assets, images)
                         └──────┬───────┘
                                │
                         ┌──────▼───────┐
                         │ Nginx / LB   │  (SSL, gzip, rate limit, load balancing)
                         └──────┬───────┘
              ┌─────────────────┼─────────────────┐
       ┌──────▼─────┐    ┌──────▼─────┐    ┌──────▼─────┐
       │ Node API 1 │    │ Node API 2 │    │ Node API N │   (stateless)
       └──────┬─────┘    └──────┬─────┘    └──────┬─────┘
              └─────────────────┼─────────────────┘
                 ┌──────────────┴──────────────┐
          ┌──────▼──────┐               ┌───────▼───────┐
          │    Redis    │               │   MongoDB     │
          │ (cache,     │               │ Replica Set   │
          │  sessions)  │               │ (+ sharding)  │
          └─────────────┘               └───────────────┘
```

Key principle: **API servers are stateless**, so any instance can serve any request. State lives in MongoDB and Redis only.

---

## Performance & Scalability

### 1. Load Balancing

- **Nginx** (or a cloud load balancer such as AWS ALB) distributes traffic across multiple Node.js instances.
- Algorithm: **least connections** (fallback: round-robin).
- **Health checks** remove unhealthy instances automatically.
- Node **cluster mode / PM2** uses all CPU cores per machine.
- **Stateless JWT auth**: no sticky sessions required.
- SSL termination and HTTP/2 at the load balancer.
- Rate limiting at the edge to protect against abuse and bursts.

### 2. Caching

Multi-layer caching strategy:

| Layer | What is cached | Tool | Notes |
|---|---|---|---|
| Browser | Static assets (JS/CSS/images) | HTTP cache headers, hashed filenames | Long max-age |
| CDN | Images, static bundle, public pages | Cloudflare / CloudFront | Closest edge to user |
| Client | API responses | React Query | Stale-while-revalidate |
| Server | Product lists, product details, categories, top sellers, reviews summary | **Redis** | TTL-based |
| Database | Frequent queries | MongoDB indexes + WiredTiger cache | Index everything you filter by |

**Redis strategy**
- **Cache-aside pattern**: check Redis → on miss, query MongoDB → store with TTL.
- Suggested TTLs: product list 60–300 s, product detail 5–10 min, categories 1 hr.
- **Invalidation**: when an admin creates/updates/deletes a product, the related cache keys are deleted.
- Also used for: rate limiting counters, refresh-token blacklist, cart for guest users (optional).
- **Never cache**: user-specific private data such as payment info, or order status without short TTLs.

### 3. Latency Reduction

- **Database indexes** on: `category`, `price`, `slug`, `createdAt`, `user`, text index for search.
- **Pagination** everywhere (cursor-based for large lists), never return unbounded results.
- **Projection & `.lean()`** queries to return only needed fields.
- **Gzip/Brotli compression** on API responses.
- **Image optimization**: WebP/AVIF, multiple sizes, lazy loading, served through CDN.
- **Frontend**: code splitting, route-based lazy loading, tree shaking, skeleton loaders, debounced search.
- **Connection pooling** to MongoDB and Redis.
- **Async jobs** (emails, invoices, stock alerts) pushed to a queue (BullMQ) instead of blocking requests.
- Deploy servers and DB in the **region closest to users**; use read replicas for regional reads.
- Target metrics: API p95 < 200 ms for cached reads, LCP < 2.5 s on mobile.

### 4. Scaling

**Horizontal scaling (app tier)**
- Add more Node containers/instances behind the load balancer.
- Auto-scaling on CPU / request-rate thresholds (Docker Swarm, Kubernetes HPA, or cloud auto-scaling groups).

**Database scaling**
- **Replica set**: 1 primary + 2 secondaries for high availability and automatic failover.
- Route heavy read traffic (catalog browsing, analytics) to secondaries.
- **Sharding** when data outgrows one cluster (shard orders/reviews by hashed `_id` or `userId`).
- Archive old orders to cold storage.

**Redis scaling**
- Redis Sentinel or Redis Cluster for high availability.

**Other**
- Separate heavy workloads (reports, emails) into **worker services**.
- Consider splitting into microservices later (catalog, orders, payments) once traffic demands it.
- Handle **race conditions** on stock with atomic updates (`$inc` with condition) or transactions during checkout to prevent overselling.

---

## Payments

### Cash on Delivery (COD)
- Order created with `paymentMethod: COD` and `paymentStatus: Pending`.
- Stock is reserved immediately.
- Admin marks the order as paid when delivered and cash collected.
- Optional safeguards: COD order limits, phone confirmation, blocking users with repeated refused deliveries.

### Online Payment
- Integration with a payment gateway (Stripe, PayPal, or a regional provider).
- Flow: Checkout → create payment intent on server → customer pays on gateway-hosted/secure form → **webhook** confirms payment → order marked `Paid`.
- Never store card data; the gateway handles PCI compliance.
- **Idempotency keys** prevent duplicate charges.
- Failed/abandoned payments release reserved stock after a timeout.
- Refund support from the admin panel.

---

## Responsive Design

- **Mobile-first** approach with breakpoints for phone, tablet, laptop, and desktop.
- Fluid grids and flexible product cards (1 column on mobile → 4 on desktop).
- Touch-friendly buttons, sticky cart/checkout bar on mobile.
- Collapsible filters and hamburger navigation on small screens.
- Admin dashboard adapts: sidebar collapses, tables become scrollable cards on mobile.
- Accessibility: semantic HTML, ARIA labels, keyboard navigation, sufficient color contrast.

---

## Data Model

| Collection | Key fields |
|---|---|
| **User** | name, email, passwordHash, role (`user`/`admin`), addresses[], isBlocked, createdAt |
| **Product** | name, slug, description, price, discountPrice, images[], category, stock, ratingAvg, ratingCount, likesCount, createdAt |
| **Category** | name, slug, parent |
| **Cart** | user, items[{product, quantity, priceSnapshot}], updatedAt |
| **Order** | user, items[], shippingAddress, paymentMethod (`COD`/`ONLINE`), paymentStatus, orderStatus, totalPrice, paymentId, createdAt |
| **Review** | user, product, rating (1–5), comment, createdAt (unique per user+product) |
| **Like / Wishlist** | user, product (unique per pair) |
| **DailyStats** | date, revenue, ordersCount, codRevenue, onlineRevenue, newUsers, refunds (pre-computed for the dashboard) |
| **Coupon** (optional) | code, discount, expiry, usageLimit |

**Key indexes:** `Product(category, price)`, `Product(slug)` unique, text index on product name/description, `Order(user, createdAt)`, `Review(product)`, `Review(user, product)` unique.

---

## API Overview

Base path: `/api/v1`

| Area | Examples | Access |
|---|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` | Public |
| Products | `GET /products`, `GET /products/:id` | Public |
| Products (manage) | `POST`, `PUT`, `DELETE /products/:id` | Admin |
| Categories | `GET /categories` / admin CRUD | Public / Admin |
| Cart | `GET/POST/PUT/DELETE /cart` | User |
| Likes | `POST/DELETE /products/:id/like`, `GET /me/likes` | User |
| Reviews | `GET /products/:id/reviews`, `POST /products/:id/reviews` | Public / User |
| Reviews (moderate) | `DELETE /reviews/:id` | Admin |
| Orders | `POST /orders`, `GET /orders/my` | User |
| Orders (manage) | `GET /orders`, `PUT /orders/:id/status` | Admin |
| Payments | `POST /payments/intent`, `POST /payments/webhook` | User / Gateway |
| Users (manage) | `GET /users`, `PUT /users/:id` | Admin |
| Revenue dashboard | `GET /admin/dashboard/*` (summary, revenue, payment-split, top-products, export) | Admin |

---

## Project Structure

```
ecommerce-mern/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Store pages (Home, Product, Cart, Checkout, Orders)
│   │   ├── admin/           # Admin dashboard pages
│   │   ├── hooks/           # Custom hooks (React Query, auth)
│   │   ├── store/           # Cart/auth state
│   │   └── utils/
│   └── package.json
├── server/                  # Node/Express backend
│   ├── src/
│   │   ├── config/          # DB, Redis, env
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/      # auth, role check, cache, rate limit, errors
│   │   ├── services/        # payments, email, cache helpers
│   │   ├── jobs/            # Background queue workers
│   │   └── utils/
│   └── package.json
├── nginx/                   # Load balancer config
├── docker-compose.yml
└── README.md
```

---

## Environment Variables

**Server (`server/.env`)**
```
NODE_ENV=production
PORT=5000
MONGO_URI=
REDIS_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
CLIENT_URL=
PAYMENT_GATEWAY_SECRET_KEY=
PAYMENT_WEBHOOK_SECRET=
CLOUDINARY_URL=
EMAIL_SMTP_HOST=
EMAIL_SMTP_USER=
EMAIL_SMTP_PASS=
```

**Client (`client/.env`)**
```
VITE_API_URL=
VITE_PAYMENT_PUBLIC_KEY=
```

---

## Getting Started

**Prerequisites:** Node.js 20+, MongoDB, Redis, Docker (optional)

```bash
# 1. Clone the repository
git clone <repo-url> && cd ecommerce-mern

# 2. Install dependencies
cd server && npm install
cd ../client && npm install

# 3. Configure environment variables (see above)

# 4. Run in development
cd server && npm run dev
cd client && npm run dev

# 5. Or run the full stack with Docker (app instances + Nginx + Mongo + Redis)
docker compose up --build
```

---

## Security

- Passwords hashed with bcrypt; JWT in httpOnly secure cookies
- Role-based access control (user vs admin) on every protected route
- Input validation and sanitization (NoSQL injection and XSS protection)
- Helmet, CORS whitelist, rate limiting, brute-force protection on login
- HTTPS everywhere; secrets kept in environment variables / secret manager
- Payment webhooks verified by signature
- Audit log for admin actions

---

## Testing & Monitoring

- **Testing:** Jest + Supertest (API), React Testing Library (UI), Cypress/Playwright (end-to-end), k6 or Artillery (load testing)
- **Monitoring:** Prometheus + Grafana or a hosted APM; centralized logs (Winston + ELK/Loki)
- **Alerts:** error rate, latency p95, cache hit ratio, DB replication lag, low stock
- **CI/CD:** GitHub Actions: lint → test → build → deploy with zero-downtime rolling updates

---

## Roadmap

- [ ] Core: auth, products, cart, orders, COD
- [ ] Online payments + webhooks
- [ ] Reviews and likes
- [ ] Admin dashboard and revenue analytics (KPIs, charts, export)
- [ ] Redis caching + load-balanced deployment
- [ ] Load testing and performance tuning
- [ ] Coupons, email notifications, multi-language support
- [ ] PWA / mobile app

---

## License

MIT
