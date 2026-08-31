export type GarajeTab = "motos" | "modelos" | "parqueaderos";
export type GarajeVista = "patio" | "vendidas" | "todas";

export const GARAJE_VISTA_LABELS: Record<GarajeVista, string> = {
  patio: "En patio",
  vendidas: "Vendidas",
  todas: "Todas",
};

export function parseGarajeTab(tab: string | null | undefined): GarajeTab {
  if (tab === "modelos" || tab === "parqueaderos") return tab;
  return "motos";
}

export function parseGarajeVista(vista: string | null | undefined): GarajeVista {
  if (vista === "vendidas" || vista === "todas") return vista;
  return "patio";
}
