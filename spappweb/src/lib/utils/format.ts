export { formatCop } from "./format-cop";

function esCo(date: Date, options: Intl.DateTimeFormatOptions): string {
  // Node y el navegador no usan el mismo espacio en "p. m." (U+00A0 / U+202F).
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    ...options,
  })
    .format(date)
    .replace(/[\u00a0\u202f]/g, " ");
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return esCo(d, { dateStyle: "medium", timeStyle: "short" });
}

export function formatDateOnly(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return esCo(d, { dateStyle: "medium" });
}

export { formatCuotas } from "@/lib/payments/payment-metrics";
