/** Fuentes de captación con link propio de hoja de vida (comisiones). */
export const REFERRAL_SOURCES = [
  { slug: "punto-de-venta", label: "Punto de venta" },
  { slug: "guillen", label: "Guillen" },
  { slug: "yhosmer", label: "Yhosmer" },
  { slug: "fabian", label: "Fabian" },
] as const;

export type ReferralSlug = (typeof REFERRAL_SOURCES)[number]["slug"];

/** ponytail: este deploy es solo Guillén; otro captador = otro deploy o quitar el scope */
export const APP_REFERRAL_SCOPE: ReferralSlug = "guillen";

export function isInReferralScope(
  referralSource: string | null | undefined,
): boolean {
  return referralSource === APP_REFERRAL_SCOPE;
}

const KNOWN = new Set(REFERRAL_SOURCES.map((s) => s.slug));

/** Solo acepta slugs conocidos (ignora basura en la URL). */
export function parseReferralSource(
  raw: string | null | undefined,
): string | null {
  const slug = raw?.trim().toLowerCase();
  if (!slug || !KNOWN.has(slug as ReferralSlug)) return null;
  return slug;
}

/**
 * Sin `ref` válido en este deploy = Guillén (APP_REFERRAL_SCOPE).
 * ponytail: si WhatsApp/el draft pierden ?ref=, el registro igual cuenta para Guillén.
 */
export function resolveReferralSource(
  raw: string | null | undefined,
): ReferralSlug {
  return (parseReferralSource(raw) as ReferralSlug | null) ?? APP_REFERRAL_SCOPE;
}

export function referralLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const found = REFERRAL_SOURCES.find((s) => s.slug === slug);
  return found?.label ?? slug;
}

/** Referidos cuya visita solo puede ir al visitador con el mismo nombre.
 *  ponytail: APP_REFERRAL_SCOPE (guillen) NO usa este lock — puede asignar a todo su equipo. */
export const REFERRAL_LOCKED_VISITADOR_SLUGS = ["yhosmer"] as const;

function normalizeVisitadorSlug(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "-");
}

export function visitadorMatchesReferral(
  visitadorNombre: string,
  referralSlug: ReferralSlug,
): boolean {
  return normalizeVisitadorSlug(visitadorNombre) === referralSlug;
}

/**
 * Guillen (este deploy): todos los visitadores del equipo (él + ayudantes).
 * Yhosmer (legacy): solo el visitador homónimo.
 * Resto: cualquiera.
 */
export function filterVisitadoresForReferral<T extends { nombre: string }>(
  visitadores: T[],
  referralSource: string | null | undefined,
): T[] {
  const slug = resolveReferralSource(referralSource);
  if (slug === APP_REFERRAL_SCOPE) return visitadores;
  if (
    !(REFERRAL_LOCKED_VISITADOR_SLUGS as readonly string[]).includes(slug)
  ) {
    return visitadores;
  }
  return visitadores.filter((v) => visitadorMatchesReferral(v.nombre, slug));
}

export function assertVisitadorAllowedForReferral(
  visitadorNombre: string,
  referralSource: string | null | undefined,
): void {
  const slug = resolveReferralSource(referralSource);
  if (slug === APP_REFERRAL_SCOPE) return;
  if (
    !(REFERRAL_LOCKED_VISITADOR_SLUGS as readonly string[]).includes(slug)
  ) {
    return;
  }
  if (!visitadorMatchesReferral(visitadorNombre, slug)) {
    const label = referralLabel(slug) ?? slug;
    throw new Error(
      `Este cliente fue referido por ${label}. La visita solo puede asignarse a ${label}.`,
    );
  }
}

export type LeaderboardRow = {
  slug: string;
  label: string;
  count: number;
  rank: number;
};

export type ReferralLeaderboardRow = LeaderboardRow;

/** Empates comparten rango. */
export function rankLeaderboard(
  rows: { slug: string; label: string; count: number }[],
): LeaderboardRow[] {
  const sorted = [...rows].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );
  let rank = 0;
  let prev = -1;
  return sorted.map((row, i) => {
    if (row.count !== prev) {
      rank = i + 1;
      prev = row.count;
    }
    return { ...row, rank };
  });
}

/** Ranking por clientes captados; empates comparten rango. */
export function buildReferralLeaderboard(
  counts: Record<string, number>,
): ReferralLeaderboardRow[] {
  return rankLeaderboard(
    REFERRAL_SOURCES.map((s) => ({
      slug: s.slug,
      label: s.label,
      count: counts[s.slug] ?? 0,
    })),
  );
}
