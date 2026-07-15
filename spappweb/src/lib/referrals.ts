/** Fuentes de captación con link propio de hoja de vida (comisiones). */
export const REFERRAL_SOURCES = [
  { slug: "punto-de-venta", label: "Punto de venta" },
  { slug: "guillen", label: "Guillen" },
  { slug: "yhosmer", label: "Yhosmer" },
] as const;

export type ReferralSlug = (typeof REFERRAL_SOURCES)[number]["slug"];

const KNOWN = new Set(REFERRAL_SOURCES.map((s) => s.slug));

/** Solo acepta slugs conocidos (ignora basura en la URL). */
export function parseReferralSource(
  raw: string | null | undefined,
): string | null {
  const slug = raw?.trim().toLowerCase();
  if (!slug || !KNOWN.has(slug as ReferralSlug)) return null;
  return slug;
}

export function referralLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const found = REFERRAL_SOURCES.find((s) => s.slug === slug);
  return found?.label ?? slug;
}

export type ReferralLeaderboardRow = {
  slug: ReferralSlug;
  label: string;
  count: number;
  rank: number;
};

/** Ranking por clientes captados; empates comparten rango. */
export function buildReferralLeaderboard(
  counts: Record<string, number>,
): ReferralLeaderboardRow[] {
  const rows = REFERRAL_SOURCES.map((s) => ({
    slug: s.slug,
    label: s.label,
    count: counts[s.slug] ?? 0,
  })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  let rank = 0;
  let prev = -1;
  return rows.map((row, i) => {
    if (row.count !== prev) {
      rank = i + 1;
      prev = row.count;
    }
    return { ...row, rank };
  });
}
