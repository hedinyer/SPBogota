import type { TarifaEstado } from "@/lib/pipeline/types";

export const TARIFA_ABONO_ADELANTADO = "Pago adelantado siguiente cuota";
export const TARIFA_ABONO_PARCIAL = "Pago parcial";

const ESTADO_LABELS: Record<TarifaEstado, string> = {
  pendiente: "Pendiente",
  pagada: "Pagada",
  vencida: "Vencida",
};

export function tarifaAbonoLabel(tarifa: {
  monto_pagado: number | null;
  monto_esperado: number;
  estado: TarifaEstado;
}): string {
  const pagado = tarifa.monto_pagado ?? 0;
  if (pagado > tarifa.monto_esperado) return TARIFA_ABONO_ADELANTADO;
  if (pagado > 0 && pagado < tarifa.monto_esperado) {
    return tarifa.estado === "vencida"
      ? TARIFA_ABONO_PARCIAL
      : TARIFA_ABONO_ADELANTADO;
  }
  return ESTADO_LABELS[tarifa.estado];
}
