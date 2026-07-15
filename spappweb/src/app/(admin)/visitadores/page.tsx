import {
  getAllVisitadores,
  getReferralLeaderboard,
} from "@/lib/pipeline/queries";
import { EquipoTabs } from "@/components/equipo/equipo-tabs";
import { PageHeader } from "@/components/layout/page-header";

export default async function VisitadoresPage() {
  const [visitadores, leaderboard] = await Promise.all([
    getAllVisitadores(),
    getReferralLeaderboard(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Equipo"
        description="Visitadores, vendedores y ranking de captación."
      />
      <EquipoTabs visitadores={visitadores} leaderboard={leaderboard} />
    </div>
  );
}
