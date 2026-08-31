/** Código de seguimiento: SPB-XXXXXXXX (A–Z / 2–9, sin ambiguos). */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const ENVIOS_ESTADOS = [
  "preparando",
  "en_camino",
  "en_destino",
  "entregado",
  "cancelado",
] as const;

export type EnvioEstado = (typeof ENVIOS_ESTADOS)[number];

export const ENVIO_ESTADO_LABEL: Record<EnvioEstado, string> = {
  preparando: "Preparando",
  en_camino: "En camino",
  en_destino: "En destino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export function normalizarCodigoEnvio(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function esCodigoEnvioValido(codigo: string): boolean {
  return /^SPB-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(
    normalizarCodigoEnvio(codigo),
  );
}

export function generarCodigoEnvio(randomBytes?: Uint8Array): string {
  const bytes = randomBytes ?? crypto.getRandomValues(new Uint8Array(8));
  let body = "";
  for (let i = 0; i < 8; i++) {
    body += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return `SPB-${body}`;
}
