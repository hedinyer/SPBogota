"use server";

import { requireAdminSession } from "@/lib/auth/session";
import {
  COBRANZA_ACCIONES,
  type CobranzaAccion,
  type CobranzaAccionRow,
} from "@/lib/agent/cobranza";
import {
  getActiveVisitadores,
  getAllBikes,
  getAllProductosCredito,
  getClientPipeline,
  getInboxListItems,
  getInboxQueues,
} from "@/lib/pipeline/queries";
import type {
  BikeRow,
  ClientPipeline,
  InboxListItem,
  InboxQueueId,
  ProductoCreditoRow,
  VisitadorRow,
} from "@/lib/pipeline/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type ClienteWorkPayload = {
  pipeline: ClientPipeline;
  visitadores: VisitadorRow[];
  bikes: BikeRow[];
  productosCredito: ProductoCreditoRow[];
};

export type AgentQueueCounts = {
  solicitudes: number;
  morosos: number;
  recoger: number;
};

/** Solicitudes de crédito pendientes (cola Hoy). */
export async function loadSolicitudesInbox(): Promise<InboxListItem[]> {
  await requireAdminSession();
  const items = await getInboxListItems("creditos");
  return items.filter((i) => i.estadoSolicitud === "pendiente");
}

export async function loadInboxQueue(
  queueId: Extract<InboxQueueId, "morosos" | "recoger">,
): Promise<InboxListItem[]> {
  await requireAdminSession();
  return getInboxListItems(queueId);
}

export async function loadAgentQueueCounts(): Promise<AgentQueueCounts> {
  await requireAdminSession();
  const [solicitudes, queues] = await Promise.all([
    getInboxListItems("creditos"),
    getInboxQueues(),
  ]);
  const countOf = (id: InboxQueueId) =>
    queues.find((q) => q.id === id)?.count ?? 0;
  return {
    solicitudes: solicitudes.filter((i) => i.estadoSolicitud === "pendiente")
      .length,
    morosos: countOf("morosos"),
    recoger: countOf("recoger"),
  };
}

/** Pipeline + datos que pide el paso actual en el chat. */
export async function loadClienteWork(
  userId: number,
): Promise<ClienteWorkPayload | null> {
  await requireAdminSession();
  if (!Number.isFinite(userId) || userId <= 0) return null;

  const [pipeline, visitadores, bikes, productosCredito] = await Promise.all([
    getClientPipeline(userId),
    getActiveVisitadores(),
    getAllBikes(),
    getAllProductosCredito(),
  ]);
  if (!pipeline) return null;
  return { pipeline, visitadores, bikes, productosCredito };
}

export async function listCobranzaAcciones(
  userId: number,
): Promise<CobranzaAccionRow[]> {
  await requireAdminSession();
  if (!Number.isFinite(userId) || userId <= 0) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cobranza_acciones")
    .select("id, user_id, accion, texto, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    userId: row.user_id as number,
    accion: row.accion as CobranzaAccion,
    texto: (row.texto as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}

export async function logCobranzaAccion(input: {
  userId: number;
  accion: CobranzaAccion;
  texto?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdminSession();
  if (!Number.isFinite(input.userId) || input.userId <= 0) {
    return { ok: false, error: "Cliente inválido." };
  }
  if (!(COBRANZA_ACCIONES as readonly string[]).includes(input.accion)) {
    return { ok: false, error: "Acción de cobranza inválida." };
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("cobranza_acciones").insert({
    user_id: input.userId,
    accion: input.accion,
    texto: input.texto?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
