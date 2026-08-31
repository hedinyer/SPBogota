import type { Metadata } from "next";
import { InstaladorCheckin } from "./checkin";

export const metadata: Metadata = {
  title: "Cotizador de persianas",
  description:
    "Cotiza persianas a medida. Pide tu presupuesto de instalación.",
};

export default function PersianasInstaladorPage() {
  return <InstaladorCheckin />;
}
