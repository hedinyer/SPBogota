/** Fuentes de captación con link propio de hoja de vida (comisiones). */
export const REFERRAL_SOURCES = [
  { slug: "punto-de-venta", label: "Punto de venta" },
  { slug: "guillen", label: "Guillen" },
  { slug: "yhosmer", label: "Yhosmer" },
  { slug: "fabian", label: "Fabian" },
] as const;

export type ReferralSlug = (typeof REFERRAL_SOURCES)[number]["slug"];

/**
 * Captadores que no se mezclan en colas/listas generales.
 * Sus clientes van en la card "Clientes (Guillen)" (y siguen operables
 * desde la ficha / colas de trabajo). El link público ?ref= sigue guardando
 * referral_source.
 */
export const HIDDEN_REFERRAL_SLUGS = ["guillen"] as const;

export function isHiddenReferral(raw: string | null | undefined): boolean {
  const slug = raw?.trim().toLowerCase();
  return (
    !!slug &&
    (HIDDEN_REFERRAL_SLUGS as readonly string[]).includes(slug)
  );
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
 * Sin `ref` (URL /hojadevida) = punto de venta.
 * También vale ?ref=punto-de-venta.
 * ?ref=guillen se guarda como guillen (oculto en este admin).
 */
export function resolveReferralSource(
  raw: string | null | undefined,
): ReferralSlug {
  return (parseReferralSource(raw) as ReferralSlug | null) ?? "punto-de-venta";
}

export function referralLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const found = REFERRAL_SOURCES.find((s) => s.slug === slug);
  return found?.label ?? slug;
}

/** Referidos cuya visita solo puede ir al visitador con el mismo nombre. */
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

/** Punto de venta / Fabian / Guillen → todos; Yhosmer → solo el visitador homónimo. */
export function filterVisitadoresForReferral<T extends { nombre: string }>(
  visitadores: T[],
  referralSource: string | null | undefined,
): T[] {
  const slug = resolveReferralSource(referralSource);
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
    REFERRAL_SOURCES.filter((s) => !isHiddenReferral(s.slug)).map((s) => ({
      slug: s.slug,
      label: s.label,
      count: counts[s.slug] ?? 0,
    })),
  );
}

/** Ciclo de comisiones: día 20 del mes M → día 5 del mes M+1 (ambos inclusive, Bogotá). */
export type CommissionPeriod = {
  /** Mes de inicio YYYY-MM (el que contiene el día 20). */
  key: string;
  startIso: string;
  endExclusiveIso: string;
  label: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function bogotaYmd(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? NaN);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** Instantáneo Bogotá → ISO UTC. Fin exclusivo = día 6 00:00. */
function bogotaDayStartIso(y: number, m: number, d: number) {
  return new Date(
    `${y}-${pad2(m)}-${pad2(d)}T00:00:00.000-05:00`,
  ).toISOString();
}

function addCalendarMonths(y: number, m: number, delta: number) {
  const idx = y * 12 + (m - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

const MONTH_LABEL = new Intl.DateTimeFormat("es-CO", {
  month: "short",
  timeZone: "UTC",
});

function monthShort(y: number, m: number) {
  return MONTH_LABEL.format(new Date(Date.UTC(y, m - 1, 1))).replace(/\.$/, "");
}

export function commissionPeriodFromKey(key: string): CommissionPeriod | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const next = addCalendarMonths(y, month, 1);
  const startIso = bogotaDayStartIso(y, month, 20);
  const endExclusiveIso = bogotaDayStartIso(next.y, next.m, 6);
  return {
    key: `${y}-${pad2(month)}`,
    startIso,
    endExclusiveIso,
    label: `20 ${monthShort(y, month)} – 5 ${monthShort(next.y, next.m)} ${next.y}`,
  };
}

/** Periodo de comisión vigente para `now` (si día 6–19 → el cerrado más reciente). */
export function currentCommissionPeriod(now = new Date()): CommissionPeriod {
  const { y, m, d } = bogotaYmd(now);
  let startY = y;
  let startM = m;
  if (d < 20) {
    const prev = addCalendarMonths(y, m, -1);
    startY = prev.y;
    startM = prev.m;
  }
  return commissionPeriodFromKey(`${startY}-${pad2(startM)}`)!;
}

export function shiftCommissionPeriod(
  key: string,
  deltaMonths: number,
): CommissionPeriod | null {
  const cur = commissionPeriodFromKey(key);
  if (!cur) return null;
  const [y, m] = cur.key.split("-").map(Number);
  const next = addCalendarMonths(y, m, deltaMonths);
  return commissionPeriodFromKey(`${next.y}-${pad2(next.m)}`);
}
