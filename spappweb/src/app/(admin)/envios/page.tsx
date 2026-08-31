import { AdminHubSubnav } from "@/components/layout/admin-hub-subnav";
import { PageHeader } from "@/components/layout/page-header";
import { EnviosManager } from "@/components/envios/envios-manager";
import { listEnvios } from "@/lib/actions/envio-actions";

export const metadata = { title: "Envíos" };

export default async function EnviosPage() {
  const envios = await listEnvios().catch(() => []);

  return (
    <div className="flex flex-col gap-6">
      <AdminHubSubnav hubId="tienda" />
      <PageHeader
        title="Envíos"
        description="Crea guías de seguimiento, actualiza el estado y comparte el link o la imagen con el cliente."
      />
      <EnviosManager initial={envios} />
    </div>
  );
}
