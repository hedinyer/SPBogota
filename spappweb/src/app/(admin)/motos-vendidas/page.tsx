import { redirect } from "next/navigation";

export default function MotosVendidasPage() {
  redirect("/garaje?vista=vendidas");
}
