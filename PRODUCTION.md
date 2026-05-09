# Veyron Production Deployment Guide (HTTPS)

This guide covers secure deployment for the Veyron hackathon stack with Nginx reverse proxy, Let's Encrypt SSL, and Docker Compose production overrides.

## Architecture

- `nginx` (public edge): TLS termination, security headers, gzip, request routing, rate limiting
- `backend` (FastAPI + Gunicorn/Uvicorn workers): internal app API on port `8000`
- `frontend` (Nginx static): serves built React app
- `redis` (optional): cache/session/rate-limit helper store for future scale
- `certbot`: auto-renews certificates every 12 hours (checks renew eligibility)

## Files

- `docker-compose.yml` -> development stack (HTTP, fast reload)
- `docker-compose.prod.yml` -> production overrides/services (HTTPS)
- `backend/Dockerfile.prod` -> backend production image
- `Dockerfile.frontend.prod` -> frontend static image
- `nginx/nginx.conf` -> global Nginx settings (gzip + rate limit zone)
- `nginx/veyron.conf` -> site routing + TLS + security headers
- `.env.prod.example` -> production environment template
- `setup-prod.sh` -> one-command prod setup with certificate provisioning

## 1) Domain and DNS Setup

### Option A: Use your own domain
1. Buy/use a domain from any provider.
2. Create an `A` record:
   - `@` -> your server public IP
   - `www` -> your server public IP (optional)
3. Wait for DNS propagation (`dig yourdomain.com +short`).

### Option B: Free domain (hackathon quick path)
- You can try free providers like [Freenom](https://www.freenom.com/) (availability may vary by region/time).
- Alternative: use a free subdomain from providers like DuckDNS/No-IP.

### Option C: IP-based fallback
- HTTPS with Let's Encrypt needs a domain.
- For pure IP demo, you can run HTTP only (not recommended for final judging).

## 2) Server Prerequisites

- Ubuntu/Debian VPS recommended (2 vCPU / 2GB RAM minimum)
- Docker + Docker Compose plugin installed
- Ports open in firewall/security group:
  - `22/tcp` (SSH)
  - `80/tcp` (HTTP + ACME challenge)
  - `443/tcp` (HTTPS)

## 3) Configure Environment

1. Copy production template:
   - `cp .env.prod.example .env.prod`
2. Copy backend env:
   - `cp backend/.env.example backend/.env`
3. Fill secrets:
   - Gemini API key
   - Safe Browsing API key
   - VirusTotal key
   - Firebase values (if used)

## 4) One-command HTTPS Setup

```bash
chmod +x setup-prod.sh
./setup-prod.sh example.com
```

What it does:
- verifies Docker/Compose
- writes domain into `.env.prod`
- provisions Let's Encrypt cert for your domain
- starts production services with:
  - `docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod up -d --build`
- runs basic health checks

## 5) Manual Production Start

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod up -d --build
```

## 6) Certbot and HTTPS Renewal

Initial certificate:
- handled by `setup-prod.sh`

Auto-renew:
- `certbot` service runs periodic renew checks every 12h in prod compose.

Recommended monthly validation:
```bash
docker logs veyron-certbot --tail 100
docker exec veyron-nginx nginx -s reload
```

## 7) Routing Rules

- `https://<domain>/api/*` -> FastAPI backend
- `https://<domain>/*` -> Frontend app
- `http://<domain>/*` -> redirected to HTTPS

## 8) Security Best Practices Included

- HSTS enabled
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- gzip compression enabled
- Nginx rate limit: `100 req/min/IP` for `/api/`
- internal network isolation between edge/app containers

## 9) Health Checks

- Local backend health: `http://localhost:8000/health`
- Public health: `https://<domain>/health`
- API docs: `https://<domain>/docs`

## 10) Monitoring (Optional but Recommended)

- Container status:
  - `docker ps`
- Service logs:
  - `docker logs veyron-nginx`
  - `docker logs veyron-backend`
- Add uptime monitoring:
  - UptimeRobot / Better Stack free monitors for `/health`
- Add metrics stack later:
  - Prometheus + Grafana + Loki

## 11) Backup Strategy

- Back up `.env.prod`, `backend/.env`, and Firebase credentials securely
- Redis persistence volume backup:
  - `docker run --rm -v veyron_redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tgz /data`
- For disaster recovery:
  - Keep Git repo mirrored
  - Export Firebase data periodically
  - Store backups in remote object storage (S3-compatible)

## Judge Runbook

1. Provide domain + DNS A record to server IP
2. Run: `./setup-prod.sh yourdomain.com`
3. Verify: `https://yourdomain.com/health`
4. Open `https://yourdomain.com/docs` and test endpoints
