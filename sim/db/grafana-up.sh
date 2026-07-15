#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE=(docker compose -f "$ROOT/sim/db/docker-compose.yml")

pull_with_retry() {
  local attempt max=5
  for attempt in $(seq 1 "$max"); do
    if "${COMPOSE[@]}" pull; then
      return 0
    fi
    echo "Pull failed (attempt ${attempt}/${max}) — Docker Hub CDN иногда отдаёт 503. Повтор через 5с..."
    sleep 5
  done
  echo "Не удалось скачать образ после ${max} попыток."
  echo "Попробуй позже или: npm run sim:dashboard  (без Docker, порт 3040)"
  return 1
}

pull_with_retry
"${COMPOSE[@]}" up -d

echo ""
echo "Grafana: http://localhost:3030"
echo "Login:   admin / admin"
echo "Dashboard: Sim Balance (выбери batch_id вверху)"
