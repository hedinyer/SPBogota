import { getAllTarjetasPropiedad } from "@/lib/pipeline/queries";
import { TarjetasPropiedadManager } from "@/components/tarjetas/tarjetas-propiedad-manager";
import { AdminScopedHubSubnav } from "@/components/layout/admin-scoped-hub-subnav";
import { PageHeader } from "@/components/layout/page-header";

export default async function TarjetasPropiedadPage() {
  const tarjetas = await getAllTarjetasPropiedad();

  return (
    <div className="flex flex-col gap-6">
      <AdminScopedHubSubnav hubId="motos" />
      <PageHeader
        title="Licencias"
        description={
          <>
            Archiva frente y reverso de licencias de tránsito con su placa.
            Consulta pública:{" "}
            <a href="/licencias" className="underline underline-offset-2">
              /licencias
            </a>
          </>
        }
      />
      <TarjetasPropiedadManager tarjetas={tarjetas} />
    </div>
  );
}
