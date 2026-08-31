# Simplificación del apartado Motos

Documento de referencia: qué cambió en la UI y en el agente, sin tocar el esquema de base de datos.

## Objetivo

Reducir entradas duplicadas, nombres confusos y doble navegación (sidebar + subnav), manteniendo las mismas tablas y server actions.

## Antes → después (menú lateral)

| Antes (6 hijos) | Después (4 hijos) | Tabla / dato principal |
| --- | --- | --- |
| Modelos | Tab **Modelos** dentro de Garaje | `bike_table` |
| Garaje | **Garaje** | `garaje_motos`, `garaje_parqueaderos` |
| Contado | **Venta de contado** | `ventas_moto` |
| Vendidas | Vista **Vendidas** en Garaje (`?vista=vendidas`) | `garaje_motos` con `estado = vendida` |
| En calle | **Con clientes** | `user_moto_compra` entregada/saldada |
| Tarjetas | **Licencias** | `tarjetas_propiedad` |

El grupo **Motos** ya no es un enlace duplicado a Garaje: es solo etiqueta de sección (como en el menú móvil).

## Rutas

| Ruta | Qué hace ahora |
| --- | --- |
| `/garaje` | Hub principal: tabs Motos, Modelos, Parqueaderos |
| `/garaje?tab=modelos` | Catálogo de modelos (antes `/catalogo`) |
| `/garaje?vista=vendidas` | Vendidas del patio (antes `/motos-vendidas`) |
| `/garaje/nueva` | Registrar unidad física (sin cambio) |
| `/venta-contado` | Venta de contado en mostrador |
| `/vendidas` | Motos de crédito con el cliente |
| `/tarjetas-propiedad` | Licencias de tránsito (UI: título Licencias) |
| `/catalogo` | Redirige a `/garaje?tab=modelos` (página + `proxy.ts`) |
| `/motos-vendidas` | Redirige a `/garaje?vista=vendidas` (página + `proxy.ts`) |

## Garaje: vistas dentro de tab Motos

- **En patio**: unidades activas en inventario (oculta `estado = vendida`).
- **Vendidas**: tabla de unidades vendidas desde el garaje (cliente, placa, fecha).
- **Todas**: inventario completo sin ocultar vendidas.

Chips de vista sincronizados con la URL (`vista=patio|vendidas|todas`).

## Navegación secundaria (subnav)

- Solo visible en pantallas pequeñas (`lg:hidden`); en desktop basta el sidebar.
- Usa el mismo filtro de permisos que el sidebar (admin con scope no ve **Con clientes**).

## Agente IA (`/agente`)

- Botón rápido **Motos** con panel embebido (`AgentMotosWork`): 4 trabajos con enlace directo y preset para preguntar al agente.
- Tool nueva: `list_garaje_vendidas` → `getGarajeMotosVendidas()`.
- Descripciones corregidas:
  - `list_motos_credito_liquidado` → Historial Tienda (crédito saldado), no Garaje vendidas.
  - `list_vendidas` → Con clientes.
  - `list_tarjetas_propiedad` → Licencias.

## Asistente flotante Motos

Botón fijo (FAB) en la esquina inferior derecha **solo en rutas Motos**. Abre un sheet con el mismo chat y endpoint que `/agente`, pero con `scope: "motos"`.

| Visible en | No visible en |
| --- | --- |
| `/garaje`, `/garaje/nueva`, `/venta-contado`, `/vendidas`, `/tarjetas-propiedad` | `/agente`, `/inbox`, Tienda, Clientes, Equipo |

- Admin con scope (Olga): sin card **Con clientes** en el embed; no hay FAB en `/vendidas` (ruta fuera de su menú).
- API: `POST /api/agent/chat` con `{ messages, scope: "motos", pageContext: { pathname, search } }`.
- System prompt: [`src/lib/agent/chat-system.ts`](../src/lib/agent/chat-system.ts) → `buildMotosSystem` (prioridad tools Motos + catálogo completo).
- UI: [`motos-agent-fab.tsx`](../src/components/agente/motos-agent-fab.tsx) montado en layout admin.
- Hints del menú: cada hijo Motos tiene `hint` (tooltip desktop, subtítulo móvil).

### Tools prioritarias del FAB

| Pantalla | Tools |
| --- | --- |
| Garaje patio | `list_garaje_motos`, `save_garaje_moto`, … |
| Garaje vendidas | `list_garaje_vendidas` |
| Modelos | `list_bikes`, `save_bike`, `delete_bike` |
| Contado | `list_ventas_contado`, `save_venta_moto`, … |
| Con clientes | `list_vendidas`, `update_vendida_estado_fisico` |
| Licencias | `list_tarjetas_propiedad`, `create_tarjeta_propiedad` |

## Archivos tocados (referencia)

- `src/components/layout/admin-nav-links.ts` — menú 4 ítems
- `src/components/layout/admin-sidebar.tsx` — grupo Motos no clicable
- `src/components/layout/admin-hub-subnav.tsx` — `lg:hidden`, scope Olga
- `src/components/layout/admin-scoped-hub-subnav.tsx` — wrapper server
- `src/app/(admin)/garaje/page.tsx` — hub con tabs y vistas
- `src/components/garaje/garaje-manager.tsx` — Modelos, vistas, vendidas
- `src/app/(admin)/catalogo/page.tsx` — redirect
- `src/app/(admin)/motos-vendidas/page.tsx` — redirect
- Páginas `venta-contado`, `vendidas`, `tarjetas-propiedad` — copy y subnav
- `src/components/agente/agent-motos-work.tsx` — embed chat
- `src/components/agente/agent-chat.tsx` — botón Motos + `mode=motos`
- `src/components/agente/motos-agent-fab.tsx` — FAB + sheet
- `src/lib/agent/chat-system.ts` — system prompts full / motos
- `src/app/api/agent/chat/route.ts` — `scope` + `pageContext`
- `src/lib/garaje/garaje-url.ts` — parse de `tab` y `vista` en URL
- `src/proxy.ts` — redirects de rutas legacy
- `AGENT_CONTEXT.md`, `integrations/hermes/HERMES_DGX.md` — docs agente

## Lo que no cambió

- Tablas Supabase, triggers, RLS y server actions de negocio.
- Flujos de crédito, caja, mora y recogida.
- `/licencias` (consulta pública de licencias).

## Crédito saldado vs vendidas del patio

| Concepto | Dónde verlo | Tool agente |
| --- | --- | --- |
| Vendidas **desde el garaje** (unidad física vendida) | `/garaje?vista=vendidas` | `list_garaje_vendidas` |
| Crédito **saldado** (historial) | Tienda → Historial | `list_motos_credito_liquidado` |
| Moto **con el cliente** (crédito entregado) | `/vendidas` Con clientes | `list_vendidas` |
