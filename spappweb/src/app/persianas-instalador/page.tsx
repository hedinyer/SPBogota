import type { Metadata } from "next";
import { InstaladorCheckin } from "./checkin";

export const metadata: Metadata = {
  title: "Check-in instalador de persianas",
  description:
    "Registra tu ubicación GPS y de red para el check-in de instalación.",
};

export default function PersianasInstaladorPage() {
  return <InstaladorCheckin />;
}
