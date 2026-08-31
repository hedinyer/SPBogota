export const COBRANZA_ACCIONES = [
  "whatsapp",
  "gps_on",
  "gps_off",
  "regularizado",
  "recogida",
] as const;

export type CobranzaAccion = (typeof COBRANZA_ACCIONES)[number];

export type CobranzaAccionRow = {
  id: string;
  userId: number;
  accion: CobranzaAccion;
  texto: string | null;
  createdAt: string;
};

export const COBRANZA_ACCION_LABELS: Record<CobranzaAccion, string> = {
  whatsapp: "WhatsApp enviado",
  gps_on: "GPS activado",
  gps_off: "GPS desactivado",
  regularizado: "Cliente regularizado",
  recogida: "Moto recogida",
};

export type WhatsAppDraftInput = {
  nombre: string;
  cedula: string | null;
  placa: string | null;
  dias: number;
  monto: number;
  etapa: "mora" | "recoger";
};

/** Prompt para que Hermes redacte un WhatsApp listo para copiar. */
export function buildWhatsAppDraftPrompt(input: WhatsAppDraftInput): string {
  const nombre = input.nombre.trim() || "cliente";
  const cedula = input.cedula?.trim() || "sin cédula";
  const placa = input.placa?.trim() || "sin placa";
  const etapa =
    input.etapa === "recoger"
      ? "La moto ya está para recoger (4 o más días de atraso)."
      : "Está en mora (3 días de atraso).";

  return `Redacta un WhatsApp corto para copiar y pegar.
Cliente ${nombre}, cédula ${cedula}, placa ${placa}, ${input.dias} días de atraso, debe ${input.monto} COP.
${etapa}
Tono serio, español de Colombia, firma Soluciones Pinilla.
Solo el texto del mensaje, sin comillas ni explicaciones.`;
}
