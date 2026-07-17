import {
  getAllVisitadores,
  getEquipoVisitasDetalle,
  getReferralLeaderboard,
  getReferralLinkLeaderboard,
} from "@/lib/pipeline/queries";
import { EquipoTabs } from "@/components/equipo/equipo-tabs";
import { PageHeader } from "@/components/layout/page-header";

export default async function VisitadoresPage() {
  const [visitadores, leaderboard, linkLeaderboard, visitasDetalle] =
    await Promise.all([
      getAllVisitadores(),
      getReferralLeaderboard(),
      getReferralLinkLeaderboard(),
      getEquipoVisitasDetalle(),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Equipo"
        description="Visitadores, vendedores y ranking de captación."
      />
      <EquipoTabs
        visitadores={visitadores}
        leaderboard={leaderboard}
        linkLeaderboard={linkLeaderboard}
        visitasDetalle={visitasDetalle}
      />
    </div>
  );
}
