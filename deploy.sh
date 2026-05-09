#!/usr/bin/env bash
set -euo pipefail

echo "==> Veyron deployment started"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is not installed. Install Docker first."
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "ERROR: Docker Compose is not installed."
  exit 1
fi

if [ -d .git ]; then
  echo "==> Pulling latest code"
  git pull --rebase || {
    echo "WARNING: git pull failed. Continuing with local code."
  }
fi

if [ ! -f "./backend/.env" ]; then
  echo "ERROR: backend/.env not found. Copy backend/.env.example to backend/.env and fill secrets."
  exit 1
fi

echo "==> Building and starting services"
$COMPOSE_CMD up -d --build

echo "==> Deployment completed"
echo "Backend is running at: http://localhost:8000"
echo "Health check: http://localhost:8000/health"
