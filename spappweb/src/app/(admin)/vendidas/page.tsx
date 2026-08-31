import { getAllVendidasMotos } from "@/lib/pipeline/queries";
import { VendidasManager } from "@/components/vendidas/vendidas-manager";
import { AdminScopedHubSubnav } from "@/components/layout/admin-scoped-hub-subnav";
import { PageHeader } from "@/components/layout/page-header";

export default async function VendidasPage() {
  const motos = await getAllVendidasMotos();

  return (
    <div className="flex flex-col gap-6">
      <AdminScopedHubSubnav hubId="motos" />
      <PageHeader
        title="Con clientes"
        description="Motos de crédito que ya tiene el cliente: estado físico, mora y acciones."
      />
      <VendidasManager motos={motos} />
    </div>
  );
}
