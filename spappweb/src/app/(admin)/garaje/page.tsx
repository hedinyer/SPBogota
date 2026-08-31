import { Suspense } from "react";
import {
  getAllBikes,
  getAllGarajeMotos,
  getAllGarajeParqueaderos,
  getAllProductos,
  getGarajeMantenimientoItemsByMotoIds,
  getGarajeMotosVendidas,
} from "@/lib/pipeline/queries";
import { countStockSegundaMano } from "@/lib/garaje/stock-segunda";
import { GarajeManager } from "@/components/garaje/garaje-manager";
import { AdminScopedHubSubnav } from "@/components/layout/admin-scoped-hub-subnav";
import { PageHeader } from "@/components/layout/page-header";

export default async function GarajePage({
  searchParams,
}: {
  searchParams: Promise<{
    fotoPendiente?: string;
    tab?: string;
    vista?: string;
  }>;
}) {
  const params = await searchParams;

  const [parqueaderos, motos, productos, bikes, motosGaraje, motosVendidas] =
    await Promise.all([
      getAllGarajeParqueaderos(),
      getAllGarajeMotos(),
      getAllProductos(),
      getAllBikes(),
      getAllGarajeMotos(),
      getGarajeMotosVendidas(),
    ]);

  const stockNuevo = bikes.filter((b) => b.activo && b.stock > 0);
  const stockSegunda = countStockSegundaMano(motosGaraje);

  const motosConMantenimiento = motos.filter(
    (m) =>
      m.estado === "en_mantenimiento" ||
      m.estado === "disponible" ||
      m.estado === "retenida",
  );

  const mantenimientoByMoto = await getGarajeMantenimientoItemsByMotoIds(
    motosConMantenimiento.map((m) => m.id),
  );

  return (
    <div className="flex flex-col gap-6">
      <AdminScopedHubSubnav hubId="motos" />
      <PageHeader
        title="Garaje"
        description="Motos en el patio, las que ya se vendieron de aquí, y los modelos con precio."
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando garaje…</p>}>
        <GarajeManager
          parqueaderos={parqueaderos}
          motos={motos}
          stockNuevo={stockNuevo}
          productos={productos}
          mantenimientoByMoto={mantenimientoByMoto}
          initialFotoPendiente={params.fotoPendiente === "1"}
          bikes={bikes}
          stockSegunda={stockSegunda}
          motosVendidas={motosVendidas}
        />
      </Suspense>
    </div>
  );
}
