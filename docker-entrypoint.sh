#!/bin/sh
set -e

echo "============================================================"
echo "  Asistente de Compras Inteligente — Docker Entrypoint"
echo "============================================================"
echo ""

if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(node -e "const crypto=require('crypto');console.log(crypto.randomBytes(32).toString('hex'))")
  echo "[ENTRYPOINT] JWT_SECRET generado automáticamente"
fi
export JWT_SECRET

if [ "$DB_DRIVER" = "pg" ]; then
  echo "[ENTRYPOINT] DB_DRIVER=pg — ejecutando migraciones..."
  node server/migrate.js
  echo ""

  if [ "$SEED_DEMO" = "true" ]; then
    echo "[ENTRYPOINT] SEED_DEMO=true — sembrando datos demo..."
    node server/seeds/demo_data.js
    echo ""
  else
    echo "[ENTRYPOINT] SEED_DEMO no está definido como 'true' — omitiendo seed"
  fi
else
  echo "[ENTRYPOINT] DB_DRIVER=sqlite — migraciones manejadas por database.js"
fi

echo "[ENTRYPOINT] Iniciando servidor..."
exec node server/index.js
