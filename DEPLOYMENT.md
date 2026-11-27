# Deploying Atelier

This guide takes the project from your PC to a public website with HTTPS, two load-balanced API instances, caching, and working payments. It follows the files we already built: `backend/Dockerfile`, `docker-compose.yml`, `nginx/nginx.conf`, `backend/ecosystem.config.cjs`.

Read the checklist in section 2 first. The steps in section 4 are the recommended path: one small Linux server running Docker Compose.

> Honest note: these steps were written from the project files, not run on a real server (no Docker or server was available while writing them). Do the whole thing once on a cheap server before you point real customers at it, and run `npm run test:api` against it.

---

## 1. What runs where

```
Browser
   |  HTTPS
Cloudflare (free: HTTPS, DDoS shield, CDN for images/JS)
   |  HTTP
Nginx (port 80)  --  serves the React site (frontend/dist)
   |                 and proxies /api/ to the API instances (least_conn, retry on failure)
   +-- api1 (Node, 2 workers)  --+
   +-- api2 (Node, 2 workers)  --+-- Redis  (cache + shared rate limits)
                                 +-- MongoDB (Atlas recommended, or the bundled container)
                                 +-- Cloudinary (product images)
Stripe / Flouci  --webhook-->  /api/v1/payments/...
```

Why the website and the API share one domain: the React app calls `/api/v1/...` with a relative address and the login cookie is scoped to `/api/v1/auth`. Serving both from the same Nginx keeps cookies and CORS simple.

---

## 2. Checklist before going live

Secrets and accounts
- [ ] A domain name, added to Cloudflare (free plan).
- [ ] MongoDB Atlas cluster (M0 is fine to start, M10+ for real traffic) with a database user and the server's IP in **Network Access**.
- [ ] Cloudinary account (you have this). Rotate any key that was ever pasted in a screenshot or chat.
- [ ] New random `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`, different from each other and from the development ones. Generate each with PowerShell:
  `[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])`
- [ ] A strong `ADMIN_PASSWORD` (not `Admin12345`).
- [ ] Stripe and Flouci live keys. The exact variable names are in `backend/.env.example`; copy them from there.

Decisions
- [ ] Currency. Stripe does not onboard Tunisian businesses and does not charge in TND by default. Set `STRIPE_CURRENCY` and `STRIPE_RATE` (see `.env.example`) so card payments are converted correctly, or offer only Flouci and cash on delivery.
- [ ] Shipping fee and free-shipping threshold are in `frontend/src/config.js` (display) and must match the backend settings.

---

## 3. Choose a path

| Path | Good for | Effort |
|---|---|---|
| **A. One VPS + Docker Compose** (this guide) | Real launch, full control, shows load balancing | Medium |
| B. VPS + PM2, no Docker | Smallest server, you know Linux | Medium |
| C. Managed hosting (API on Render/Railway, site on Netlify/Cloudflare Pages) | No server to manage | Low, but see note |

Path C note: the site calls `/api/v1/...` on its own domain, so the host must forward `/api/*` to your API (for Netlify, a `_redirects` line: `/api/* https://YOUR-API-HOST/api/:splat 200`). Load balancing and Redis then come from the host's plan.

Path B in short: install Node 20+, copy `backend`, `npm ci --omit=dev`, create `.env`, run `pm2 start ecosystem.config.cjs`, `pm2 save`, `pm2 startup`. Put Nginx in front for HTTPS. The rest of this guide applies unchanged.

---

## 4. Path A step by step

### 4.1 The server
- Ubuntu 24.04, 2 vCPU / 2 GB RAM is enough to start (Hetzner, DigitalOcean, OVH...).
- Open ports 22 and 80 in the firewall. With Cloudflare in front you do not need to open 443 on the server.
- Install Docker: `curl -fsSL https://get.docker.com | sh`, then `sudo usermod -aG docker $USER` and log in again.

### 4.2 Put the code on the server
From your PC (PowerShell), leaving out heavy folders:
```
scp -r C:\Users\PC\Desktop\ecommerce user@SERVER_IP:~/ecommerce
```
Or push the project to a private Git repository and `git clone` it on the server. Never commit `backend/.env`.

### 4.3 Production settings: `backend/.env` on the server
Take your development `.env` and change at least:
```
NODE_ENV=production
CLIENT_URL=https://yourdomain.com
MONGO_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/ecommerce?retryWrites=true&w=majority
JWT_ACCESS_SECRET=<new random value>
JWT_REFRESH_SECRET=<new random value>
ADMIN_EMAIL=you@yourdomain.com
ADMIN_PASSWORD=<strong password>
```
Keep the Cloudinary lines and the Stripe/Flouci lines (live keys). Remember the database name `/ecommerce` in `MONGO_URI`.

`NODE_ENV=production` turns on secure cookies, so the site must be opened over HTTPS (Cloudflare gives you that). Leave it on `development` while testing over plain `http://SERVER_IP`.

### 4.4 Use Atlas instead of the bundled MongoDB (recommended)
`docker-compose.yml` starts its own `mongo` container and overrides `MONGO_URI` for the API. For Atlas, edit `docker-compose.yml`:
1. In the `x-api` block delete the line `MONGO_URI: mongodb://mongo:27017/ecommerce`, and delete the `mongo:` entry under `depends_on`.
2. Delete the whole `mongo:` service and the `mongo_data:` volume.

Then the API uses the `MONGO_URI` from `backend/.env`. In Atlas, add the server's public IP under **Network Access**.

If you keep the bundled MongoDB, back it up yourself (see 6.3).

### 4.5 Build the website
On your PC (or on the server if Node is installed):
```
cd frontend
npm ci
npm run build
```
This creates `frontend/dist`. Copy it to the server next to `docker-compose.yml` (`scp -r frontend\dist user@SERVER_IP:~/ecommerce/frontend/`). Rebuild and copy again after every frontend change.

### 4.6 Nginx: serve the site and the API
Replace `nginx/nginx.conf` with this version. It keeps everything from the current file (least-connections balancing, failover, edge rate limit, 26 MB uploads) and adds the website, caching headers for static files, gzip, and correct HTTPS detection behind Cloudflare.

```nginx
worker_processes auto;

events {
  worker_connections 1024;
}

http {
  server_tokens off;
  include /etc/nginx/mime.types;

  gzip on;
  gzip_types text/css application/javascript application/json image/svg+xml;
  gzip_min_length 1024;

  # Cloudflare tells us the visitor used HTTPS; pass that on so the API sets secure cookies correctly
  map $http_x_forwarded_proto $fwd_proto {
    default $scheme;
    https   https;
  }

  limit_req_zone $binary_remote_addr zone=api_zone:10m rate=20r/s;

  upstream api_backend {
    least_conn;
    server api1:5000 max_fails=3 fail_timeout=10s;
    server api2:5000 max_fails=3 fail_timeout=10s;
    keepalive 32;
  }

  server {
    listen 80;
    client_max_body_size 26m;

    root /usr/share/nginx/html;
    index index.html;

    location /health {
      access_log off;
      proxy_pass http://api_backend/health;
      proxy_http_version 1.1;
      proxy_set_header Connection "";
    }

    location /api/ {
      limit_req zone=api_zone burst=40 nodelay;
      limit_req_status 429;

      proxy_pass http://api_backend;
      proxy_http_version 1.1;
      proxy_set_header Connection "";
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $fwd_proto;

      proxy_next_upstream error timeout http_502 http_503 http_504;
      proxy_next_upstream_tries 2;
      proxy_connect_timeout 3s;
      proxy_read_timeout 60s;
    }

    # built files have hashed names, so they can be cached for a year
    location /assets/ {
      expires 1y;
      add_header Cache-Control "public, immutable";
      try_files $uri =404;
    }

    # every other address is a page of the React app
    location / {
      add_header Cache-Control "no-cache";
      try_files $uri $uri/ /index.html;
    }
  }
}
```

In `docker-compose.yml`, add the website folder to the `nginx` service volumes:
```yaml
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./frontend/dist:/usr/share/nginx/html:ro
```

Behind Cloudflare, the visitor's real IP arrives in a header, not the connection. The per-IP limits (Nginx and the API) then see Cloudflare's addresses. If you rely on them against abuse, add Cloudflare's IP ranges with `set_real_ip_from` and `real_ip_header CF-Connecting-IP;` (list: https://www.cloudflare.com/ips/), and mind that the API's `trust proxy` is set to 1.

### 4.7 Start it
```
cd ~/ecommerce
docker compose up -d --build
docker compose ps                 # everything should be "healthy"
curl http://localhost/health      # {"status":"ok",...}
docker compose exec api1 node src/seed/createAdmin.js
```
The last line creates the admin from `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

### 4.8 HTTPS with Cloudflare
1. Add your domain to Cloudflare and switch your registrar's nameservers to the ones Cloudflare gives you.
2. Add an `A` record: `@` (and `www`) pointing to the server IP, proxy status **Proxied** (orange cloud).
3. **SSL/TLS -> Overview:** choose **Flexible** to start (Cloudflare to server over HTTP, which is what this Nginx speaks). For **Full (strict)** you must also install a certificate on the server (Cloudflare Origin Certificate) and add a `listen 443 ssl` server block.
4. **SSL/TLS -> Edge Certificates:** turn on **Always use HTTPS**.
5. Open `https://yourdomain.com`, log in as the admin.

Alternative without Cloudflare: install Caddy or Certbot on the server and let it terminate HTTPS in front of Nginx.

---

## 5. Making payments live

**Cash on delivery** needs nothing more.

**Stripe**
1. Dashboard -> Developers -> Webhooks -> Add endpoint: `https://yourdomain.com/api/v1/payments/stripe/webhook`, event `checkout.session.completed` (and the failed/expired events if you want orders released earlier).
2. Copy the signing secret into the webhook variable in `backend/.env`, set the live secret key, then `docker compose up -d` to reload.
3. Test locally first with the Stripe CLI: `stripe listen --forward-to localhost:5000/api/v1/payments/stripe/webhook`.

**Flouci**
1. Put the live app token and secret in `.env`.
2. Webhook: `https://yourdomain.com/api/v1/payments/flouci/webhook`. The customer's return also triggers a server-side verification, so a missed webhook does not lose a payment.

**What happens to unpaid online orders:** they keep their reserved stock for `ORDER_PAYMENT_TIMEOUT_MIN` minutes (default 45), then a background job cancels them and returns the stock. Only one API instance runs the job at a time (Redis lock), so two instances never do it twice. This is one reason Redis should stay on in production.

Always make one real small payment end to end before launch: place the order, pay, see it become `Paid`, see it in the revenue dashboard.

---

## 6. Running it

### 6.1 Deploying updates without downtime
Backend (two instances, so one is always up):
```
docker compose build
docker compose up -d --no-deps api1     # wait until healthy (docker compose ps)
docker compose up -d --no-deps api2
```
Nginx retries the other instance while one restarts, and POST requests are never retried automatically, so an order is never placed twice.

Frontend: `npm run build`, copy `dist`, done. Nginx serves the new files immediately.

### 6.2 Scaling
- **Up:** a bigger server, and raise `WEB_CONCURRENCY` (workers per container) in `docker-compose.yml`. One worker per CPU core is the rule.
- **Out:** add `api3` in `docker-compose.yml` (copy `api2`), and add `server api3:5000 max_fails=3 fail_timeout=10s;` to the Nginx `upstream`. Everything shared (rate limits, cache, payment-timeout lock) lives in Redis and MongoDB, so any number of instances works.
- **Database:** move to a larger Atlas tier and add read replicas before anything else; the API itself is rarely the first limit.
- **Cache:** product lists, categories and the dashboard are cached in Redis (the response header `X-Cache: HIT/MISS` shows it). If pages feel slow, check Redis is running, not that the API needs more servers.

### 6.3 Backups
- Atlas: enable **Cloud Backup** (M10+) or schedule `mongodump` on M0.
- Bundled MongoDB: `docker compose exec mongo mongodump --archive --gzip > backup-$(date +%F).gz`, copy it off the server daily.
- Cloudinary keeps the images; keep a note of your cloud name.
- Keep `backend/.env` in a password manager, not only on the server.

### 6.4 Watching it
- `docker compose logs -f api1 api2` (request lines show status and time in ms).
- `docker compose ps` shows health.
- A free uptime monitor (UptimeRobot, Better Stack) on `https://yourdomain.com/health` emails you if the site goes down.

---

## 7. Hardening checklist

- [ ] `NODE_ENV=production`, site only reachable over HTTPS.
- [ ] Strong, unique JWT secrets and admin password. Change the admin password after the first login.
- [ ] Atlas Network Access limited to the server IP (not `0.0.0.0/0`).
- [ ] No `.env` in Git, Docker image or screenshots. If a secret leaked once, rotate it.
- [ ] Redis and MongoDB ports are **not** published in `docker-compose.yml` (they are not, keep it that way).
- [ ] Server: firewall on, SSH keys only, automatic security updates (`unattended-upgrades`).
- [ ] Cloudflare: **Always use HTTPS**, Bot Fight Mode on, rate-limit rule on `/api/v1/auth/*` if you see abuse.
- [ ] The API already has Helmet, rate limits (20 logins per 15 min per IP, 300 API requests per 15 min per IP), input sanitising, bcrypt, rotating refresh tokens and prices read from the database, not from the browser.

---

## 8. Test it before and after launch

```
cd backend
npm run test:api      # accounts, permissions, stock, orders, reviews, dashboard
npm run load          # health + catalogue endpoints under load, fails on errors or slow p99
```
Run both against the real server by pointing them at it:
```
$env:API_URL="https://yourdomain.com/api/v1"; npm run test:api
$env:LOAD_URL="https://yourdomain.com"; npm run load
```
Notes:
- `test:api` creates a category, a product, two orders and a QA customer (`qa-...@example.test`), then deletes the product and category. Delete the QA customer from Admin -> Users if you do not want it. Use a staging database if you can.
- Through Nginx and Cloudflare, the load test is meant to hit the rate limits: `429` is counted as "limited", not as a failure. For a pure capacity test run it on the server against one API (`LOAD_URL=http://localhost:5000`) with `API_RATE_LIMIT=1000000` set for that run, and never leave that value in production.
- Pass criteria: no 5xx, no timeouts, p99 under 800 ms (change with `P99_MS`).

---

## 9. When something goes wrong

| Symptom | Likely cause |
|---|---|
| Site loads, login says "network error" | `/api/` not reaching Nginx, or `CLIENT_URL` does not match the site address exactly (https, no trailing slash) |
| Login works, then you are logged out on refresh | The refresh cookie is `secure` but the visit was over HTTP, or `X-Forwarded-Proto` is not `https` (see the `map` in 4.6) |
| `/api/...` returns 502 | API containers are not healthy: `docker compose logs api1`. Usually a wrong `MONGO_URI` or Atlas IP not allowed |
| `querySrv ECONNREFUSED` on the server | The server's DNS cannot resolve Atlas SRV records. Set `MONGO_DNS_SERVERS=8.8.8.8,1.1.1.1` (already supported) or use the non-SRV connection string |
| Image upload "Stale request" / "Invalid Signature" | Server clock wrong (`timedatectl`) / wrong Cloudinary secret |
| Payment done but order stays Pending | Webhook not reaching the server (check the gateway's webhook log, the URL, and the signing secret) |
| Many 429 errors for real users | Everyone shares one IP (office, Cloudflare without real-IP setup). Configure `set_real_ip_from` (4.6) or raise `API_RATE_LIMIT` modestly |
| Pages slow, `X-Cache: MISS` always | Redis is down or not reachable: `docker compose logs redis`, check `REDIS_URL` |
| Out of disk space | `docker system prune -af` (after checking nothing important is stopped), rotate logs |
