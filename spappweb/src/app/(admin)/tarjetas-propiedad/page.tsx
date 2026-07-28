import { getAllTarjetasPropiedad } from "@/lib/pipeline/queries";
import { TarjetasPropiedadManager } from "@/components/tarjetas/tarjetas-propiedad-manager";
import { AdminHubSubnav } from "@/components/layout/admin-hub-subnav";
import { PageHeader } from "@/components/layout/page-header";

export default async function TarjetasPropiedadPage() {
  const tarjetas = await getAllTarjetasPropiedad();

  return (
    <div className="flex flex-col gap-6">
      <AdminHubSubnav hubId="motos" />
      <PageHeader
        title="Tarjetas de propiedad"
        description="Sube frente y reverso de Licencias de Tránsito, lee los datos con OCR y archívalos."
      />
      <TarjetasPropiedadManager tarjetas={tarjetas} />
    </div>
  );
}
