# Runbook de Operaciones — ACISEM

## Stack

| Componente | Tecnología |
|---|---|
| App | Node.js 20 + Express |
| DB (dev) | SQLite (`data/database.sqlite`) |
| DB (prod) | PostgreSQL 16 (Supabase) |
| Proxy/SSL | Render (automático) |
| Logger | Pino (JSON estructurado) |
| Error tracking | Sentry (opcional) |
| Tests | Node Test Runner + Playwright |
| CI | GitHub Actions (tests) |
| Deploy | Render (auto-deploy desde GitHub) |

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

## Deploy en Render

### Requisitos
- Cuenta en [render.com](https://render.com) (sin tarjeta)
- Repositorio en GitHub (`sistemaacisem/presupuesto`)

### Pasos

1. Ir a [dashboard.render.com](https://dashboard.render.com) → **New +** → **Web Service**
2. Conectar GitHub y seleccionar `sistemaacisem/presupuesto`
3. Configurar:
   - **Name:** `presupuesto`
   - **Environment:** `Docker`
   - **Branch:** `main`
   - **Health Check Path:** `/api/health`
4. Agregar variables de entorno:
   - `NODE_ENV` → `production`
   - `DB_DRIVER` → `pg`
   - `DATABASE_URL` → (la connection string de Supabase con la contraseña rotada)
   - `JWT_SECRET` → (el generado: `1a0848f64216dd5afe81775c8fca6ca9b3efcb6ed32c11c150e3999ddf483865`)
   - `JWT_EXPIRES_IN` → `24h`
   - `SEED_DEMO` → `false`
5. **Create Web Service** — Render builda el Dockerfile y deploya
6. Render asigna una URL: `https://presupuesto.onrender.com`

### Auto-deploy
Render redeploya automáticamente cada push a `main`. Para deshabilitar:
**Dashboard → presupuesto → Settings → Auto-Deploy → No**

### Evitar sleep (keep-alive)
Render duerme el servicio gratis tras 15 min sin actividad. Hay 3 mecanismos:

**1. Cliente-side (automático)**
Mientras un usuario tenga la app abierta en el navegador, se pingea `/api/health` cada 5 min. Cubre el horario laboral.

**2. GitHub Actions (gratis, automático)**
El workflow `.github/workflows/keepalive.yml` pingea cada 10 min — sin configuración extra, funciona 24/7.

**3. UptimeRobot (gratis, más confiable)**
1. Crear cuenta gratis en [uptimerobot.com](https://uptimerobot.com)
2. **Add New Monitor** → HTTP(s) → `https://presupuesto.onrender.com/api/health` → 5 min

## Monitoreo

- `GET /api/health` — Estado básico del servidor
- `GET /api/readyz` — Readiness probe (DB check, 503 si caída)
- `GET /api/metrics` — Métricas detalladas (memoria, CPU, requests, uptime)
- **UptimeRobot** te alerta por email si la app no responde

## Variables de Entorno

| Variable | Requerido | Default | Descripción |
|---|---|---|---|
| `PORT` | No | 3000 | Puerto del servidor |
| `DB_DRIVER` | No | sqlite | `sqlite` o `pg` |
| `DATABASE_URL` | Si (pg) | — | Connection string PostgreSQL (Supabase) |
| `JWT_SECRET` | **Sí** | — | Clave para firmar tokens |
| `JWT_EXPIRES_IN` | No | 24h | Expiración de tokens |
| `SENTRY_DSN` | No | — | DSN de Sentry para error tracking |
| `SENTRY_SAMPLE_RATE` | No | 0.1 | Tasa de muestreo Sentry (0.0–1.0) |
| `SEED_DEMO` | No | true | Sembrar datos demo al iniciar |

## Troubleshooting

### 5xx en Render
1. Ir a **Dashboard → presupuesto → Logs**
2. Verificar Sentry si está configurado
3. Check DB: `curl https://presupuesto.onrender.com/api/readyz`

### App no responde (timeout)
1. UptimeRobot te alerta
2. Revisar logs en dashboard de Render
3. Verificar que Supabase esté accesible desde Render

### Tests E2E fallan por timeout en SPA
Los tests que navegan con hash (`#/history`, `#/budget`, `#/providers`) pueden fallar si un servidor anterior quedó corriendo:
```bash
# 1. Matar proceso en puerto 3000
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force

# 2. Correr tests
npm run test:e2e
```

Si el problema persiste, probar `reuseExistingServer: false` en `playwright.config.js`.
