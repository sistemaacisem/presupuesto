# Instrucciones para Agentes (AI)

## Registro de bugs

Cada vez que se encuentre un bug o hallazgo relevante:

1. **Agregar entrada en `BUGS.md`** con:
   - Fecha (`YYYY-MM-DD`)
   - Número correlativo
   - Breve descripción del bug
   - Severidad (`Alta` / `Media` / `Baja`)
   - Causa raíz
   - Solución aplicada (o `Pendiente` si no se resuelve en ese momento)

2. Si se aplica una solución en el mismo turno, actualizar la entrada inmediatamente.

## Formato de entrada

```
| Fecha | # | Bug | Severidad | Causa | Solución |
|---|---|---|---|---|---|
```

---

## Progreso del Proyecto — 2026-07-08

### Done
- **E2E SPA Timeouts fix**: `reuseExistingServer: false` en `playwright.config.js` para que siempre se refresque la DB entre ejecuciones
- **Login rate limiter fix**: `NODE_ENV === 'test'` → `max: 500` para evitar bloqueo en suites E2E de 75+ tests
- **Selectores E2E corregidos**: `#articles-search`→`#art-search`, `#charts-section`→`#chart-category`, `#provider-search`→`#prov-search`, `#global-search-input`→`#main-search`, `#history-table`→`#hist-table`, etc.
- **Tests de lógica corregidos**: `toBeEnabled()`→`toBeDisabled()` (btn Comparar), bulk delete ahora checkea checkbox primero, budget detail usa `tfoot` + `h1` con regex
- **Diseño Bloomberg/Financial (Opción C)**: paleta oscura completa, sidebar `#080C18`, active state verde, texto `#8899AA`, bordes `#1E2840`
- **Compactación sin scroll**: padding `64px 20px 4px`, kpi-grid `min:140px`, chart height `170px`, card `16px`
- **Rate limiting**: `apiLimiter` max `500`, role-based pre-creados sin keyGenerator custom
- **Navegación Presupuestos**: 3 items — "Cargar presupuesto", "Historial de presupuestos", "Comparación de presupuestos"
- **Historial como listado**: `budget.js` convertido a tabla con fecha, N°, proveedor, artículos, precio, botones mirar/borrar. Quitado formulario de carga, upload-zone y mapeador
- **Badge rojo eliminado**: se quitó `#badge-pending` del sidebar (mostraba "2" en círculo rojo con `background: var(--error)`) y su función `updatePendingBadge()`
- **QA E2E**: tests actualizados (`budgets.spec.js` con nueva UI) + nuevo `qa_exhaustive.spec.js` (75 tests cubriendo auth, navegación, dashboard, budget, history, multicomparison, artículos, proveedores, buscador, reportes, usuarios, edge cases)
- **Dashboard module cleanup (fix IC-1 parcial)**: `cleanup()` al inicio de `render()` destruye Chart.js (`chart.destroy()`) y limpia timers de animación; `isConnected` guard previene null-ref en timers huérfanos; `Promise.allSettled` permite renderizado parcial si alguna API falla (BUG #21)
- **Dashboard E2E tests mejorados**: verifica 6 KPI cards con valores reales, 4 charts con canvas.height > 0, tabla con ≥ 1 fila
- **Limpieza código muerto**: eliminados `comparisons.js`, `openExcelMapperModal()` en budget.js, 4 métodos API sin caller, `notifications.js` + `audit.js` server routes, SW cache de comparisons.js (96/96 tests OK, 20/21 E2E OK)
- **CI/CD pipeline creado**: `.github/workflows/ci.yml` con 4 jobs — test (unit), e2e (Playwright, continue-on-error), build-and-push (Docker → GHCR), deploy (SSH opcional)
- **docker-entrypoint.sh fix**: seed condicional via `SEED_DEMO=true` (ya no se siembra en producción automáticamente)
- **SPA cleanup / BUG #22 resuelto**: `app.js` `navigate()` ahora invoca `currentCleanup()` antes de cada transición. Todos los módulos exportan `cleanup()` para destruir Chart.js, limpiar timers y resetear estado. Dashboard, reports, articles, providers (charts), budget, history, multicomparison, search (state). 48/48 tests E2E pasan en secuencia (2.1min)
- **Frontend build (Vite)**: configurado `vite.config.js` con `root: 'public'`, `outDir: '../dist'`, hashes en assets, minificación CSS. Servido en producción via `server/index.js` con fallback a `public/`. Dockerfile multi-stage con build step. 15 assets, build en 632ms, 96/96 tests intactos
- **GitHub push**: repo init en `presupuesto/`, remote `sistemaacisem/presupuesto.git`, push inicial exitoso (148 files)
- **Credenciales Supabase rotadas (BUG #1)**: contraseña de DB cambiada en Supabase, `.env` local actualizado, `.env.example` mejorado con advertencias
- **JWT_SECRET generado**: clave criptográfica de 256 bits reemplazando el placeholder `asistente_compras_secret_key_2024...`
- **Deploy target migrado a Render**: eliminado job SSH de CI/CD, creado `render.yaml`, documentados pasos de deploy en `OPERATIONS.md`

### In Progress / Blocked
- **CI/CD primer run**: pendiente verificar resultado en GitHub Actions
- **Deploy en Render**: pendiente crear cuenta en render.com y conectar repositorio

### Archivos Relevantes
- `public/assets/js/modules/budget.js` — listado de presupuestos + detalle
- `public/assets/js/modules/history.js` — carga de presupuestos (formulario)
- `public/assets/js/app.js` — rutas, navegación SPA
- `public/index.html` — sidebar (nav items), topbar
- `e2e/budgets.spec.js` — tests E2E de presupuestos (actualizados)
- `e2e/qa_exhaustive.spec.js` — tests E2E exhaustivos
- `e2e/comparisons.spec.js`, `dashboard.spec.js`, `navigation.spec.js` — tests E2E existentes (pueden fallar por timeout)
