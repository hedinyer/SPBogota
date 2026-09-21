import type { FrecuenciaPago } from "@/lib/pipeline/types";

export type ContratoHistorialEntry = {
  renovado_at: string;
  frecuencia_pago: FrecuenciaPago;
  monto_cuota_periodo: number;
  fecha_inicio: string | null;
  periodos_debidos: number | null;
  periodos_pagados: number | null;
  monto_pagado: number | null;
  monto_adeudado_perdonado: number;
  modelo: string | null;
  placa: string | null;
  signed_at: string | null;
  contrato_pdf_path: string | null;
  digital_contract_id: string | null;
};

export function appendContratoHistorial(
  adminData: Record<string, unknown> | null | undefined,
  entry: ContratoHistorialEntry,
): Record<string, unknown> {
  const prev = adminData ?? {};
  const raw = prev.contrato_historial;
  const hist = Array.isArray(raw)
    ? [...(raw as ContratoHistorialEntry[])]
    : [];
  hist.push(entry);
  return { ...prev, contrato_historial: hist };
}

export function parseContratoHistorial(
  adminData: Record<string, unknown> | null | undefined,
): ContratoHistorialEntry[] {
  const raw = adminData?.contrato_historial;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is ContratoHistorialEntry =>
      e != null &&
      typeof e === "object" &&
      typeof (e as ContratoHistorialEntry).renovado_at === "string" &&
      typeof (e as ContratoHistorialEntry).monto_adeudado_perdonado === "number",
  );
}

export function getContratoRenovacionPdfPath(
  adminData: Record<string, unknown> | null | undefined,
): string | null {
  const path = adminData?.contrato_renovacion_pdf_path;
  return typeof path === "string" && path.length > 0 ? path : null;
}
