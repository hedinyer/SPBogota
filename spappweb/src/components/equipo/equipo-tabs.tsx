"use client";

import type { LeaderboardRow, ReferralLeaderboardRow } from "@/lib/referrals";
import type {
  EquipoVisitasDetalle as EquipoVisitasDetalleData,
  VisitadorRow,
} from "@/lib/pipeline/types";
import { EquipoReferralCards } from "@/components/equipo/equipo-referral-cards";
import { EquipoLeaderboard } from "@/components/equipo/equipo-leaderboard";
import { EquipoVisitasDetalle } from "@/components/equipo/equipo-visitas-detalle";
import { VisitadoresManager } from "@/components/visitadores/visitadores-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function EquipoTabs({
  visitadores,
  leaderboard,
  linkLeaderboard,
  visitasDetalle,
}: {
  visitadores: VisitadorRow[];
  leaderboard: ReferralLeaderboardRow[];
  linkLeaderboard: ReferralLeaderboardRow[];
  visitasDetalle: EquipoVisitasDetalleData & {
    leaderboard: LeaderboardRow[];
  };
}) {
  return (
    <Tabs defaultValue="vendedores">
      <TabsList className="h-auto w-full max-w-full gap-1 overflow-x-auto p-1">
        <TabsTrigger
          value="visitadores"
          className="min-h-11 flex-1 touch-manipulation px-3 sm:min-h-8"
        >
          Visitadores
        </TabsTrigger>
        <TabsTrigger
          value="vendedores"
          className="min-h-11 flex-1 touch-manipulation px-3 sm:min-h-8"
        >
          Vendedores
        </TabsTrigger>
        <TabsTrigger
          value="metricas"
          className="min-h-11 flex-1 touch-manipulation px-3 sm:min-h-8"
        >
          Métricas
        </TabsTrigger>
      </TabsList>

      <TabsContent value="visitadores" className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Personas que realizan visitas domiciliarias.
        </p>
        <VisitadoresManager visitadores={visitadores} />
      </TabsContent>

      <TabsContent value="vendedores" className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Links de hoja de vida para atribución de comisiones.
        </p>
        <EquipoReferralCards />
      </TabsContent>

      <TabsContent value="metricas" className="flex flex-col gap-12 pt-2">
        <EquipoLeaderboard
          rows={leaderboard}
          emptyMessage="Aún no hay compras a crédito atribuidas."
          totalLabel={(n) =>
            `${n} compra${n === 1 ? "" : "s"} a crédito atribuidas`
          }
        />
        <EquipoLeaderboard
          rows={linkLeaderboard}
          title="¿Quién trae más clientes usando el link?"
          emptyMessage="Aún no hay hojas de vida atribuidas."
          totalLabel={(n) =>
            `${n} hoja${n === 1 ? "" : "s"} de vida atribuidas`
          }
        />
        <EquipoVisitasDetalle
          leaderboard={visitasDetalle.leaderboard}
          asignadas={visitasDetalle.asignadas}
          completadas={visitasDetalle.completadas}
        />
      </TabsContent>
    </Tabs>
  );
}
