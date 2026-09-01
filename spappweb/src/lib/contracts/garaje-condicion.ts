import type { SupabaseClient } from "@supabase/supabase-js";
import type { CondicionMotoContrato } from "@/lib/contracts/contrato-renting-clausulas";
import { referenciaSugiereUsada } from "@/lib/pipeline/types";

const VALID = new Set<CondicionMotoContrato>([
  "nueva",
  "segunda_mano",
  "recuperada",
]);

export function asCondicion(value: unknown): CondicionMotoContrato | null {
  return VALID.has(value as CondicionMotoContrato)
    ? (value as CondicionMotoContrato)
    : null;
}

/** Condición de garaje por id, o por placa si no hay id. */
export async function fetchGarajeCondicion(
  supabase: SupabaseClient,
  opts: { garajeMotoId?: string | null; placa?: string | null },
): Promise<CondicionMotoContrato | null> {
  if (opts.garajeMotoId) {
    const { data } = await supabase
      .from("garaje_motos")
      .select("condicion")
      .eq("id", opts.garajeMotoId)
      .maybeSingle();
    const c = asCondicion(data?.condicion);
    if (c) return c;
  }

  const placa = opts.placa?.replace(/\s+/g, "").trim();
  if (!placa) return null;

  const { data } = await supabase
    .from("garaje_motos")
    .select("condicion")
    .ilike("placa", placa)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return asCondicion(data?.condicion);
}

/** Selector de compra > referencia USADA > garaje. */
export async function resolveCondicionContrato(
  supabase: SupabaseClient,
  compra: {
    condicion?: unknown;
    garajeMotoId?: string | null;
    placa?: string | null;
    referencia?: string | null;
  },
): Promise<CondicionMotoContrato | null> {
  const explicit = asCondicion(compra.condicion);
  if (explicit) return explicit;
  if (referenciaSugiereUsada(compra.referencia)) return "segunda_mano";
  return fetchGarajeCondicion(supabase, {
    garajeMotoId: compra.garajeMotoId,
    placa: compra.placa,
  });
}
