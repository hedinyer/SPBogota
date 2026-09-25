export { formatCop } from "./format-cop";

/** Partes fijas en Bogotá — dateStyle/es-CO cambia entre Node y Chrome. */
function bogotaYmdHm(date: Date) {
  const map = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: Number(map.hour),
    minute: map.minute,
  };
}

function asDate(date: string | Date | null | undefined): Date | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(date: string | Date | null | undefined): string {
  const d = asDate(date);
  if (!d) return "—";
  const p = bogotaYmdHm(d);
  const hour12 = p.hour % 12 || 12;
  const period = p.hour < 12 ? "a. m." : "p. m.";
  return `${Number(p.day)}/${p.month}/${p.year}, ${hour12}:${p.minute} ${period}`;
}

export function formatDateOnly(date: string | Date | null | undefined): string {
  const d = asDate(date);
  if (!d) return "—";
  const p = bogotaYmdHm(d);
  return `${Number(p.day)}/${p.month}/${p.year}`;
}

export { formatCuotas } from "@/lib/payments/payment-metrics";
