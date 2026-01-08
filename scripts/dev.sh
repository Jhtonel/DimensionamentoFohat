#!/bin/sh
set -e

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f "$ROOT_DIR/dev.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^\s*#' "$ROOT_DIR/dev.env" | grep -v '^\s*$' | xargs)
else
  echo "❌ Arquivo dev.env não encontrado."
  echo "   Copie dev.env.example -> dev.env e cole sua DATABASE_URL do Railway."
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL não definida em dev.env"
  exit 1
fi

echo "✅ Iniciando backend (Flask) + frontend (Vite) em modo DEV"

python3 servidor_proposta.py &
BACK_PID=$!

cleanup() {
  echo "\n🧹 Encerrando backend (pid=$BACK_PID)"
  kill "$BACK_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

npm run dev:frontend


