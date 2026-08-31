"use client";

import Link from "next/link";
import { Banknote, IdCard, MapPin, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ITEMS = [
  {
    id: "garaje" as const,
    title: "Garaje",
    description:
      "Motos en el patio. Las vendidas de aquí están en la vista Vendidas del garaje.",
    href: "/garaje",
    secondaryHref: "/garaje?vista=vendidas",
    secondaryLabel: "Ver vendidas",
    icon: Warehouse,
    preset: "Lista las motos del garaje en patio",
  },
  {
    id: "contado" as const,
    title: "Venta de contado",
    description: "Registrar o revisar ventas al contado en mostrador.",
    href: "/venta-contado?nuevo=1",
    icon: Banknote,
    preset: "Lista las ventas de moto al contado de hoy",
  },
  {
    id: "clientes" as const,
    title: "Con clientes",
    description: "Motos de crédito que ya tiene el cliente.",
    href: "/vendidas",
    icon: MapPin,
    preset: "Lista las motos con clientes (crédito entregado)",
  },
  {
    id: "licencias" as const,
    title: "Licencias",
    description: "Fotos de licencias de tránsito por placa.",
    href: "/tarjetas-propiedad",
    icon: IdCard,
    preset: "Lista las licencias de tránsito registradas",
  },
] as const;

export function AgentMotosWork({
  onPreset,
  hideConClientes = false,
  compact = false,
}: {
  onPreset: (text: string) => void;
  hideConClientes?: boolean;
  compact?: boolean;
}) {
  const items = hideConClientes
    ? ITEMS.filter((item) => item.id !== "clientes")
    : ITEMS;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Elige un trabajo o pide al agente con un clic.
      </p>
      <div className={compact ? "grid gap-2" : "grid gap-3 sm:grid-cols-2"}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} size={compact ? "sm" : "default"}>
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon
                    className="size-4 shrink-0"
                    aria-hidden
                    strokeWidth={1.75}
                  />
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                  >
                    <Link href={item.href}>Abrir</Link>
                  </Button>
                  {"secondaryHref" in item && item.secondaryHref ? (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="min-h-11"
                    >
                      <Link href={item.secondaryHref}>
                        {item.secondaryLabel}
                      </Link>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="min-h-11"
                    onClick={() => onPreset(item.preset)}
                  >
                    Preguntar al agente
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
