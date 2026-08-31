import { z } from "zod";

import { hojaVidaFormSchema } from "@/lib/contracts/hoja-vida-schema";
import { MONTO_VISITA_DEFAULT } from "@/lib/payments/visita-monto";
import {
  isMotosTool,
  type AgentToolScope,
} from "@/lib/agent/motos-tools";

/**
 * Cargadores perezosos (dynamic import) de las capas de negocio. Mantienen el
 * módulo del registro y la ruta `/api/agent/tools` libres de dependencias pesadas
 * (Supabase server-only, `sharp`, `tesseract.js`), de modo que el catálogo se
 * pueda generar siempre, incluso en cold-start de Vercel. Cada handler carga su
 * módulo solo cuando se invoca.
 */
const loadQueries = () => import("@/lib/pipeline/queries");
const loadAdminActions = () => import("@/lib/actions/admin-actions");
const loadPaymentActions = () =>
  import("@/lib/actions/payment-comprobante-actions");
const loadClientActions = () => import("@/lib/actions/client-actions");
const loadPipelineEvents = () => import("@/lib/agent/pipeline-events");
const loadVentaMotoActions = () => import("@/lib/actions/venta-moto-actions");
const loadVentaProductoActions = () =>
  import("@/lib/actions/venta-producto-actions");
const loadVentaActions = () => import("@/lib/actions/venta-actions");
const loadHistorialMotosActions = () =>
  import("@/lib/actions/historial-motos-actions");
const loadCajaActions = () => import("@/lib/actions/caja-actions");
const loadTarjetaActions = () =>
  import("@/lib/actions/tarjeta-propiedad-actions");

const INBOX_QUEUE_IDS = [
  "creditos",
  "clientes_guillen",
  "pagos",
  "retiro",
  "entrega",
  "visitas_sin_asignar",
  "visitas_programadas",
  "morosos",
  "recoger",
  "solicitudes_taller",
] as const;

export type AgentToolCategory =
  | "lectura"
  | "notificaciones"
  | "credito"
  | "visitas"
  | "pagos"
  | "entrega"
  | "mora"
  | "clientes"
  | "catalogo"
  | "inventario"
  | "garaje"
  | "taller"
  | "caja"
  | "ventas"
  | "tarjetas"
  | "equipo";

interface ToolDef<S extends z.ZodTypeAny = z.ZodTypeAny> {
  category: AgentToolCategory;
  description: string;
  input: S;
  handler: (args: z.infer<S>) => Promise<unknown>;
}

function tool<S extends z.ZodTypeAny>(def: ToolDef<S>): ToolDef<S> {
  return def;
}

const empty = z.object({});

/**
 * Registro central de herramientas del agente IA.
 *
 * Cada handler delega en las server actions y queries existentes del panel,
 * que son la única fuente de verdad de la lógica de negocio (validación Zod,
 * guardas de estado, triggers de Supabase). Añadir una entrada aquí la expone
 * automáticamente vía `/api/agent/tools` y al plugin de Hermes.
 */
export const AGENT_TOOLS = {
  // ---------------------------------------------------------------- LECTURA
  inbox_queues: tool({
    category: "lectura",
    description:
      "Devuelve las 9 colas accionables de la bandeja con su conteo: créditos pendientes, pagos por confirmar, retiros, entregas, visitas, morosos, motos para recoger y solicitudes de taller.",
    input: empty,
    handler: async () => (await loadQueries()).getInboxQueues(),
  }),
  inbox_list: tool({
    category: "lectura",
    description:
      "Lista los clientes/items pendientes de una cola específica de la bandeja.",
    input: z.object({
      queueId: z.enum(INBOX_QUEUE_IDS).describe("Identificador de la cola"),
    }),
    handler: async ({ queueId }) => (await loadQueries()).getInboxListItems(queueId),
  }),
  search_clients: tool({
    category: "lectura",
    description:
      "Busca clientes por nombre, cédula, placa o usuario (mínimo 2 caracteres). Devuelve resumen con userId, moto, estado de compra y cuotas pagadas.",
    input: z.object({
      query: z.string().min(2, "Mínimo 2 caracteres"),
    }),
    handler: async ({ query }) => (await loadQueries()).searchClients(query),
  }),
  get_client_pipeline: tool({
    category: "lectura",
    description:
      "Vista 360° de un cliente: datos, documento/crédito, contrato, moto comprada, pagos, tarifas, mora, tracking, visita y pasos del pipeline. Úsala antes de cualquier acción sobre el cliente.",
    input: z.object({
      userId: z.number().int().positive(),
    }),
    handler: async ({ userId }) => (await loadQueries()).getClientPipeline(userId),
  }),
  list_pipeline_events: tool({
    category: "notificaciones",
    description:
      "Cola de eventos del pipeline (crédito→moto→contrato→pago→visita→entrega) pendientes de WhatsApp. Cada evento incluye celular, paso, payload y whatsappHint sugerido. Consulta periódicamente y envía mensajes al cliente.",
    input: z.object({
      limit: z.number().int().min(1).max(200).optional(),
      since: z.string().optional().describe("ISO timestamp; solo eventos posteriores"),
      includeAcked: z
        .boolean()
        .optional()
        .describe("Si true, incluye eventos ya procesados"),
    }),
    handler: async ({ limit, since, includeAcked }) =>
      (await loadPipelineEvents()).listPipelineEvents({
        limit,
        since,
        pendingOnly: !includeAcked,
      }),
  }),
  ack_pipeline_events: tool({
    category: "notificaciones",
    description:
      "Marca eventos del pipeline como procesados tras enviar el WhatsApp al cliente.",
    input: z.object({
      eventIds: z.array(z.string().uuid()).min(1),
      ackedBy: z.string().optional().describe("Identificador del agente, ej. hermes"),
    }),
    handler: async ({ eventIds, ackedBy }) =>
      (await loadPipelineEvents()).ackPipelineEvents(eventIds, ackedBy),
  }),
  list_bikes: tool({
    category: "catalogo",
    description: "Catálogo completo de motos (bike_table).",
    input: empty,
    handler: async () => (await loadQueries()).getAllBikes(),
  }),
  list_categorias: tool({
    category: "inventario",
    description: "Categorías de inventario de repuestos.",
    input: empty,
    handler: async () => (await loadQueries()).getAllCategorias(),
  }),
  list_productos: tool({
    category: "inventario",
    description: "Productos de inventario (repuestos) con su categoría.",
    input: empty,
    handler: async () => (await loadQueries()).getAllProductos(),
  }),
  list_solicitudes_taller: tool({
    category: "taller",
    description: "Solicitudes de taller (repuestos, reparación, cambio de aceite).",
    input: empty,
    handler: async () => (await loadQueries()).getAllSolicitudesTaller(),
  }),
  list_visitadores: tool({
    category: "visitas",
    description: "Todos los visitadores registrados.",
    input: empty,
    handler: async () => (await loadQueries()).getAllVisitadores(),
  }),
  list_active_visitadores: tool({
    category: "visitas",
    description: "Visitadores activos con usuario, aptos para asignar visitas.",
    input: empty,
    handler: async () => (await loadQueries()).getActiveVisitadores(),
  }),
  list_garaje_parqueaderos: tool({
    category: "garaje",
    description: "Parqueaderos del garaje.",
    input: empty,
    handler: async () => (await loadQueries()).getAllGarajeParqueaderos(),
  }),
  list_garaje_motos: tool({
    category: "garaje",
    description:
      "Garaje (/garaje): motos físicas en inventario. Filtra por texto (placa/modelo/referencia/color), estado y límite. Para solo vendidas del patio usa list_garaje_vendidas.",
    input: z.object({
      query: z
        .string()
        .optional()
        .describe("Filtro opcional por placa, modelo, referencia, color o notas"),
      estado: z
        .enum([
          "en_garaje",
          "retenida",
          "en_mantenimiento",
          "disponible",
          "vendida",
          "devuelta",
          "baja",
        ])
        .optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    handler: async ({ query, estado, limit }) => {
      const rows = await (await loadQueries()).getAllGarajeMotos();
      const q = query?.trim().toLowerCase();
      const filtered = rows.filter((r) => {
        if (estado && r.estado !== estado) return false;
        if (!q) return true;
        return [r.placa, r.modelo, r.referencia, r.color, r.notas, r.parqueadero_nombre]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      });
      return filtered.slice(0, limit ?? 100);
    },
  }),
  get_garaje_moto: tool({
    category: "garaje",
    description:
      "Detalle de una moto del garaje por id o placa. Úsala antes de editar con save_garaje_moto.",
    input: z
      .object({
        id: z.string().uuid().optional(),
        placa: z.string().min(5).optional(),
      })
      .refine((v) => Boolean(v.id || v.placa), {
        message: "Indica id o placa",
      }),
    handler: async ({ id, placa }) => {
      const rows = await (await loadQueries()).getAllGarajeMotos();
      const norm = placa?.trim().toUpperCase().replace(/\s+/g, "");
      const found = id
        ? rows.find((r) => r.id === id)
        : rows.find(
            (r) =>
              r.placa?.trim().toUpperCase().replace(/\s+/g, "") === norm,
          );
      if (!found) {
        throw new Error(
          id
            ? `No hay moto de garaje con id ${id}.`
            : `No hay moto de garaje con placa ${norm}.`,
        );
      }
      return found;
    },
  }),
  list_garaje_vendidas: tool({
    category: "garaje",
    description:
      "Garaje vista Vendidas (/garaje?vista=vendidas): unidades de garaje ya vendidas con placa, cliente y fecha.",
    input: empty,
    handler: async () => (await loadQueries()).getGarajeMotosVendidas(),
  }),
  list_vendidas: tool({
    category: "garaje",
    description:
      "Con clientes (/vendidas): motos de crédito/renting entregadas con estado físico y mora. NO son ventas de contado — usa list_ventas_contado.",
    input: z.object({
      query: z
        .string()
        .optional()
        .describe("Filtro opcional por placa, modelo, color, referencia o userId"),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    handler: async ({ query, limit }) => {
      const rows = await (await loadQueries()).getAllVendidasMotos();
      const q = query?.trim().toLowerCase();
      const filtered = q
        ? rows.filter((r) =>
            [
              r.placa,
              r.modelo,
              r.color,
              r.referencia,
              r.chasis,
              String(r.user_id),
              r.users?.user,
            ]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q)),
          )
        : rows;
      return filtered.slice(0, limit ?? 100);
    },
  }),
  get_vendida: tool({
    category: "garaje",
    description:
      "Detalle de una moto Con clientes (/vendidas) por compraId o placa. Úsala antes de update_vendida_estado_fisico.",
    input: z
      .object({
        compraId: z.string().uuid().optional(),
        placa: z.string().min(5).optional(),
      })
      .refine((v) => Boolean(v.compraId || v.placa), {
        message: "Indica compraId o placa",
      }),
    handler: async ({ compraId, placa }) => {
      const rows = await (await loadQueries()).getAllVendidasMotos();
      const norm = placa?.trim().toUpperCase().replace(/\s+/g, "");
      const found = compraId
        ? rows.find((r) => r.id === compraId)
        : rows.find(
            (r) =>
              r.placa?.trim().toUpperCase().replace(/\s+/g, "") === norm,
          );
      if (!found) {
        throw new Error(
          compraId
            ? `No hay moto entregada con compraId ${compraId}.`
            : `No hay moto entregada con placa ${norm}.`,
        );
      }
      return found;
    },
  }),
  list_ventas_contado: tool({
    category: "lectura",
    description:
      "Venta de contado (/venta-contado) e Historial: ventas de motos al contado/abono (ventas_moto). Incluye cliente, modelo, placa, valorVenta, montoPagado y saldo.",
    input: z.object({
      query: z
        .string()
        .optional()
        .describe("Filtro opcional por nombre, cédula, placa, celular o modelo"),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    handler: async ({ query, limit }) => {
      const rows = await (await loadVentaMotoActions()).getVentasContado();
      const q = query?.trim().toLowerCase();
      const filtered = q
        ? rows.filter((r) =>
            [r.clienteNombre, r.clienteCedula, r.clienteCelular, r.placa, r.modelo, r.color]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q)),
          )
        : rows;
      return filtered.slice(0, limit ?? 100).map((r) => ({
        ...r,
        saldo:
          r.valorVenta != null
            ? Math.max(0, r.valorVenta - r.montoPagado)
            : null,
        estadoPago:
          r.valorVenta != null && r.montoPagado >= r.valorVenta
            ? "contado"
            : r.montoPagado > 0
              ? "abono"
              : "sin_pago",
      }));
    },
  }),
  get_venta_contado: tool({
    category: "lectura",
    description:
      "Detalle de una venta de contado por id o placa. Úsala antes de update_venta_moto / add_abono_venta_moto.",
    input: z
      .object({
        id: z.string().uuid().optional(),
        placa: z.string().min(5).optional(),
      })
      .refine((v) => Boolean(v.id || v.placa), {
        message: "Indica id o placa",
      }),
    handler: async ({ id, placa }) => {
      const rows = await (await loadVentaMotoActions()).getVentasContado();
      const norm = placa?.trim().toUpperCase().replace(/\s+/g, "");
      const found = id
        ? rows.find((r) => r.id === id)
        : rows.find(
            (r) =>
              r.placa?.trim().toUpperCase().replace(/\s+/g, "") === norm,
          );
      if (!found) {
        throw new Error(
          id
            ? `No hay venta de contado con id ${id}.`
            : `No hay venta de contado con placa ${norm}.`,
        );
      }
      return {
        ...found,
        saldo:
          found.valorVenta != null
            ? Math.max(0, found.valorVenta - found.montoPagado)
            : null,
      };
    },
  }),
  list_ventas_producto: tool({
    category: "lectura",
    description:
      "Sidebar Historial (/historial-ventas): ventas de productos/repuestos (ventas_producto). Incluye ítems, total y montoPagado.",
    input: z.object({
      query: z
        .string()
        .optional()
        .describe("Filtro opcional por nombre, cédula o celular del cliente"),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    handler: async ({ query, limit }) => {
      const rows = await (
        await loadVentaProductoActions()
      ).listVentasProductoHistorial(limit ?? 100);
      const q = query?.trim().toLowerCase();
      if (!q) return rows;
      return rows.filter((r) =>
        [r.clienteNombre, r.clienteCedula, r.clienteCelular]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    },
  }),
  list_motos_credito_liquidado: tool({
    category: "lectura",
    description:
      "Historial Tienda (/historial-ventas): motos de crédito ya saldadas. NO es Garaje vendidas — usa list_garaje_vendidas. Complementa list_ventas_contado y list_vendidas (Con clientes).",
    input: empty,
    handler: async () =>
      (await loadHistorialMotosActions()).listHistorialMotosCredito(),
  }),
  get_caja_hoy: tool({
    category: "caja",
    description:
      "Sidebar Caja (/caja): sesión de hoy (America/Bogota) — apertura/cierre, movimientos, egresos e informe. Null si aún no se abrió.",
    input: empty,
    handler: async () => (await loadCajaActions()).getCajaSesionHoy(),
  }),

  // ---------------------------------------------------------------- CRÉDITO
  approve_credit: tool({
    category: "credito",
    description:
      "Aprueba la solicitud de crédito de un cliente (users_documents → aceptada).",
    input: z.object({
      documentId: z.number().int().positive(),
      userId: z.number().int().positive(),
    }),
    handler: async ({ documentId, userId }) =>
      (await loadAdminActions()).approveCredit(documentId, userId),
  }),
  reject_credit: tool({
    category: "credito",
    description:
      "Rechaza una solicitud de crédito con motivo. Si betado=true, el cliente queda vetado de reenviar.",
    input: z.object({
      documentId: z.number().int().positive(),
      userId: z.number().int().positive(),
      motivo: z.string().min(3),
      betado: z.boolean(),
    }),
    handler: async (args) => (await loadAdminActions()).rejectCredit(args),
  }),

  // ---------------------------------------------------------------- VISITAS
  assign_visit: tool({
    category: "visitas",
    description:
      "Asigna un visitador y fecha a una visita domiciliaria (estado → asignada).",
    input: z.object({
      visitaId: z.string().uuid(),
      userId: z.number().int().positive(),
      visitadorId: z.number().int().positive(),
      fechaProgramada: z
        .string()
        .min(1)
        .describe("Fecha/hora ISO 8601 de la visita"),
    }),
    handler: async (args) => (await loadAdminActions()).assignVisit(args),
  }),
  complete_visit: tool({
    category: "visitas",
    description: "Marca una visita como completada.",
    input: z.object({
      visitaId: z.string().uuid(),
      userId: z.number().int().positive(),
    }),
    handler: async ({ visitaId, userId }) =>
      (await loadAdminActions()).completeVisit(visitaId, userId),
  }),
  cancel_visit: tool({
    category: "visitas",
    description: "Cancela una visita.",
    input: z.object({
      visitaId: z.string().uuid(),
      userId: z.number().int().positive(),
    }),
    handler: async ({ visitaId, userId }) =>
      (await loadAdminActions()).cancelVisit(visitaId, userId),
  }),

  // ---------------------------------------------------------------- PAGOS
  confirm_payment_flag: tool({
    category: "pagos",
    description:
      "Marca/desmarca la confirmación del pago inicial o de la cuota de una compra (flags pago_inicial_confirmado / pago_cuota_confirmado).",
    input: z.object({
      compraId: z.string().uuid(),
      userId: z.number().int().positive(),
      field: z.enum(["inicial", "cuota"]),
      value: z.boolean(),
    }),
    handler: async (args) => (await loadAdminActions()).confirmPayment(args),
  }),
  confirm_tarifa_pago: tool({
    category: "pagos",
    description:
      "Confirma el pago de una tarifa/cuota de renting (tarifas_pagadas → pagada con monto esperado).",
    input: z.object({
      tarifaId: z.string().uuid(),
      userId: z.number().int().positive(),
      notas: z.string().optional(),
    }),
    handler: async (args) => (await loadAdminActions()).confirmTarifaPago(args),
  }),
  register_payment: tool({
    category: "pagos",
    description:
      "Registra un pago confirmado con todos sus datos (sin comprobante adjunto). Contexto: 'tarifa' (requiere tarifaId y comprobante, no soportado por agente), 'inicial' o 'cuota_adelantada'. Aplica validación de referencia única por cliente.",
    input: z.object({
      userId: z.number().int().positive(),
      compraId: z.string().uuid(),
      contexto: z.enum(["tarifa", "inicial", "cuota_adelantada"]),
      tarifaId: z.string().uuid().optional(),
      referencia: z.string().optional(),
      monto: z.number().int().positive(),
      fechaComprobante: z.string().optional().describe("ISO 8601"),
      medioPagoAdmin: z.enum([
        "nequi_nicolas",
        "davivienda",
        "efectivo",
        "datafono",
      ]),
      bancoOrigen: z.enum([
        "nequi",
        "davivienda",
        "bancolombia",
        "banco_bogota",
        "pse",
        "otro",
      ]),
      entradaManual: z.boolean().default(true),
      notas: z.string().optional(),
    }),
    handler: async (args) => {
      const fd = new FormData();
      fd.set("userId", String(args.userId));
      fd.set("compraId", args.compraId);
      fd.set("contexto", args.contexto);
      if (args.tarifaId) fd.set("tarifaId", args.tarifaId);
      if (args.referencia) fd.set("referencia", args.referencia);
      fd.set("monto", String(args.monto));
      if (args.fechaComprobante) fd.set("fechaComprobante", args.fechaComprobante);
      fd.set("medioPagoAdmin", args.medioPagoAdmin);
      fd.set("bancoOrigen", args.bancoOrigen);
      fd.set("entradaManual", String(args.entradaManual));
      if (args.notas) fd.set("notas", args.notas);
      return (await loadPaymentActions()).confirmPagoConComprobante(fd);
    },
  }),
  check_referencia_usada: tool({
    category: "pagos",
    description:
      "Verifica si una referencia de pago ya fue usada por un cliente (anti-duplicado).",
    input: z.object({
      userId: z.number().int().positive(),
      referencia: z.string().min(1),
    }),
    handler: async (args) =>
      (await loadPaymentActions()).checkReferenciaPagoUsada(args),
  }),
  remove_pago_abono: tool({
    category: "pagos",
    description:
      "Elimina un abono del primer pago (contexto inicial o cuota_adelantada) si la compra no está entregada/cancelada.",
    input: z.object({
      pagoId: z.string().uuid(),
      userId: z.number().int().positive(),
    }),
    handler: async ({ pagoId, userId }) =>
      (await loadPaymentActions()).removePagoAbono(pagoId, userId),
  }),
  update_pago_abono: tool({
    category: "pagos",
    description:
      "Corrige monto, referencia, medio o concepto de un abono del primer pago (antes de entregar).",
    input: z.object({
      pagoId: z.string().uuid(),
      userId: z.number().int().positive(),
      monto: z.number().int().positive(),
      referencia: z.string().min(1),
      medioPagoAdmin: z.enum([
        "nequi_nicolas",
        "davivienda",
        "efectivo",
        "datafono",
      ]),
      contexto: z.enum(["inicial", "cuota_adelantada", "visita"]),
    }),
    handler: async (args) =>
      (await loadPaymentActions()).updatePagoAbono(args),
  }),

  // ---------------------------------------------------------------- ENTREGA
  update_delivery: tool({
    category: "entrega",
    description:
      "Registra los datos de entrega de la moto (placa, chasis, referencia, fecha de entrega).",
    input: z.object({
      compraId: z.string().uuid(),
      userId: z.number().int().positive(),
      placa: z.string().min(1),
      chasis: z.string().min(1),
      referencia: z.string().optional(),
      fechaEntrega: z.string().min(1).describe("Fecha ISO/date de entrega"),
    }),
    handler: async (args) => (await loadAdminActions()).updateDelivery(args),
  }),
  mark_delivered: tool({
    category: "entrega",
    description: "Marca la compra como entregada (dispara generación de tarifas).",
    input: z.object({
      compraId: z.string().uuid(),
      userId: z.number().int().positive(),
    }),
    handler: async ({ compraId, userId }) =>
      (await loadAdminActions()).markDelivered(compraId, userId),
  }),
  cancel_compra: tool({
    category: "entrega",
    description: "Cancela una compra de moto.",
    input: z.object({
      compraId: z.string().uuid(),
      userId: z.number().int().positive(),
    }),
    handler: async ({ compraId, userId }) =>
      (await loadAdminActions()).cancelCompra(compraId, userId),
  }),
  update_vendida_estado_fisico: tool({
    category: "entrega",
    description:
      "Actualiza el estado físico de una moto ya entregada (activa, recogida, robada, en_transito, en_patio).",
    input: z.object({
      compraId: z.string().uuid(),
      userId: z.number().int().positive(),
      estadoFisico: z.enum([
        "activa",
        "recogida",
        "robada",
        "en_transito",
        "en_patio",
      ]),
    }),
    handler: async (args) =>
      (await loadAdminActions()).updateVendidaEstadoFisico(args),
  }),
  delete_vendida_moto: tool({
    category: "entrega",
    description:
      "Elimina una compra entregada y sus motos de garaje asociadas. Acción destructiva.",
    input: z.object({
      compraId: z.string().uuid(),
      userId: z.number().int().positive(),
    }),
    handler: async ({ compraId, userId }) =>
      (await loadAdminActions()).deleteVendidaMoto(compraId, userId),
  }),

  // ---------------------------------------------------------------- MORA / TRACKING
  set_tracking: tool({
    category: "mora",
    description: "Activa o desactiva el seguimiento GPS de un cliente.",
    input: z.object({
      userId: z.number().int().positive(),
      seguimiento: z.boolean(),
    }),
    handler: async ({ userId, seguimiento }) =>
      (await loadAdminActions()).setTracking(userId, seguimiento),
  }),
  resolve_moroso: tool({
    category: "mora",
    description:
      "Regulariza a un cliente moroso. Falla si quedan tarifas vencidas sin pagar.",
    input: z.object({
      morosoId: z.string().uuid(),
      userId: z.number().int().positive(),
    }),
    handler: async (args) => (await loadAdminActions()).resolveMoroso(args),
  }),
  mark_moto_recogida: tool({
    category: "mora",
    description: "Marca una moto en cola de recogida como recogida.",
    input: z.object({
      recogerId: z.string().uuid(),
      userId: z.number().int().positive(),
    }),
    handler: async (args) => (await loadAdminActions()).markMotoRecogida(args),
  }),

  // ---------------------------------------------------------------- CLIENTES
  create_client: tool({
    category: "clientes",
    description:
      "Crea un usuario cliente por cédula (usuario=cédula, password=cédula, status normal).",
    input: z.object({
      cedula: z
        .string()
        .min(5)
        .max(15)
        .regex(/^\d+$/, "Solo dígitos"),
    }),
    handler: async ({ cedula }) =>
      (await loadAdminActions()).createClientUser({ cedula }),
  }),
  submit_public_application: tool({
    category: "clientes",
    description:
      "Envía una solicitud pública de crédito (documentos + hoja de vida). Requiere URLs ya subidas a Storage de cédula frente/reverso y selfie, más la hoja de vida completa.",
    input: z.object({
      documentFrontUrl: z.string().url(),
      documentBackUrl: z.string().url(),
      selfieUrl: z.string().url(),
      hojaVida: hojaVidaFormSchema,
    }),
    handler: async (args) =>
      (await loadClientActions()).submitPublicApplication(args),
  }),

  // ---------------------------------------------------------------- VISITADORES (CRUD)
  save_visitador: tool({
    category: "visitas",
    description:
      "Crea o edita un visitador. Al crear (sin id) se requieren username y password; se genera su usuario con status visitador.",
    input: z.object({
      id: z.number().int().positive().optional(),
      nombre: z.string().min(2),
      telefono: z.string().optional(),
      fotoUrl: z.string().optional(),
      activo: z.boolean(),
      username: z.string().min(3).optional(),
      password: z.string().min(4).optional(),
    }),
    handler: async (args) => (await loadAdminActions()).saveVisitador(args),
  }),
  delete_visitador: tool({
    category: "visitas",
    description: "Elimina un visitador y su usuario asociado.",
    input: z.object({ id: z.number().int().positive() }),
    handler: async ({ id }) => (await loadAdminActions()).deleteVisitador(id),
  }),

  // ---------------------------------------------------------------- CATÁLOGO (CRUD)
  save_bike: tool({
    category: "catalogo",
    description: "Crea o edita una moto del catálogo (bike_table).",
    input: z.object({
      id: z.number().int().positive().optional(),
      modelo: z.string().min(1),
      color: z.string().min(1),
      imagenUrl: z.string().optional(),
      stock: z.number().int().min(0),
      cuotaInicial: z.number().int().min(0),
      cuotaDiaria: z.number().int().min(0),
      montoVisita: z.number().int().min(0).default(MONTO_VISITA_DEFAULT),
      precioVenta: z.number().int().positive().optional().nullable(),
      descripcion: z.string().optional(),
      activo: z.boolean(),
    }),
    handler: async (args) => (await loadAdminActions()).saveBike(args),
  }),
  delete_bike: tool({
    category: "catalogo",
    description: "Elimina una moto del catálogo.",
    input: z.object({ id: z.number().int().positive() }),
    handler: async ({ id }) => (await loadAdminActions()).deleteBike(id),
  }),

  // ---------------------------------------------------------------- INVENTARIO (CRUD)
  save_categoria: tool({
    category: "inventario",
    description: "Crea o edita una categoría de inventario.",
    input: z.object({
      id: z.number().int().positive().optional(),
      nombre: z.string().min(1),
      slug: z.string().min(1),
      descripcion: z.string().optional(),
      activo: z.boolean(),
      orden: z.number().int().min(0),
    }),
    handler: async (args) => (await loadAdminActions()).saveCategoria(args),
  }),
  delete_categoria: tool({
    category: "inventario",
    description: "Elimina una categoría de inventario.",
    input: z.object({ id: z.number().int().positive() }),
    handler: async ({ id }) => (await loadAdminActions()).deleteCategoria(id),
  }),
  save_producto: tool({
    category: "inventario",
    description: "Crea o edita un producto/repuesto de inventario.",
    input: z.object({
      id: z.number().int().positive().optional(),
      categoriaId: z.number().int().positive(),
      sku: z.string().min(1),
      nombre: z.string().min(1),
      descripcion: z.string().optional(),
      precio: z.number().int().min(0),
      costo: z.number().int().min(0),
      stock: z.number().int().min(0),
      stockMinimo: z.number().int().min(0),
      imagenUrl: z.string().optional(),
      compatibleModelos: z.array(z.string()).optional(),
      activo: z.boolean(),
    }),
    handler: async (args) => (await loadAdminActions()).saveProducto(args),
  }),
  delete_producto: tool({
    category: "inventario",
    description: "Elimina un producto de inventario.",
    input: z.object({ id: z.number().int().positive() }),
    handler: async ({ id }) => (await loadAdminActions()).deleteProducto(id),
  }),

  // ---------------------------------------------------------------- TALLER
  update_solicitud_estado: tool({
    category: "taller",
    description:
      "Cambia el estado de una solicitud de taller y opcionalmente sus notas admin.",
    input: z.object({
      solicitudId: z.string().uuid(),
      estado: z.enum(["pendiente", "en_proceso", "completada", "cancelada"]),
      notasAdmin: z.string().optional(),
    }),
    handler: async (args) =>
      (await loadAdminActions()).updateSolicitudEstado(args),
  }),

  // ---------------------------------------------------------------- GARAJE (CRUD)
  save_garaje_parqueadero: tool({
    category: "garaje",
    description: "Crea o edita un parqueadero del garaje.",
    input: z.object({
      id: z.number().int().positive().optional(),
      nombre: z.string().min(1),
      slug: z.string().min(1),
      activo: z.boolean(),
      orden: z.number().int().min(0),
    }),
    handler: async (args) =>
      (await loadAdminActions()).saveGarajeParqueadero(args),
  }),
  delete_garaje_parqueadero: tool({
    category: "garaje",
    description:
      "Elimina un parqueadero. Falla si hay motos asignadas a él.",
    input: z.object({ id: z.number().int().positive() }),
    handler: async ({ id }) =>
      (await loadAdminActions()).deleteGarajeParqueadero(id),
  }),
  save_garaje_moto: tool({
    category: "garaje",
    description:
      "Crea o edita una moto física del garaje. Para registros manuales nuevos (isNewManual) la foto de placa es obligatoria si no es nueva. Estados: en_garaje, retenida, en_mantenimiento, disponible, vendida, devuelta, baja.",
    input: z.object({
      id: z.string().uuid().optional(),
      parqueaderoId: z.number().int().positive().nullable(),
      placa: z.string().optional(),
      placaFotoUrl: z.string().optional(),
      referencia: z.string().min(1),
      modelo: z.string().min(1),
      color: z.string().min(1),
      origen: z.enum(["manual", "recuperacion"]),
      condicion: z.enum(["nueva", "segunda_mano", "recuperada"]),
      estado: z.enum([
        "en_garaje",
        "retenida",
        "en_mantenimiento",
        "disponible",
        "vendida",
        "devuelta",
        "baja",
      ]),
      cuotaInicial: z.number().int().nonnegative().nullable().optional(),
      cuotaDiaria: z.number().int().nonnegative().nullable().optional(),
      montoVisita: z.number().int().nonnegative().nullable().optional(),
      notas: z.string().optional(),
      isNewManual: z.boolean().optional(),
    }),
    handler: async (args) => (await loadAdminActions()).saveGarajeMoto(args),
  }),
  delete_garaje_moto: tool({
    category: "garaje",
    description: "Elimina una moto del garaje.",
    input: z.object({ id: z.string().uuid() }),
    handler: async ({ id }) => (await loadAdminActions()).deleteGarajeMoto(id),
  }),
  liberar_garaje_moto_venta: tool({
    category: "garaje",
    description:
      "Libera una moto retenida del garaje para reventa (estado retenida → mantenimiento/disponible según plazo).",
    input: z.object({ garajeMotoId: z.string().uuid() }),
    handler: async (args) =>
      (await loadAdminActions()).liberarGarajeMotoParaVenta(args),
  }),
  devolver_garaje_moto_cliente: tool({
    category: "garaje",
    description:
      "Devuelve una moto retenida al cliente (retenida → devuelta) cuando pagó parte de la deuda.",
    input: z.object({ garajeMotoId: z.string().uuid() }),
    handler: async (args) =>
      (await loadAdminActions()).devolverGarajeMotoAlCliente(args),
  }),

  // ------------------------------------------------------------- TARJETAS
  list_tarjetas_propiedad: tool({
    category: "tarjetas",
    description:
      "Licencias (/tarjetas-propiedad): lista licencias de tránsito (frente/reverso por placa). Filtro opcional por placa u otros campos.",
    input: z.object({
      query: z
        .string()
        .optional()
        .describe("Filtro por placa, propietario, marca, modelo o número de licencia"),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    handler: async ({ query, limit }) => {
      const rows = await (await loadQueries()).getAllTarjetasPropiedad();
      const q = query?.trim().toLowerCase();
      const filtered = q
        ? rows.filter((r) =>
            [
              r.placa,
              r.propietario,
              r.marca,
              r.linea,
              r.modelo,
              r.numero_licencia,
              r.identificacion_numero,
            ]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q)),
          )
        : rows;
      return filtered.slice(0, limit ?? 100);
    },
  }),
  get_tarjeta_propiedad: tool({
    category: "tarjetas",
    description:
      "Detalle completo de una licencia por id o placa (fotos + datos OCR). Úsala antes de update_tarjeta_propiedad.",
    input: z
      .object({
        id: z.string().uuid().optional(),
        placa: z.string().min(5).optional(),
      })
      .refine((v) => Boolean(v.id || v.placa), {
        message: "Indica id o placa",
      }),
    handler: async (args) => {
      const row = await (await loadTarjetaActions()).getTarjetaPropiedad(args);
      if (!row) {
        throw new Error(
          args.id
            ? `No hay licencia con id ${args.id}.`
            : `No hay licencia con placa ${args.placa}.`,
        );
      }
      return row;
    },
  }),
  create_tarjeta_propiedad: tool({
    category: "tarjetas",
    description:
      "Crea una tarjeta de propiedad. Requiere URLs de foto frente y reverso (sin binario).",
    input: z.object({
      placa: z.string().min(5),
      imagen_url: z.string().min(1),
      imagen_reverso_url: z.string().min(1),
    }),
    handler: async (args) =>
      (await loadTarjetaActions()).createTarjetaPropiedad(args),
  }),
  update_tarjeta_propiedad: tool({
    category: "tarjetas",
    description:
      "Edita una licencia (placa/fotos/datos). Busca por id o placa; no elimina. Solo envía los campos a cambiar.",
    input: z
      .object({
        id: z.string().uuid().optional(),
        placa: z.string().min(5).optional(),
        imagen_url: z.string().min(1).optional(),
        imagen_reverso_url: z.string().min(1).optional(),
        numero_licencia: z.string().nullable().optional(),
        marca: z.string().nullable().optional(),
        linea: z.string().nullable().optional(),
        modelo: z.string().nullable().optional(),
        cilindrada: z.string().nullable().optional(),
        color: z.string().nullable().optional(),
        servicio: z.string().nullable().optional(),
        clase_vehiculo: z.string().nullable().optional(),
        tipo_carroceria: z.string().nullable().optional(),
        combustible: z.string().nullable().optional(),
        capacidad: z.string().nullable().optional(),
        numero_motor: z.string().nullable().optional(),
        vin: z.string().nullable().optional(),
        numero_serie: z.string().nullable().optional(),
        numero_chasis: z.string().nullable().optional(),
        propietario: z.string().nullable().optional(),
        identificacion_tipo: z.string().nullable().optional(),
        identificacion_numero: z.string().nullable().optional(),
      })
      .refine((v) => Boolean(v.id || v.placa), {
        message: "Indica id o placa",
      }),
    handler: async (args) =>
      (await loadTarjetaActions()).updateTarjetaPropiedad(args),
  }),
  delete_tarjeta_propiedad: tool({
    category: "tarjetas",
    description: "Elimina una tarjeta de propiedad por id.",
    input: z.object({ id: z.string().uuid() }),
    handler: async ({ id }) =>
      (await loadTarjetaActions()).deleteTarjetaPropiedad(id),
  }),

  // ---------------------------------------------------- EXTRAS A CRÉDITO
  list_productos_credito: tool({
    category: "inventario",
    description:
      "Sidebar Extras a crédito (/productos-credito): catálogo de productos a crédito (cuota inicial/diaria).",
    input: empty,
    handler: async () => (await loadQueries()).getAllProductosCredito(),
  }),
  save_producto_credito: tool({
    category: "inventario",
    description:
      "Crea o edita un producto a crédito del catálogo (Extras a crédito).",
    input: z.object({
      id: z.number().int().positive().optional(),
      nombre: z.string().min(1),
      descripcion: z.string().optional(),
      cuotaInicial: z.number().int().min(0),
      cuotaDiaria: z.number().int().positive(),
      imagenUrl: z.string().optional(),
      activo: z.boolean(),
      orden: z.number().int().min(0),
    }),
    handler: async (args) =>
      (await loadAdminActions()).saveProductoCredito(args),
  }),
  delete_producto_credito: tool({
    category: "inventario",
    description: "Elimina un producto a crédito del catálogo.",
    input: z.object({ id: z.number().int().positive() }),
    handler: async ({ id }) =>
      (await loadAdminActions()).deleteProductoCredito(id),
  }),
  add_compra_producto_credito: tool({
    category: "inventario",
    description:
      "Asigna un extra a crédito a una compra en pendiente_pago (catálogo o ad-hoc).",
    input: z.object({
      compraId: z.string().uuid(),
      userId: z.number().int().positive(),
      productoCreditoId: z.number().int().positive().optional(),
      nombre: z.string().min(1).optional(),
      cuotaInicial: z.number().int().min(0).optional(),
      cuotaDiaria: z.number().int().positive().optional(),
      cantidad: z.number().int().positive().default(1),
      notas: z.string().optional(),
    }),
    handler: async (args) =>
      (await loadAdminActions()).addCompraProductoCredito(args),
  }),
  remove_compra_producto_credito: tool({
    category: "inventario",
    description:
      "Quita un extra a crédito de una compra en pendiente_pago (itemId + userId).",
    input: z.object({
      itemId: z.string().uuid(),
      userId: z.number().int().positive(),
    }),
    handler: async ({ itemId, userId }) =>
      (await loadAdminActions()).removeCompraProductoCredito(itemId, userId),
  }),

  // ---------------------------------------------------------------- CAJA
  abrir_caja: tool({
    category: "caja",
    description: "Abre la caja del día con efectivo inicial.",
    input: z.object({
      montoApertura: z.number().int().positive(),
      notas: z.string().optional(),
    }),
    handler: async (args) => (await loadCajaActions()).abrirCaja(args),
  }),
  cerrar_caja: tool({
    category: "caja",
    description: "Cierra la sesión de caja con el monto contado.",
    input: z.object({
      sesionId: z.string().uuid(),
      montoCierre: z.number().int().nonnegative(),
      notas: z.string().optional(),
    }),
    handler: async (args) => (await loadCajaActions()).cerrarCaja(args),
  }),
  registrar_movimiento_caja: tool({
    category: "caja",
    description: "Registra entrada o salida manual de efectivo en caja.",
    input: z.object({
      sesionId: z.string().uuid(),
      tipo: z.enum(["entrada", "salida"]),
      monto: z.number().int().positive(),
      concepto: z.string().min(1),
    }),
    handler: async (args) =>
      (await loadCajaActions()).registrarMovimientoCaja(args),
  }),
  registrar_egreso_caja: tool({
    category: "caja",
    description: "Registra un egreso/pago desde caja (efectivo, nequi o davivienda).",
    input: z.object({
      sesionId: z.string().uuid(),
      concepto: z.string().min(1),
      beneficiario: z.string().optional(),
      monto: z.number().int().positive(),
      medioPago: z.enum(["efectivo", "nequi", "davivienda"]),
      notas: z.string().optional(),
    }),
    handler: async (args) =>
      (await loadCajaActions()).registrarEgresoCaja(args),
  }),
  registrar_cobro_visita_caja: tool({
    category: "caja",
    description:
      "Cobra la visita domiciliaria desde caja abierta (compra + userId).",
    input: z.object({
      sesionId: z.string().uuid(),
      compraId: z.string().uuid(),
      userId: z.number().int().positive(),
      medioPagoAdmin: z
        .enum(["efectivo", "datafono", "nequi_nicolas", "davivienda"])
        .optional()
        .default("efectivo"),
    }),
    handler: async (args) =>
      (await loadCajaActions()).registrarCobroVisitaDesdeCaja(args),
  }),

  // -------------------------------------------------------------- CONTADO
  save_venta_moto: tool({
    category: "ventas",
    description:
      "Sidebar Contado: crea venta de moto al contado/abono (descuenta stock del catálogo).",
    input: z.object({
      bikeId: z.number().int().positive(),
      modelo: z.string().min(1),
      color: z.string().min(1),
      clienteNombre: z.string().min(1),
      clienteCedula: z.string().min(5),
      clienteCelular: z.string().min(10),
      chasis: z.string().optional(),
      cuotaInicial: z.number().int().nonnegative().optional(),
      valorVenta: z.number().int().positive().optional(),
      montoPagado: z.number().int().nonnegative().optional(),
      notas: z.string().optional(),
    }),
    handler: async (args) => (await loadVentaMotoActions()).saveVentaMoto(args),
  }),
  add_abono_venta_moto: tool({
    category: "ventas",
    description: "Agrega un abono a una venta de moto al contado.",
    input: z.object({
      id: z.string().uuid(),
      monto: z.number().int().positive(),
    }),
    handler: async ({ id, monto }) =>
      (await loadVentaMotoActions()).addAbonoVentaMoto(id, monto),
  }),
  update_venta_moto: tool({
    category: "ventas",
    description: "Actualiza datos de una venta de moto al contado (cliente, montos, placa).",
    input: z.object({
      id: z.string().uuid(),
      clienteNombre: z.string().min(1),
      clienteCedula: z.string().min(5),
      clienteCelular: z.string().min(10),
      chasis: z.string().optional(),
      valorVenta: z.number().int().positive().optional(),
      montoPagado: z.number().int().nonnegative(),
      placa: z.string().max(10),
      notas: z.string().optional(),
    }),
    handler: async (args) =>
      (await loadVentaMotoActions()).updateVentaMoto(args),
  }),
  set_placa_venta_moto: tool({
    category: "ventas",
    description: "Asigna o cambia la placa de una venta de moto al contado.",
    input: z.object({
      id: z.string().uuid(),
      placa: z.string().min(5).max(10),
    }),
    handler: async ({ id, placa }) =>
      (await loadVentaMotoActions()).setPlacaVentaMoto(id, placa),
  }),

  // ------------------------------------------------------------ REPUESTOS
  search_productos_venta: tool({
    category: "ventas",
    description:
      "Sidebar Repuestos (/venta): busca productos activos por SKU o nombre para el POS.",
    input: z.object({
      q: z.string().min(1).describe("Texto de búsqueda (SKU o nombre)"),
    }),
    handler: async ({ q }) =>
      (await loadVentaActions()).searchProductosVenta(q),
  }),
  save_venta_producto: tool({
    category: "ventas",
    description:
      "Registra una venta de productos/repuestos (descuenta stock). Requiere caja abierta en el flujo humano; el agente puede crear la venta igual.",
    input: z.object({
      clienteNombre: z.string().min(1),
      clienteCedula: z.string().optional(),
      clienteCelular: z.string().min(10),
      montoPagado: z.number().int().nonnegative().optional(),
      notas: z.string().optional(),
      items: z
        .array(
          z.object({
            productoId: z.number().int().positive(),
            cantidad: z.number().int().positive(),
          }),
        )
        .min(1),
    }),
    handler: async (args) =>
      (await loadVentaProductoActions()).saveVentaProducto(args),
  }),

  // ---------------------------------------------------------------- EQUIPO
  referral_leaderboard: tool({
    category: "equipo",
    description:
      "Sidebar Equipo: ranking de referidos (compras a crédito por referral_source). Rango opcional ISO.",
    input: z.object({
      startIso: z.string().optional(),
      endExclusiveIso: z.string().optional(),
    }),
    handler: async ({ startIso, endExclusiveIso }) => {
      const range =
        startIso && endExclusiveIso
          ? { startIso, endExclusiveIso }
          : undefined;
      return (await loadQueries()).getReferralLeaderboard(range);
    },
  }),
  equipo_visitas_detalle: tool({
    category: "equipo",
    description:
      "Sidebar Equipo: visitas asignadas/completadas y ranking de visitadores. Rango opcional ISO.",
    input: z.object({
      startIso: z.string().optional(),
      endExclusiveIso: z.string().optional(),
    }),
    handler: async ({ startIso, endExclusiveIso }) => {
      const range =
        startIso && endExclusiveIso
          ? { startIso, endExclusiveIso }
          : undefined;
      return (await loadQueries()).getEquipoVisitasDetalle(range);
    },
  }),
} satisfies Record<string, ToolDef>;

export type AgentToolName = keyof typeof AGENT_TOOLS;

export interface AgentToolSchema {
  name: string;
  category: AgentToolCategory;
  description: string;
  parameters: Record<string, unknown>;
}

function safeJsonSchema(input: z.ZodTypeAny): Record<string, unknown> {
  try {
    return z.toJSONSchema(input, { target: "draft-7" }) as Record<string, unknown>;
  } catch {
    return { type: "object", properties: {}, additionalProperties: true };
  }
}

/** Catálogo OpenAI/Hermes-compatible (function-calling) generado desde Zod. */
export function getAgentToolCatalog(
  scope: AgentToolScope = "full",
): AgentToolSchema[] {
  const names = Object.keys(AGENT_TOOLS) as AgentToolName[];
  const filtered =
    scope === "motos" ? names.filter((name) => isMotosTool(name)) : names;
  return filtered.map((name) => {
    const def = AGENT_TOOLS[name];
    return {
      name,
      category: def.category,
      description: def.description,
      parameters: safeJsonSchema(def.input),
    };
  });
}

export interface DispatchResult {
  ok: boolean;
  result?: unknown;
  error?: string;
}

/** Valida los argumentos y ejecuta la herramienta indicada. */
export async function dispatchAgentTool(
  name: string,
  args: unknown,
  scope: AgentToolScope = "full",
): Promise<DispatchResult> {
  if (scope === "motos" && !isMotosTool(name)) {
    return {
      ok: false,
      error: `Tool "${name}" no está disponible en el asistente Motos (solo consulta/edición del área Motos; sin eliminar).`,
    };
  }

  const def = (AGENT_TOOLS as Record<string, ToolDef | undefined>)[name];
  if (!def) {
    return { ok: false, error: `Herramienta desconocida: ${name}` };
  }

  const parsed = def.input.safeParse(args ?? {});
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`)
      .join("; ");
    return { ok: false, error: `Argumentos inválidos: ${issues}` };
  }

  try {
    const result = await def.handler(parsed.data);
    return { ok: true, result };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error al ejecutar la herramienta.",
    };
  }
}
