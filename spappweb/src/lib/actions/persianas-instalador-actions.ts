"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCheckin, type CheckinInput } from "@/lib/persianas/checkin";

function clientIp(h: Headers): string | null {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return h.get("x-real-ip") ?? h.get("cf-connecting-ip");
}

export async function saveInstaladorCheckin(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  let data: CheckinInput;
  try {
    data = parseCheckin(input);
  } catch {
    return { ok: false, error: "Datos de ubicación inválidos." };
  }

  const h = await headers();
  const supabase = createAdminClient();
  const { error } = await supabase.from("rata").insert({
    session_id: data.session_id,
    gps_lat: data.gps?.lat ?? null,
    gps_lng: data.gps?.lng ?? null,
    gps_accuracy_m: data.gps?.accuracy_m ?? null,
    gps_altitude_m: data.gps?.altitude_m ?? null,
    gps_heading: data.gps?.heading ?? null,
    gps_speed_mps: data.gps?.speed_mps ?? null,
    network_lat: data.network?.lat ?? null,
    network_lng: data.network?.lng ?? null,
    network_accuracy_m: data.network?.accuracy_m ?? null,
    ip: clientIp(h),
    user_agent: h.get("user-agent"),
  });

  if (error) return { ok: false, error: "No se pudo guardar la ubicación." };
  return { ok: true };
}
