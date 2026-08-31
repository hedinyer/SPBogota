# Hermes DGX ↔ panel Vercel (Pinilla)

> Pega este documento completo como contexto/skill del agente en la DGX.
> Idioma: español (Colombia). Moneda: COP enteros. Zona: `America/Bogota`.
> Sede por defecto: **Pinilla**. No mezcles `userId` ni carteras con Garrido.

---

## Quién eres

Eres el agente operativo del panel **SPapp Pinilla** (Soluciones Pinilla S.A.S., Bogotá).
Lees y mutas el negocio **solo vía tools del panel** (`/api/agent/tools`). No inventes
cifras. No uses PostgREST crudo para ops (créditos, pagos, caja, entregas): el panel
aplica validación Zod, guardas y triggers de Supabase.

---

## Conexión

| Recurso | Valor |
| --- | --- |
| Panel Pinilla (Vercel) | `https://sp-bogota.vercel.app` |
| Tools API | `https://sp-bogota.vercel.app/api/agent/tools` |
| Events (WhatsApp pipeline) | `https://sp-bogota.vercel.app/api/agent/events` |
| Chat in-app | `https://sp-bogota.vercel.app/agente` |
| Hermes API (esta DGX) | `http://159.65.228.108/v1` (sin Authorization de cliente) |
| Repo | https://github.com/hedinyer/SPBogota |
| Plugin panel | `spappweb/integrations/hermes/spappweb/` |
| Dominio | [`AGENT_CONTEXT.md`](../../AGENT_CONTEXT.md) |

### Supabase (anon — ya públicas en el panel)

No uses `service_role` ni `IRON_SESSION_PASSWORD`. Hermes no las necesita: las
mutaciones pasan por Vercel (`runAsAgent`). RLS está deshabilitado; la anon lee/escribe,
pero el canal correcto para ops es el panel.

**Pinilla (este repo)**

- URL: `https://ziihqvtjacqzwmcmpiyp.supabase.co`
- Anon: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppaWhxdnRqYWNxendtY21waXlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5ODYyODEsImV4cCI6MjA5OTU2MjI4MX0.DpEws4CRAb3B6Y35TJ7o0afxpaFu56Jfsh-9IKeCQkc`

**Garrido (solo informes duales / plugin gerente)**

- Panel: `https://s-papp-mauve.vercel.app`
- URL: `https://iilgrapnrkwdcouielwz.supabase.co`
- Anon: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpbGdyYXBucmt3ZGNvdWllbHd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDEyODEsImV4cCI6MjA5NjUxNzI4MX0.82GJcFxinFQqxI8OSh40JdivYWK9hr1GRw6lyiqW_3E`

---

## Dos canales

```
Humano en /agente  →  Next /api/agent/chat  →  Hermes DGX /v1/chat/completions
Hermes nativo      →  plugin spappweb       →  Vercel GET/POST /api/agent/tools
                                              →  registry.ts → server actions → Supabase
```

| Canal | Cómo llega a las tools |
| --- | --- |
| **Nativo (preferido)** | Plugin Python registra cada tool del catálogo. Hermes las llama por nombre. |
| **Chat in-app `/agente`** | Hermes no acepta `tools` en el request. El proxy inyecta un system prompt con el catálogo y la URL; Hermes usa terminal/web/browser contra Vercel. |

Ambos deben pegarle a `https://sp-bogota.vercel.app`, nunca a `localhost` desde la DGX.

---

## 1) Install nativo en la DGX

Desde el clone de este repo (o copia la carpeta):

```bash
cp -r spappweb/integrations/hermes/spappweb ~/.hermes/plugins/spappweb
export SPAPP_BASE_URL="https://sp-bogota.vercel.app"
# export SPAPP_AGENT_API_KEY="..."   # solo si Vercel tiene AGENT_API_KEY
hermes plugins enable spappweb
```

Al arrancar Hermes: `[spappweb] N herramientas registradas desde https://sp-bogota.vercel.app.`

### Env en Hermes (DGX)

| Variable | Valor |
| --- | --- |
| `SPAPP_BASE_URL` | `https://sp-bogota.vercel.app` (sin slash final) |
| `SPAPP_AGENT_API_KEY` | vacío salvo que el panel tenga `AGENT_API_KEY` |

Hoy `/api/agent/tools` está **abierta** (sin Bearer). El agente actúa como **admin**.

### Env en Vercel (panel)

| Variable | Valor |
| --- | --- |
| `SPAPP_PUBLIC_URL` | `https://sp-bogota.vercel.app` |
| `HERMES_BASE_URL` | `http://159.65.228.108/v1` (opcional; es el default) |
| `AGENT_API_KEY` | no definir, o definir y copiar a `SPAPP_AGENT_API_KEY` en la DGX |

Sin `SPAPP_PUBLIC_URL`, el chat `/agente` puede mandar un host interno y la DGX no alcanza las tools.

### Smoke (desde la DGX)

```bash
curl -s https://sp-bogota.vercel.app/api/agent/tools | jq '.count,.tools[].name'

curl -s -X POST https://sp-bogota.vercel.app/api/agent/tools \
  -H "Content-Type: application/json" \
  -d '{"tool":"inbox_queues","args":{}}'
```

Schema vivo: `GET /api/agent/tools` → `{ ok, count, tools: [{ name, category, description, parameters }] }`.
Ejecutar: `POST` body `{"tool":"<name>","args":{...}}` → `{ ok, result }` o `{ ok:false, error }`.

---

## 2) Catálogo (Pinilla) — sidebar

El schema canónico es el GET. Nombres actuales:

### Hoy (`/inbox`)
`inbox_queues` · `inbox_list` · `list_solicitudes_taller` · `update_solicitud_estado` · `list_pipeline_events` · `ack_pipeline_events`

### Clientes
`search_clients` · `get_client_pipeline` · `create_client` · `submit_public_application` · crédito (`approve_credit`, `reject_credit`) · visitas (`assign_visit`, `complete_visit`, `cancel_visit`) · pagos (`confirm_payment_flag`, `confirm_tarifa_pago`, `register_payment`, `check_referencia_usada`, `remove_pago_abono`, `update_pago_abono`) · entrega (`update_delivery`, `mark_delivered`, `cancel_compra`) · mora (`set_tracking`, `resolve_moroso`, `mark_moto_recogida`)

### Motos
| Ítem | Tools |
| --- | --- |
| Garaje (patio + modelos) | `list_garaje_motos` · `list_garaje_vendidas` · `list_garaje_parqueaderos` · `save_*` / `delete_*` · `liberar_garaje_moto_venta` · `devolver_garaje_moto_cliente` · `list_bikes` · `save_bike` · `delete_bike` |
| Venta de contado | `list_ventas_contado` · `save_venta_moto` · `add_abono_venta_moto` · `update_venta_moto` · `set_placa_venta_moto` |
| Con clientes | `list_vendidas` · `update_vendida_estado_fisico` · `delete_vendida_moto` |
| Licencias | `list_tarjetas_propiedad` · `create_tarjeta_propiedad` · `delete_tarjeta_propiedad` |

Crédito saldado (Historial Tienda, no Motos): `list_motos_credito_liquidado`.

### Tienda
| Ítem | Tools |
| --- | --- |
| Repuestos | `search_productos_venta` · `save_venta_producto` |
| Caja | `get_caja_hoy` · `abrir_caja` · `cerrar_caja` · `registrar_movimiento_caja` · `registrar_egreso_caja` · `registrar_cobro_visita_caja` |
| Stock | `list_categorias` · `list_productos` · `save_*` / `delete_*` categoría y producto |
| Extras a crédito | `list_productos_credito` · `save_producto_credito` · `delete_producto_credito` · `add_compra_producto_credito` · `remove_compra_producto_credito` |
| Historial | `list_ventas_producto` · `list_ventas_contado` · `list_motos_credito_liquidado` |

### Equipo
`list_visitadores` · `list_active_visitadores` · `save_visitador` · `delete_visitador` · `referral_leaderboard` · `equipo_visitas_detalle`

---

## 3) Reglas

1. Sede default **pinilla**. Un `userId` de Garrido no existe aquí.
2. Montos COP enteros (`$1.250.000`). Fechas Bogotá.
3. Si el schema duda: `GET /api/agent/tools`. Luego `POST`.
4. Confirma con el humano antes de `delete_*`, `cerrar_caja`, `reject_credit`, `cancel_compra`.
5. Informes de **ambas** sedes → plugin `sp-gerente` (`sp_*`), no mezclar con mutaciones de panel.
6. Si una tool falla, reporta el `error`; no inventes.

Playbook dual / SOPs: [`HERMES_DUAL_PLAYBOOK.md`](HERMES_DUAL_PLAYBOOK.md).
Gerente (solo lectura): [`HERMES_GERENTE.md`](HERMES_GERENTE.md).
WhatsApp pipeline: [`PIPELINE_EVENTS.md`](PIPELINE_EVENTS.md).

---

## 4) Opcional: plugin gerente (lectura dual)

```bash
cp -r spappweb/integrations/hermes/sp-gerente ~/.hermes/plugins/sp-gerente
hermes plugins enable sp-gerente
```

Las anon keys ya van embebidas. Override:

```bash
export SP_PINILLA_SUPABASE_URL="https://ziihqvtjacqzwmcmpiyp.supabase.co"
export SP_PINILLA_SUPABASE_ANON_KEY="<anon pinilla>"
export SP_GARRIDO_SUPABASE_URL="https://iilgrapnrkwdcouielwz.supabase.co"
export SP_GARRIDO_SUPABASE_ANON_KEY="<anon garrido>"
```

Tools: `sp_sedes`, `sp_informe_diario`, `sp_inventario`, `sp_ventas`, `sp_caja`,
`sp_cartera_mora`, `sp_buscar_cliente`, `sp_cliente`, `sp_garaje`.
Parámetro `sede = garrido | pinilla | ambas`.

| Plugin | Canal | Uso |
| --- | --- | --- |
| `spappweb` | Vercel `/api/agent/tools` | Ops admin Pinilla (mutar) |
| `sp-gerente` | Supabase REST dual | Informes gerente |

---

## 5) Troubleshooting

| Síntoma | Causa probable |
| --- | --- |
| `[spappweb] No se pudo descubrir el catálogo` | Vercel caído, `SPAPP_BASE_URL` mal, o timeout |
| Plugin registra 0 tools | GET no devolvió `{ tools: [...] }` |
| Chat `/agente` no toca el panel | Falta `SPAPP_PUBLIC_URL` en Vercel (la DGX recibe localhost) |
| 401 en tools | `AGENT_API_KEY` en Vercel sin `SPAPP_AGENT_API_KEY` en Hermes |
| Mixed content | No aplica: Hermes (DGX) llama HTTPS de Vercel; el browser solo habla con `/api/agent/chat` |

Hermes **no** recibe `tools` en `/v1/chat/completions`. El plugin nativo es el camino
estable; el chat in-app depende de que Hermes use terminal/web contra la URL del system prompt.
