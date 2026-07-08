# Estado del Proyecto

**Última actualización:** 2026-07-08

---

## 🎯 Resumen

Sistema de gestión de presupuestos educativos A.C.I.S.E.M. App Node.js/Express con frontend SPA, SQLite (dev) / PostgreSQL (prod), diseño Bloomberg dark, tests unitarios (96/96) + E2E Playwright.

---

## ✅ Completado

### Diseño Bloomberg/Financial (Opción C)
- Paleta oscura completa: `--bg-body: #070B14`, sidebar `#080C18`, active state verde `#22C55E`
- Compactación sin scroll vertical en 768px de altura
- Sidebar con iconos SVG, transiciones suaves, collapsed state
- Login rediseñado con gradiente animado, glassmorphism, demo chips

### Navegación Presupuestos
- 3 items: **Cargar presupuesto** (`#/history`), **Historial de presupuestos** (`#/budget`), **Comparación de presupuestos** (`#/multicomparison`)
- Eliminado "Comparaciones" (`#/comparisons`) del nav
- Badge rojo `#badge-pending` eliminado del sidebar

### Historial de Presupuestos (`budget.js`)
- Tabla con fecha, N°, proveedor, artículos, precio, botones mirar/borrar
- Filtro por tipo (nuevo/historial) y búsqueda por proveedor/N°
- Detalle de presupuesto con tabla de artículos y total
- Eliminado formulario de carga, upload-zone, mapeador interactivo

### Rate Limiting
- `apiLimiter` global: max 500 requests / 15 min
- Limitadores pre-creados por rol (admin/compras/readonly)
- Sin `keyGenerator` custom para evitar error `ERR_ERL_KEY_GEN_IPV6`

### Tests
- **Unitarios**: 96/96 pasando (8 suites, 19 archivos)
- **E2E**: 75 tests en 7 spec files (auth, alerts, budgets, comparisons, dashboard, navigation, qa_exhaustive)
- Tests de presupuestos actualizados con nueva UI
- **Fixes aplicados**: `reuseExistingServer: false`, rate limit 500 en test, selectores E2E corregidos, lógica de tests corregida
- **Pendiente**: degradación acumulativa ~60 tests (SPA necesita cleanup de listeners/DOM/Chart.js)

### Seguridad y Operaciones
- CSP con nonce en scripts inline
- Rate limiting por ruta (login: 10/15min)
- JWT seguro (sin query params)
- Logger estructurado (pino)
- Health check + readiness probe
- Graceful shutdown
- Docker + docker-compose + Caddy SSL
- Backup diario automático (7d retención)
- CI/CD (GitHub Actions → GHCR)
- Sentry opcional

---

## 🚧 Issues Conocidos

| # | Problema | Severidad | Estado |
|---|---|---|---|---|
| 1 | Degradación acumulativa E2E tras ~60 tests | Media | Sin resolver (requiere SPA cleanup) |
| 2 | PDF parser (CORREGIDO) | Media | Reemplazado pdf-parse por pdfjs-dist |
| 3 | Dashboard E2E charts (CORREGIDO) | Baja | Selector corregido |
| 4 | API alerts inconsistente (`{alerts:[]}` vs array directo) | Media | Sin resolver |
| 5 | ~~Credenciales Supabase expuestas~~ (CORREGIDO) | Alta | Contraseña rotada, `.env.example` actualizado |
| 6 | ~~Sin servidor para deploy~~ (CORREGIDO) | Alta | Migrado a Render (gratis, sin tarjeta) |

### Detalle: Degradación acumulativa E2E

**Síntoma:** tests que navegan con hash SPA pasan individualmente (2-3s) pero después de ~60 tests secuenciales algunos timed out (~12s).  
**Causa probable:** acumulación de event listeners, DOM huérfano, instancias de Chart.js en SPA que no se limpian entre navegaciones.  
**Fixes aplicados:** `reuseExistingServer: false`, rate limit 500 en test, selectores corregidos. Ahora 60/75 tests pasan consistentemente.  
**Próximo paso:** refactor de `navigate()` en `app.js` para destruir instancias previas (Chart.js, event listeners, etc.).

---

## 📋 Próximos Pasos (6 prioridades)

### 1. 🔧 Arreglar Degradación Acumulativa SPA (TESTS E2E)
- **Qué:** Tests que usan SPA pasan individualmente pero fallan en secuencia tras ~60 tests
- **Por qué:** El SPA no limpia event listeners, DOM, Chart.js entre navegaciones
- **Cómo:**
  - Refactor `navigate()` en `app.js` para destruir instancias previas (Chart.js destroy, remover listeners)
  - Agregar cleanup hook en cada módulo (`destroy()` function)
  - Verificar que `container.innerHTML = ''` libere correctamente la memoria
- **Archivos:** `public/assets/js/app.js`, todos los módulos en `public/assets/js/modules/`

### 2. 🧪 Cobertura E2E Total (60→75)
- **Qué:** Lograr que los 75 tests pasen consistentemente
- **Por qué:** Sin E2E verdes no hay despliegue seguro
- **Cómo:** Después de arreglar la degradación acumulativa, ejecutar `npm run test:e2e` y verificar
- **Nota:** 60/75 tests ya pasan; los 15 restantes timed out por degradación acumulativa
- **Archivos:** `e2e/qa_exhaustive.spec.js`, `public/assets/js/app.js`

### 3. 📊 Dashboard — Carga de Datos Reales
- **Qué:** Verificar que KPIs, gráficos y tabla de recientes carguen datos reales desde la API
- **Por qué:** Dashboard es la pantalla principal, debe funcionar sin errores
- **Cómo:**
  - Revisar `dashboard.js` para ver si hay errores ocultos en la carga de datos
  - Probar manualmente con datos demo
  - E2E test dedicado que verifique valores > 0 en KPIs
- **Archivos:** `public/assets/js/modules/dashboard.js`

### 4. 🐛 API alerts inconsistente
- **Qué:** `GET /api/alerts` devuelve `{alerts:[]}` pero frontend espera array directo
- **Por qué:** Inconsistencia en contrato API-frontend
- **Cómo:** Unificar a un solo formato (BUG #10 en BUGS.md)
- **Archivos:** `server/routes/alerts.js`

### 5. 🧹 Limpieza de Código Muerto
- **Qué:** Eliminar funciones, módulos y rutas que ya no se usan
- **Por qué:** Reduce deuda técnica y confusión
- **Cómo:**
  - `comparisons.js` — módulo entero (ruta `#/comparisons` eliminada del nav)
  - `openExcelMapperModal()` en `budget.js` — solo usado por upload flow eliminado
  - Rutas de server que ya no tienen frontend
  - CSS no utilizado
- **Archivos:** `public/assets/js/modules/comparisons.js`, `budget.js`, `server/routes/`

### 6. 🚀 Deploy en Render
- **Qué:** Poner la app en producción usando Render (gratis)
- **Cómo:**
  1. Crear cuenta en render.com
  2. Conectar repo de GitHub
  3. Configurar web service con Dockerfile
  4. Agregar variables de entorno (DATABASE_URL, JWT_SECRET, etc.)
  5. Crear monitor en UptimeRobot para evitar sleep
- **Documentación:** `OPERATIONS.md` — sección "Deploy en Render"
- **Archivo:** `render.yaml` (blueprint para Render)

---

## 🧪 Tests

```bash
# Tests unitarios (96 tests, 8 suites)
npm test

# Tests E2E (75 tests, 7 spec files)
npm run test:e2e

# Tests específicos
npx playwright test e2e/budgets.spec.js --reporter=list
npx playwright test e2e/qa_exhaustive.spec.js --reporter=list
```

---

## 📁 Arquitectura de Archivos

| Ruta | Propósito |
|---|---|
| `server/` | Backend Express (rutas, servicios, middleware) |
| `public/` | Frontend SPA (HTML, CSS, JS modules) |
| `e2e/` | Tests E2E Playwright |
| `data/` | Base de datos SQLite (dev) |
| `scripts/` | Utilidades (backup, migración) |
| `.github/` | CI/CD workflows |
| `.opencode/` | Agentes AI personalizados |

### Frontend — Módulos Principales

| Módulo | Ruta | Descripción |
|---|---|---|
| `app.js` | `public/assets/js/app.js` | Router SPA, navegación, topbar |
| `dashboard.js` | `public/assets/js/modules/dashboard.js` | KPIs, gráficos, tabla reciente |
| `budget.js` | `public/assets/js/modules/budget.js` | Historial de presupuestos + detalle |
| `history.js` | `public/assets/js/modules/history.js` | Carga de presupuestos (formulario + tabla) |
| `multicomparison.js` | `public/assets/js/modules/multicomparison.js` | Comparación múltiple de presupuestos |
| `search.js` | `public/assets/js/modules/search.js` | Buscador global |
| `articles.js` | `public/assets/js/modules/articles.js` | CRUD de artículos |
| `providers.js` | `public/assets/js/modules/providers.js` | CRUD de proveedores |
| `reports.js` | `public/assets/js/modules/reports.js` | Reportes y exportación |

---

## 🤖 Agentes AI

| Agente | Invocación | Propósito |
|---|---|---|
| UX Designer | `@ux-designer` | Evalúa UX/IX: consistencia, accesibilidad, responsive, usabilidad |
| UI Reviewer | `@ui-reviewer` | Revisa UI existente: layout, componentes, estados, micro-interacciones |

---

## 📚 Documentación Relacionada

- `AGENTS.md` — Instrucciones para agentes AI, progreso detallado
- `BUGS.md` — Registro detallado de bugs y soluciones
- `OPERATIONS.md` — Runbook de operaciones (deploy, backup, monitoreo)
- `playwright.config.js` — Configuración de tests E2E
