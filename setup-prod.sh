#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: ./setup-prod.sh <domain>"
  exit 1
fi

DOMAIN="$1"
EMAIL_DEFAULT="admin@${DOMAIN}"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is not installed."
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "ERROR: Docker Compose is required."
  exit 1
fi

if [ ! -f .env.prod ]; then
  cp .env.prod.example .env.prod
fi

if grep -q '^DOMAIN=' .env.prod; then
  sed -i.bak "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|g" .env.prod && rm -f .env.prod.bak
else
  echo "DOMAIN=${DOMAIN}" >> .env.prod
fi

if ! grep -q '^CERTBOT_EMAIL=' .env.prod; then
  echo "CERTBOT_EMAIL=${EMAIL_DEFAULT}" >> .env.prod
fi

CERTBOT_EMAIL="$(grep '^CERTBOT_EMAIL=' .env.prod | cut -d'=' -f2)"
STAGING="$(grep '^LETSENCRYPT_STAGING=' .env.prod | cut -d'=' -f2 || true)"

echo "==> Using domain: ${DOMAIN}"
echo "==> Preparing nginx domain config"
if [ ! -f nginx/veyron.conf.template ]; then
  echo "ERROR: nginx/veyron.conf.template not found."
  exit 1
fi
sed "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" nginx/veyron.conf.template > nginx/veyron.conf

echo "==> Requesting Let's Encrypt certificate"
STAGING_ARG=""
if [ "${STAGING:-0}" = "1" ]; then
  STAGING_ARG="--staging"
fi

docker run --rm -p 80:80 \
  -v certbot_etc:/etc/letsencrypt \
  certbot/certbot certonly --standalone \
  -d "${DOMAIN}" \
  --agree-tos \
  --email "${CERTBOT_EMAIL}" \
  --non-interactive \
  ${STAGING_ARG}

echo "==> Starting production services"
$COMPOSE -f docker-compose.yml -f docker-compose.prod.yml --profile prod up -d --build

echo "==> Running health checks"
sleep 6
curl -fsS "http://localhost:8000/health" >/dev/null && echo "Backend health: OK" || echo "Backend health check failed"
curl -kfsS "https://${DOMAIN}/health" >/dev/null && echo "HTTPS health: OK" || echo "HTTPS health check failed"

echo "==> Done"
echo "Open: https://${DOMAIN}"
