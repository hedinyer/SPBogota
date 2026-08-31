"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  loadInboxQueue,
  loadSolicitudesInbox,
} from "@/lib/actions/agent-work-actions";
import type { InboxListItem } from "@/lib/pipeline/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AgentInboxQueue = "solicitudes" | "morosos" | "recoger";

const COPY: Record<
  AgentInboxQueue,
  {
    title: string;
    description: string;
    empty: string;
    loading: string;
    searchLabel: string;
    badge: string;
    badgeClass: string;
    action: (firstName: string) => string;
  }
> = {
  solicitudes: {
    title: "Revisar solicitudes",
    description: "Elige a quién revisar. Solo ves pendientes.",
    empty: "No hay solicitudes. Cuando alguien envíe una, aparece aquí.",
    loading: "Cargando solicitudes…",
    searchLabel: "Buscar solicitudes",
    badge: "Pendiente",
    badgeClass: "",
    action: (first) => `Revisar a ${first}`,
  },
  morosos: {
    title: "Clientes en mora",
    description: "Elige a quién cobrar. A los 3 días toca avisar.",
    empty:
      "No hay clientes en mora. Cuando alguien llegue a 3 días, aparece aquí.",
    loading: "Cargando clientes en mora…",
    searchLabel: "Buscar clientes en mora",
    badge: "Mora",
    badgeClass: "border-amber-300 bg-background font-normal text-amber-900",
    action: (first) => `Cobrar a ${first}`,
  },
  recoger: {
    title: "Motos para recoger",
    description: "Elige de quién recoger la moto. A los 4 o más días toca recoger.",
    empty:
      "No hay motos para recoger. Cuando alguien llegue a 4 días, aparece aquí.",
    loading: "Cargando motos para recoger…",
    searchLabel: "Buscar motos para recoger",
    badge: "Para recoger",
    badgeClass: "border-red-200 bg-background font-normal text-red-800",
    action: (first) => `Recoger moto de ${first}`,
  },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

type AgentInboxWorkProps = {
  queue: AgentInboxQueue;
  onOpen: (userId: number, displayName: string) => void;
};

export function AgentInboxWork({ queue, onOpen }: AgentInboxWorkProps) {
  const copy = COPY[queue];
  const [items, setItems] = useState<InboxListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list =
          queue === "solicitudes"
            ? await loadSolicitudesInbox()
            : await loadInboxQueue(queue);
        if (!cancelled) setItems(list);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo cargar la lista. Vuelve a intentarlo.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queue]);

  const visible = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.displayName, item.cedula, item.celular, item.username, item.subtitle]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [items, search]);

  return (
    <Card className="w-full max-w-xl ring-foreground/10">
      <CardHeader>
        <CardTitle className="text-balance">{copy.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {items === null && !error ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            {copy.loading}
          </p>
        ) : null}

        {items && items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {copy.empty}
          </p>
        ) : null}

        {items && items.length > 0 ? (
          <>
            {items.length > 8 ? (
              <div className="relative">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, cédula o celular…"
                  className="min-h-11 pl-9"
                  aria-label={copy.searchLabel}
                />
              </div>
            ) : null}

            {visible.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay clientes que coincidan con &quot;{search.trim()}&quot;.
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                {visible.map((item) => {
                  const first = item.displayName.split(/\s+/)[0] || item.displayName;
                  return (
                    <li
                      key={item.userId}
                      className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="!size-14 shrink-0 after:rounded-full">
                          {item.selfieUrl ? (
                            <AvatarImage
                              src={item.selfieUrl}
                              alt={`Selfie de ${item.displayName}`}
                            />
                          ) : null}
                          <AvatarFallback>
                            {initials(item.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {item.displayName}
                          </p>
                          <p className="truncate text-sm tabular-nums text-muted-foreground">
                            {queue === "solicitudes"
                              ? [
                                  item.cedula ? `C.C. ${item.cedula}` : null,
                                  item.celular || null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || `@${item.username}`
                              : item.subtitle}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("shrink-0", copy.badgeClass)}
                        >
                          {copy.badge}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        size="lg"
                        className="min-h-11 w-full shrink-0 sm:w-auto"
                        onClick={() => onOpen(item.userId, item.displayName)}
                      >
                        {copy.action(first)}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
