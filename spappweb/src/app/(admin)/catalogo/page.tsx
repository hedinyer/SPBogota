import { redirect } from "next/navigation";

export default function CatalogoPage() {
  redirect("/garaje?tab=modelos");
}
