# Seven Days Gold — Portal de Facturación

Portal de autoservicio para emisión de facturas electrónicas (CFDI 4.0) para la cadena de gimnasios Seven Days Gold (Morelia, México). Los socios ingresan su número de ticket, completan sus datos fiscales y obtienen su CFDI timbrado con descarga de PDF y XML.

## Contexto de negocio

- **Seven Days Gold** tiene 20 sucursales, 14 comparten una sola cuenta de API con EVO (sistema de gestión del gimnasio).
- **EVO API Plus** tiene un límite de 100 requests/día compartidos entre las 14 sucursales. Por eso las ventas se sincronizan a una base local durante la madrugada (ventana libre 0-5 AM hora Brasil) y el portal lee de la base local sin consumir créditos.
- **Implicación**: las facturas se pueden emitir a partir del día siguiente a la compra.
- El PAC (Proveedor Autorizado de Certificación) es **SW sapien**, que timbra los CFDI contra el SAT.
- Los precios de EVO **ya incluyen IVA 16%**. El backend extrae el subtotal sin IVA al construir el CFDI.
- **Datos fiscales del emisor**: RFC `SDA1012207SA`, Régimen 601 (General de Ley), CP 58260.

## Stack

| Componente | Tecnología |
|-----------|-----------|
| API | Cloudflare Workers + Hono.js + TypeScript |
| Base de datos | Cloudflare D1 (SQLite edge) |
| ORM | Drizzle |
| Frontend | SvelteKit + Tailwind CSS v4 + adapter-cloudflare |
| Hosting frontend | Cloudflare Pages |
| PAC (timbrado CFDI) | SW sapien (`services.test.sw.com.mx` / `api.test.sw.com.mx`) |
| Gestión gimnasio | EVO API (`evo-integracao.w12app.com.br`) |
| Validación | Zod (server-side) |

## Arquitectura

```
┌──────────┐    sync nocturno    ┌────────────┐    timbrado    ┌───────────┐
│  EVO API │ ──────────────────► │  D1 (sales)│                │ SW sapien │
└──────────┘   cron 03:00 BRT    └─────┬──────┘                └─────┬─────┘
                                       │                             │
                                       ▼                             │
┌──────────┐    busca ticket     ┌────────────┐    emite CFDI        │
│ Usuario  │ ──────────────────► │   API      │ ◄───────────────────►┘
└──────────┘                     │  (Workers) │
                                 └────────────┘
```

### Flujo del usuario

1. Ingresa número de ticket → API busca en D1 (fallback a EVO si no existe)
2. Llena datos fiscales: RFC, nombre, régimen fiscal, CP, uso CFDI, forma de pago
3. API construye JSON CFDI 4.0, lo envía a SW sapien para timbrado
4. SW sella, certifica y timbra → regresa UUID, XML firmado, QR
5. Se guarda XML y metadata en D1 → usuario descarga PDF y XML

## Sync EVO → D1

Las ventas de EVO se sincronizan automáticamente a D1 mediante un Cloudflare Cron Trigger.

| Cron | UTC | BRT | Morelia | Propósito |
|------|-----|-----|---------|-----------|
| `0 6 * * *` | 06:00 | 03:00 | 00:00 | Sync principal (ventana libre EVO) |
| `0 10 * * *` | 10:00 | 07:00 | 04:00 | Sync comparativo (fuera de ventana) |

**Proceso** (`api/src/cron/evo-sync.ts`):
1. Pagina todas las ventas: `GET /api/v1/sales?take=50&skip=N`
2. Por cada venta, obtiene datos del miembro: `GET /api/v1/members?idMember=X&take=1`
3. Upsert en tabla `sales` (idSale como PK)
4. Registra resultado en tabla `sync_log` con: ventas obtenidas, insertadas, actualizadas, rate limit, duración, errores, veredicto

**Auditoría**: `GET /api/sync/status` → últimas 10 ejecuciones.

## Base de datos D1

ID: `4ca00991-039f-4a16-96a8-b68b45f173d9`  
Schema en `api/src/db/schema.ts`, migraciones en `api/drizzle/`.

### `sales` — Ventas sincronizadas de EVO
```
id_sale (PK, from EVO) | id_member | id_branch | sale_date | customer_name
customer_rfc | customer_email | items_json (JSON array) | total | synced_at
```
`items_json` contiene: `[{description, quantity, unitPrice, salePrice, discount}]`

### `invoices` — Facturas emitidas
```
id (PK auto) | uuid (UNIQUE) | evo_sale_id (UNIQUE) | evo_member_id
customer_name | customer_rfc | customer_email | total | status
cfdi_xml (XML timbrado completo) | fecha_timbrado | created_at
```

### `sync_log` — Historial de sincronizaciones
```
id | run_at | brt_hour | inside_window | sales_fetched | sales_inserted
sales_updated | pages_requested | rate_limited | duration_ms | errors | verdict
```
`verdict`: `SUCCESS` | `PARTIAL` | `RATE_LIMITED` | `FAILED`

## Endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/tickets/:id` | Buscar venta (D1 primero, EVO fallback) |
| `POST` | `/api/invoices` | Emitir factura CFDI 4.0 |
| `GET` | `/api/invoices/:uuid/pdf` | Descargar PDF (genera vía SW desde XML) |
| `GET` | `/api/invoices/:uuid/xml` | Descargar XML timbrado |
| `GET` | `/api/invoices/by-sale/:id` | Consultar si un ticket ya fue facturado |
| `GET` | `/api/sync/status` | Últimas 10 ejecuciones del sync |
| `GET` | `/health` | Health check |

### POST `/api/invoices` — Body

```json
{
  "idSale": 847,
  "customer": {
    "legal_name": "NOMBRE COMO EN CONSTANCIA SAT",
    "tax_id": "RFC12CHARS00",
    "tax_system": "612",
    "zip": "58260",
    "email": "opcional@correo.com"
  },
  "use": "G03",
  "payment_form": "01"
}
```

## Estructura del proyecto

```
api/
  src/
    cron/evo-sync.ts          — Sync nocturno EVO → D1
    db/schema.ts              — Schema Drizzle (sales, invoices, sync_log)
    features/
      tickets/                — Búsqueda de tickets (D1 + EVO fallback)
      invoices/               — Emisión, descarga PDF/XML, validación
    lib/
      evo.ts                  — Cliente EVO API (Basic Auth)
      sw.ts                   — Cliente SW sapien (auth, timbrado, PDF, cancel)
      env.ts                  — Tipos de environment bindings
    index.ts                  — Hono app + scheduled handler
  drizzle/                    — Migraciones SQL
  wrangler.toml               — Config Workers + D1 + crons
web/
  src/
    lib/
      api.ts                  — Cliente API tipado
      catalogs.ts             — Catálogos SAT (régimen, uso CFDI, forma pago)
      components/Modal.svelte — Modal reutilizable (éxito/error/warning)
    routes/
      +page.svelte            — Búsqueda de ticket
      facturar/+page.svelte   — Formulario datos fiscales
      factura/+page.svelte    — Página de éxito + descarga PDF/XML
    app.css                   — Theme Tailwind (dark, lime accent)
```

## Desarrollo

```bash
# API
cd api && npm install && npx wrangler dev --test-scheduled

# Frontend
cd web && npm install && npm run dev
```

## Deploy

```bash
# API (Workers)
cd api && npx wrangler deploy

# Migraciones D1
cd api && npx wrangler d1 migrations apply seven-days-db --remote

# Frontend (Pages)
cd web && npm run build && npx wrangler pages deploy .svelte-kit/cloudflare --project-name=seven-days-facturacion
```

## Variables de entorno

**`wrangler.toml` (vars públicas):**
- `EVO_API_URL`, `SW_API_URL`, `SW_DATA_URL`, `ALLOWED_ORIGIN`

**Secrets (via `wrangler secret put`):**
- `EVO_API_USER` — Usuario EVO
- `EVO_API_KEY` — API key EVO
- `SW_USER` — Email cuenta SW sapien
- `SW_PASSWORD` — Contraseña SW sapien

## URLs en producción

- **Portal**: https://seven-days-facturacion.pages.dev
- **API**: https://seven-days-api.clvrt.workers.dev

## Notas importantes

- SW está en **ambiente de pruebas** (`*.test.sw.com.mx`). Para producción cambiar a `services.sw.com.mx` / `api.sw.com.mx`.
- Los precios de EVO **incluyen IVA**. El CFDI desglosa: `subtotal = precio / 1.16`, `IVA = subtotal * 0.16`.
- La fecha del CFDI se genera en hora México Central (UTC-6) manualmente, no UTC.
- Constraint UNIQUE en `evo_sale_id` previene facturas duplicadas para la misma venta.
