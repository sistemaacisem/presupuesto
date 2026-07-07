# Registro de Bugs y Soluciones

---

## 2026-07-02 — Auditoría inicial

| # | Bug / Hallazgo | Severidad | Causa | Solución |
|---|---|---|---|---|
| 1 | `.env` con credenciales reales de Supabase incluido en el proyecto | Alta | Se commiteó `.env` sin `.gitignore` | Creado `.gitignore` con `.env` incluido. Rotar credenciales pendiente |
| 2 | `ssl: rejectUnauthorized: false` en conexión PostgreSQL | Media | Configuración relajada para desarrollo | Cambiado a `NODE_ENV === 'production'` en `supabase.js:24` |
| 3 | Token JWT aceptado por query param (`auth.js:24`) | Media | Facilita debugging pero expone token en logs | Eliminado el bloque que aceptaba token por query param |
| 4 | `errorHandler.js` nunca se importa en `index.js` | Baja | Se creó el middleware pero no se integró | Integrado en `index.js` y mejorado con soporte de stack trace en dev |
| 5 | Service Worker precachea archivos inexistentes (`sw.js`) | Media | Rutas incorrectas (`styles.css`, `lib/`, `alerts.js`) | Reemplazadas por las rutas reales (`main.css`, `layout.css`, `components.css`, `animations.css`) y eliminadas las que no existen |
| 6 | Sin rate limiting en API | Media | No hay protección contra abuso | Instalado `express-rate-limit` y configurado 100 req/15min en `/api/` |
| 7 | Sin tests end-to-end | Media | No había cobertura E2E automatizada | Instalado Playwright, creados tests de auth, dashboard y navegación en `e2e/` |
| 8 | Pantalla de login con diseño básico y problemas de UX | Media | Diseño funcional pero sin identidad visual, accesibilidad limitada | Rediseño completo: icono, glassmorphism, gradiente animado, toggle password, forgot password, remember me, demo chips accesibles, responsive |

## 2026-07-06 — Fase 1

| # | Bug / Hallazgo | Severidad | Causa | Solución |
|---|---|---|---|---|
| 9 | Test `auth.test.js:77` esperaba token por query param (funcionalidad eliminada por seguridad) | Baja | Test no actualizado tras eliminar feature | Cambiado a esperar `401` en lugar de éxito |
| 10 | API `GET /api/alerts` devuelve `{ alerts: [] }` pero frontend espera array directamente | Media | Inconsistencia en contrato API-resto frontend | Pendiente — `getAlerts()` retorna `data` completo, el modal espera `alerts.length` |
| 11 | Meta.number regex sin ancla `^` matchea 'n' en cualquier palabra (MEMBRANA, BLANCO, PINTURAS, NUESTRO), saltando líneas de ítems | Alta | Regex sin ancla para número de presupuesto | Anclado con `^` + requerir dígito en el match + excluir "nuestro" y "nombre" |
| 12 | P3 regex (`desc price price`) matchea IVA/discount como precios (`258721.00 0.00`) | Alta | Patrón muy permisivo sin validación de consistencia | Validación post-parse: `tp > 0` y `up*qty ≈ tp` dentro de 5% |
| 13 | Skip pattern no cubría "Nombre:", "FECHA:", "Bonif", "Contado", "Exento" | Baja | Faltaban palabras comunes en encabezados de PDF | Agregadas al skipPattern |
| 14 | Rate limiting excesivo: `max:200/15min` bloqueaba al ver artículos | Alta | apiLimiter global (max 200) se alcanzaba navegando normalmente; roleAwareRateLimit creaba instancia por request (nunca funcionaba) | apiLimiter subido a max 500; roleAwareRateLimit refactorizado a limitadores pre-creados por rol |
| 15 | Badge rojo `#badge-pending` mostraba "2" en círculo rojo al lado de "Historial de presupuestos" | Baja | `nav-item-badge` con `background: var(--error)` y `updatePendingBadge()` mostraba presupuestos pendientes | Eliminado el badge del HTML y la función `updatePendingBadge()` de `app.js` |
| 16 | Tests E2E de SPA fallan por timeout (dashboard, history, budget detail) | Media | `reuseExistingServer: true` en Playwright causa que el servidor quede corriendo entre sesiones con DB inconsistente | Cambiado `reuseExistingServer: true → false` en `playwright.config.js:20` para que siempre se refresque la DB |
| 17 | Login rate limiter bloquea tests E2E después de ~10 logins | Media | `max: 10` en loginLimiter para producción; tests con 75+ tests y retries exceden el límite | Agregado `NODE_ENV === 'test'` al condicional para usar `max: 500` en tests |
| 18 | Selectores incorrectos en tests E2E (qa_exhaustive.spec.js) | Baja | Tests escritos con IDs que no coinciden con los módulos reales (`#articles-search` vs `#art-search`, `#charts-section` vs `#chart-category`, etc.) | Corregidos todos los selectores para coincidir con los módulos |
| 19 | Test `Botón Comparar` esperaba `toBeEnabled()` pero el botón inicia deshabilitado | Baja | El botón `#btn-mc-compare` tiene atributo `disabled` por defecto hasta seleccionar 2+ items | Cambiado a `toBeDisabled()` |
| 20 | Test `Botón Eliminar seleccionados` fallaba porque botón oculto por defecto | Baja | `#hist-bulk-delete` está dentro de un div con `display:none`, solo visible al checkear items | Agregado check de checkbox antes de verificar visibilidad del botón |

| 21 | Dashboard module: Chart.js sin destroy, timers sin cleanup, Promise.all frágil | Alta | `new Chart()` en cada render sin `chart.destroy()` ni tracking; `setInterval` en `animateKPIValue` sin cleanup ni guard `isConnected`; `Promise.all` de 5 APIs fallaba todo si una fallaba | Agregado `cleanup()` que destruye charts y limpia timers al inicio de `render()`; tracking en `chartInstances[]` y `animTimers[]`; `isConnected` guard en timer; reemplazado `Promise.all` por `Promise.allSettled` con renderizado parcial |
| 22 | Degradación acumulativa E2E: test 21 "Botón Mirar" timeout 12s | Media | Tras ~20 tests consecutivos, módulo budget detail tarda en cargar (timeout 8s para h1). Causa: `navigate()` en `app.js` nunca llamaba `cleanup()` del módulo anterior, acumulando Chart.js, timers y estado sin destruir | Agregado tracking de `currentCleanup` en `app.js` que se invoca antes de cada navegación. Exportada función `cleanup()` en todos los módulos: dashboard (charts+timers), budget (state), history (page reset), multicomparison (selección), search (fuse+timeout), articles (chart), providers (chart), reports (charts). 48/48 E2E pass ✓ |

## Issues Conocidos sin Resolver

| # | Bug | Severidad | Detalle |
|---|---|---|---|
| IC-1 | Tests E2E con SPA timed out (CORREGIDO) | Media | `reuseExistingServer: false` + `NODE_ENV=test` rate limit fix + SPA cleanup (BUG #22) resuelven todos los timeouts de SPA. 48/48 tests E2E pasan en secuencia completa (2.1min) |
| ~~IC-2~~ | ~~PDF `ejemplo_utiles.pdf` da `bad XRef Entry`~~ | Media | **CORREGIDO 2026-07-07**: reemplazado `pdf-parse@1.1.4` por `pdfjs-dist@4.9.155`. La extracción de texto ahora usa `getTextContent()` con detección de saltos de línea por posición Y. Además se corrigió el regex de número de presupuesto para soportar formato "Nro:" |
| IC-4 | Ratio de compresión artefactual inconsistente | Media | `predictionSvc.calculateCompressionRatio` puede dar valores inexactos según el artículo. Causa: varianza en precios históricos |
