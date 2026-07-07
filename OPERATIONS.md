# Runbook de Operaciones — ACISEM

## Stack

| Componente | Tecnología |
|---|---|
| App | Node.js 20 + Express |
| DB (dev) | SQLite (`data/database.sqlite`) |
| DB (prod) | PostgreSQL 16 |
| Proxy/SSL | Caddy (Let's Encrypt automático) |
| Logger | Pino (JSON estructurado) |
| Error tracking | Sentry (opcional) |
| Tests | Node Test Runner + Playwright |
| CI/CD | GitHub Actions → GHCR |

## Comandos útiles

```bash
# Iniciar en desarrollo
npm run dev

# Tests unitarios
npm test

# Tests E2E
npm run test:e2e

# Migrar DB (SQLite)
npm run migrate

# Migrar DB (PostgreSQL)
npm run setup:pg

# Seed datos demo
npm run seed
```

## Docker

```bash
# Iniciar todo (app + PostgreSQL + Caddy + Backup)
docker compose up -d

# Ver logs
docker compose logs -f app

# Backup manual
docker compose exec backup /usr/local/bin/backup.sh

# Restaurar backup
docker compose exec -T db psql -U presupuesto presupuesto < backup.sql

# Health check
curl http://localhost:3000/api/health
curl http://localhost:3000/api/readyz
curl http://localhost:3000/api/metrics
```

## Monitoreo

- `GET /api/health` — Estado básico del servidor
- `GET /api/readyz` — Readiness probe (DB check, 503 si caída)
- `GET /api/metrics` — Métricas detalladas (memoria, CPU, requests, uptime)
- `GET /api/audit` — Logs de auditoría (query params: `entity_type`, `entity_id`, `limit`)

## Alertas

- **Error tracking**: Configurar `SENTRY_DSN` en `.env` para capturar errores 5xx
- **Backup**: El servicio `backup` en compose corre `pg_dump` cada 24h con retención de 7 días
- **Healthcheck**: Docker reinicia el contenedor `app` si falla 5 veces seguidas (c/15s)

## Variables de Entorno

| Variable | Requerido | Default | Descripción |
|---|---|---|---|
| `PORT` | No | 3000 | Puerto del servidor |
| `DB_DRIVER` | No | sqlite | `sqlite` o `pg` |
| `DATABASE_URL` | Si (pg) | — | Connection string PostgreSQL |
| `JWT_SECRET` | **Sí** | — | Clave para firmar tokens |
| `JWT_EXPIRES_IN` | No | 24h | Expiración de tokens |
| `CADDY_DOMAIN` | No | — | Dominio para HTTPS (dejar vacío para HTTP local) |
| `CADDY_EMAIL` | Si (dominio) | — | Email para Let's Encrypt |
| `SENTRY_DSN` | No | — | DSN de Sentry para error tracking |
| `SENTRY_SAMPLE_RATE` | No | 0.1 | Tasa de muestreo Sentry (0.0–1.0) |
| `PG_PASSWORD` | No | presupuesto_secret | Password PostgreSQL (solo Docker) |

## Troubleshooting

### 5xx en producción
1. Revisar logs: `docker compose logs app`
2. Verificar Sentry si está configurado
3. Check DB: `curl http://localhost:3000/api/readyz`
4. Ver métricas: `curl http://localhost:3000/api/metrics`

### Backup no se ejecuta
1. Verificar que el servicio `backup` esté corriendo: `docker compose ps`
2. Revisar logs: `docker compose logs backup`
3. Ejecutar manual: `docker compose exec backup /usr/local/bin/backup.sh`

### Certificado SSL vencido
Caddy renueva automáticamente. Si hay problemas:
```bash
docker compose logs caddy
```

### Tests E2E fallan por timeout en SPA
Los tests que navegan con hash (`#/history`, `#/budget`, `#/providers`) pueden fallar si un servidor anterior quedó corriendo:
```bash
# 1. Matar proceso en puerto 3000
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force

# 2. Correr tests
npm run test:e2e
```

Si el problema persiste, probar `reuseExistingServer: false` en `playwright.config.js`.
