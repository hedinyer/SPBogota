"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import {
  ENVIOS_ESTADOS,
  generarCodigoEnvio,
  normalizarCodigoEnvio,
  type EnvioEstado,
} from "@/lib/envios/envio-codigo";
import { createAdminClient } from "@/lib/supabase/admin";

const createSchema = z.object({
  productoNombre: z.string().trim().min(1, "Nombre del producto obligatorio"),
  precio: z.number().int().min(0, "Precio inválido"),
  direccion: z.string().trim().min(3, "Dirección obligatoria"),
  ubicacion: z.string().trim().optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  estado: z.enum(ENVIOS_ESTADOS),
  ubicacion: z.string().trim(),
  direccion: z.string().trim().min(3, "Dirección obligatoria").optional(),
});

export type EnvioRow = {
  id: string;
  codigo: string;
  productoNombre: string;
  precio: number;
  direccion: string;
  estado: EnvioEstado;
  ubicacion: string;
  createdAt: string;
  updatedAt: string;
};

type DbRow = {
  id: string;
  codigo: string;
  producto_nombre: string;
  precio: number;
  direccion: string;
  estado: string;
  ubicacion: string;
  created_at: string;
  updated_at: string;
};

function mapRow(row: DbRow): EnvioRow {
  return {
    id: row.id,
    codigo: row.codigo,
    productoNombre: row.producto_nombre,
    precio: Number(row.precio),
    direccion: row.direccion,
    estado: row.estado as EnvioEstado,
    ubicacion: row.ubicacion ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT =
  "id, codigo, producto_nombre, precio, direccion, estado, ubicacion, created_at, updated_at";

export async function listEnvios(): Promise<EnvioRow[]> {
  await requireAdminSession();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tienda_envios")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data as DbRow[]).map(mapRow);
}

export async function getEnvioByCodigo(
  codigoRaw: string,
): Promise<EnvioRow | null> {
  const codigo = normalizarCodigoEnvio(codigoRaw);
  if (!codigo) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tienda_envios")
    .select(SELECT)
    .eq("codigo", codigo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data as DbRow) : null;
}

export async function createEnvio(input: z.infer<typeof createSchema>) {
  await requireAdminSession();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const supabase = createAdminClient();
  let lastError = "No se pudo crear el envío.";
  for (let attempt = 0; attempt < 5; attempt++) {
    const codigo = generarCodigoEnvio();
    const { data, error } = await supabase
      .from("tienda_envios")
      .insert({
        codigo,
        producto_nombre: parsed.data.productoNombre,
        precio: parsed.data.precio,
        direccion: parsed.data.direccion,
        ubicacion: parsed.data.ubicacion?.trim() || "Bodega Bogotá",
        estado: "preparando",
      })
      .select(SELECT)
      .single();
    if (!error && data) {
      revalidatePath("/envios");
      return { ok: true as const, envio: mapRow(data as DbRow) };
    }
    lastError = error?.message ?? lastError;
    if (error?.code !== "23505") break;
  }
  return { ok: false as const, error: lastError };
}

export async function updateEnvio(input: z.infer<typeof updateSchema>) {
  await requireAdminSession();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const patch: Record<string, unknown> = {
    estado: parsed.data.estado,
    ubicacion: parsed.data.ubicacion,
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.direccion) patch.direccion = parsed.data.direccion;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tienda_envios")
    .update(patch)
    .eq("id", parsed.data.id)
    .select(SELECT)
    .single();
  if (error || !data) {
    return { ok: false as const, error: error?.message ?? "No se actualizó." };
  }
  revalidatePath("/envios");
  revalidatePath(`/seguimiento/${(data as DbRow).codigo}`);
  return { ok: true as const, envio: mapRow(data as DbRow) };
}
