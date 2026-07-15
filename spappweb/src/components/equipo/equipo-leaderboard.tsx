import type { ReferralLeaderboardRow } from "@/lib/referrals";
import { cn } from "@/lib/utils";

const PODIUM = [
  {
    rank: 1,
    bar: "h-36 sm:h-44",
    chip: "bg-amber-400 text-amber-950",
    barBg: "bg-amber-400/90",
  },
  {
    rank: 2,
    bar: "h-28 sm:h-36",
    chip: "bg-slate-300 text-slate-900",
    barBg: "bg-slate-300/90",
  },
  {
    rank: 3,
    bar: "h-20 sm:h-28",
    chip: "bg-orange-300 text-orange-950",
    barBg: "bg-orange-300/90",
  },
] as const;

/** Orden visual de podio: 2.º · 1.º · 3.º */
function podiumOrder(rows: ReferralLeaderboardRow[]) {
  const byRank = (r: number) => rows.find((row) => row.rank === r) ?? null;
  return [byRank(2), byRank(1), byRank(3)].filter(
    (r): r is ReferralLeaderboardRow => r != null,
  );
}

export function EquipoLeaderboard({
  rows,
}: {
  rows: ReferralLeaderboardRow[];
}) {
  const top = podiumOrder(rows);
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Leaderboard
        </p>
        <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          ¿Quién trae más clientes?
        </h2>
        <p className="mt-2 text-muted-foreground">
          {total === 0
            ? "Aún no hay captaciones con link de vendedor."
            : `${total} cliente${total === 1 ? "" : "s"} atribuidos`}
        </p>
      </div>

      <div className="flex items-end justify-center gap-3 sm:gap-6">
        {top.map((row) => {
          const style = PODIUM.find((p) => p.rank === row.rank) ?? PODIUM[2];
          const isFirst = row.rank === 1;
          return (
            <div
              key={row.slug}
              className={cn(
                "flex w-28 flex-col items-center sm:w-36",
                isFirst && "relative z-10",
              )}
            >
              <p
                className={cn(
                  "mb-2 line-clamp-2 text-center text-sm font-semibold sm:text-base",
                  isFirst && "text-lg sm:text-xl",
                )}
              >
                {row.label}
              </p>
              <p
                className={cn(
                  "mb-3 tabular-nums font-semibold",
                  isFirst ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl",
                )}
              >
                {row.count}
              </p>
              <div
                className={cn(
                  "flex w-full flex-col items-center justify-start rounded-t-2xl pt-4 shadow-sm",
                  style.bar,
                  style.barBg,
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-10 items-center justify-center rounded-full text-lg font-bold",
                    style.chip,
                  )}
                >
                  {row.rank}º
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <ul className="mx-auto w-full max-w-md divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
        {rows.map((row) => (
          <li
            key={row.slug}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="w-8 text-center text-sm font-semibold tabular-nums text-muted-foreground">
                {row.rank}º
              </span>
              <span className="truncate font-medium">{row.label}</span>
            </div>
            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
              {row.count}{" "}
              {row.count === 1 ? "cliente" : "clientes"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
