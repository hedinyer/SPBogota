"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Bike } from "lucide-react";
import { AgentChat } from "@/components/agente/agent-chat";
import { findNavGroupByPathname } from "@/components/layout/admin-nav-links";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function pageSubtitle(pathname: string, search: string): string {
  const qs = new URLSearchParams(search.replace(/^\?/, ""));
  if (pathname.startsWith("/garaje/nueva")) return "Registrar moto en garaje";
  if (pathname.startsWith("/garaje")) {
    if (qs.get("tab") === "modelos") return "Modelos del catálogo";
    if (qs.get("vista") === "vendidas") return "Vendidas del patio";
    return "Patio y unidades físicas";
  }
  if (pathname.startsWith("/venta-contado")) return "Venta de contado";
  if (pathname.startsWith("/vendidas")) return "Motos con clientes";
  if (pathname.startsWith("/tarjetas-propiedad")) return "Licencias de tránsito";
  return "Área Motos";
}

function MotosAgentFabInner({ hideEquipo }: { hideEquipo: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const search = searchParams.toString();
  const searchWithQ = search ? `?${search}` : "";

  const showFab = useMemo(() => {
    if (pathname.startsWith("/agente")) return false;
    const group = findNavGroupByPathname(pathname);
    if (group?.id !== "motos") return false;
    if (hideEquipo && pathname.startsWith("/vendidas")) return false;
    return true;
  }, [pathname, hideEquipo]);

  if (!showFab) return null;

  return (
    <>
      <Button
        type="button"
        size="icon"
        className="fixed z-40 size-12 min-h-11 min-w-11 rounded-full shadow-lg bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))]"
        aria-label="Asistente Motos"
        aria-expanded={open}
        aria-controls="asistente-motos-panel"
        onClick={() => setOpen(true)}
      >
        <Bike className="size-5" strokeWidth={1.75} aria-hidden />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          id="asistente-motos-panel"
          side="bottom"
          className="left-auto right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(4.25rem,calc(3.25rem+1rem+env(safe-area-inset-bottom)))] flex h-[min(70dvh,34rem)] w-[min(calc(100vw-1.5rem),24rem)] max-w-[24rem] flex-col gap-0 overflow-hidden rounded-xl border border-border p-0 shadow-xl data-[side=bottom]:left-auto data-[side=bottom]:right-[max(0.75rem,env(safe-area-inset-right))] data-[side=bottom]:bottom-[max(4.25rem,calc(3.25rem+1rem+env(safe-area-inset-bottom)))] data-[side=bottom]:h-[min(70dvh,34rem)] data-[side=bottom]:border"
        >
          <SheetHeader className="shrink-0 border-b border-border py-3 pr-12">
            <SheetTitle>Asistente Motos</SheetTitle>
            <SheetDescription>
              {pageSubtitle(pathname, searchWithQ)}
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-2">
            <AgentChat
              mode="motos"
              compact
              hideConClientes={hideEquipo}
              pageContext={{ pathname, search: searchWithQ }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function MotosAgentFab({ hideEquipo = false }: { hideEquipo?: boolean }) {
  return (
    <Suspense fallback={null}>
      <MotosAgentFabInner hideEquipo={hideEquipo} />
    </Suspense>
  );
}
