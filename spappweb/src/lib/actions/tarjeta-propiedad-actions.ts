"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TarjetaPropiedadRow } from "@/lib/pipeline/types";

const createTarjetaSchema = z.object({
  placa: z
    .string()
    .trim()
    .min(5, "Indica una placa válida")
    .transform((v) => v.toUpperCase().replace(/\s+/g, "")),
  imagen_url: z.string().trim().min(1, "Foto del frente obligatoria"),
  imagen_reverso_url: z.string().trim().min(1, "Foto del reverso obligatoria"),
});

export type CreateTarjetaPropiedadInput = z.infer<typeof createTarjetaSchema>;

function toRow(raw: Record<string, unknown>): TarjetaPropiedadRow {
  return {
    id: String(raw.id),
    numero_licencia: raw.numero_licencia != null ? String(raw.numero_licencia) : null,
    placa: raw.placa != null ? String(raw.placa) : null,
    marca: raw.marca != null ? String(raw.marca) : null,
    linea: raw.linea != null ? String(raw.linea) : null,
    modelo: raw.modelo != null ? String(raw.modelo) : null,
    cilindrada: raw.cilindrada != null ? String(raw.cilindrada) : null,
    color: raw.color != null ? String(raw.color) : null,
    servicio: raw.servicio != null ? String(raw.servicio) : null,
    clase_vehiculo: raw.clase_vehiculo != null ? String(raw.clase_vehiculo) : null,
    tipo_carroceria: raw.tipo_carroceria != null ? String(raw.tipo_carroceria) : null,
    combustible: raw.combustible != null ? String(raw.combustible) : null,
    capacidad: raw.capacidad != null ? String(raw.capacidad) : null,
    numero_motor: raw.numero_motor != null ? String(raw.numero_motor) : null,
    motor_reg: raw.motor_reg != null ? String(raw.motor_reg) : null,
    vin: raw.vin != null ? String(raw.vin) : null,
    numero_serie: raw.numero_serie != null ? String(raw.numero_serie) : null,
    serie_reg: raw.serie_reg != null ? String(raw.serie_reg) : null,
    numero_chasis: raw.numero_chasis != null ? String(raw.numero_chasis) : null,
    chasis_reg: raw.chasis_reg != null ? String(raw.chasis_reg) : null,
    propietario: raw.propietario != null ? String(raw.propietario) : null,
    identificacion_tipo:
      raw.identificacion_tipo != null ? String(raw.identificacion_tipo) : null,
    identificacion_numero:
      raw.identificacion_numero != null
        ? String(raw.identificacion_numero)
        : null,
    imagen_url: String(raw.imagen_url),
    imagen_reverso_url:
      raw.imagen_reverso_url != null ? String(raw.imagen_reverso_url) : null,
    raw_ocr_text: raw.raw_ocr_text != null ? String(raw.raw_ocr_text) : null,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  };
}

export async function createTarjetaPropiedad(
  input: CreateTarjetaPropiedadInput,
): Promise<TarjetaPropiedadRow> {
  await requireAdminSession();
  const parsed = createTarjetaSchema.parse(input);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("tarjetas_propiedad")
    .insert({
      placa: parsed.placa,
      imagen_url: parsed.imagen_url,
      imagen_reverso_url: parsed.imagen_reverso_url,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(`Ya existe una tarjeta con placa ${parsed.placa}.`);
    }
    throw new Error(error.message);
  }

  revalidatePath("/tarjetas-propiedad");
  revalidatePath("/licencias");
  return toRow(data as Record<string, unknown>);
}

const updateTarjetaSchema = z
  .object({
    id: z.string().uuid().optional(),
    placa: z
      .string()
      .trim()
      .min(5)
      .transform((v) => v.toUpperCase().replace(/\s+/g, ""))
      .optional(),
    imagen_url: z.string().trim().min(1).optional(),
    imagen_reverso_url: z.string().trim().min(1).optional(),
    numero_licencia: z.string().trim().nullable().optional(),
    marca: z.string().trim().nullable().optional(),
    linea: z.string().trim().nullable().optional(),
    modelo: z.string().trim().nullable().optional(),
    cilindrada: z.string().trim().nullable().optional(),
    color: z.string().trim().nullable().optional(),
    servicio: z.string().trim().nullable().optional(),
    clase_vehiculo: z.string().trim().nullable().optional(),
    tipo_carroceria: z.string().trim().nullable().optional(),
    combustible: z.string().trim().nullable().optional(),
    capacidad: z.string().trim().nullable().optional(),
    numero_motor: z.string().trim().nullable().optional(),
    vin: z.string().trim().nullable().optional(),
    numero_serie: z.string().trim().nullable().optional(),
    numero_chasis: z.string().trim().nullable().optional(),
    propietario: z.string().trim().nullable().optional(),
    identificacion_tipo: z.string().trim().nullable().optional(),
    identificacion_numero: z.string().trim().nullable().optional(),
  })
  .refine((v) => Boolean(v.id || v.placa), {
    message: "Indica id o placa de la tarjeta a editar.",
  });

export type UpdateTarjetaPropiedadInput = z.infer<typeof updateTarjetaSchema>;

export async function getTarjetaPropiedad(opts: {
  id?: string;
  placa?: string;
}): Promise<TarjetaPropiedadRow | null> {
  await requireAdminSession();
  const id = opts.id?.trim();
  const placa = opts.placa
    ?.trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!id && (!placa || placa.length < 5)) {
    throw new Error("Indica id o placa (mínimo 5 caracteres).");
  }

  const supabase = createAdminClient();
  let q = supabase.from("tarjetas_propiedad").select("*");
  q = id ? q.eq("id", id) : q.eq("placa", placa!);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRow(data as Record<string, unknown>) : null;
}

export async function updateTarjetaPropiedad(
  input: UpdateTarjetaPropiedadInput,
): Promise<TarjetaPropiedadRow> {
  await requireAdminSession();
  const parsed = updateTarjetaSchema.parse(input);
  const supabase = createAdminClient();

  const existing = await getTarjetaPropiedad({
    id: parsed.id,
    placa: parsed.placa && !parsed.id ? parsed.placa : undefined,
  });
  if (!existing) {
    throw new Error(
      parsed.id
        ? `No hay tarjeta con id ${parsed.id}.`
        : `No hay tarjeta con placa ${parsed.placa}.`,
    );
  }

  const patch: Record<string, string | null> = {};
  const set = (key: string, value: string | null | undefined) => {
    if (value !== undefined) patch[key] = value;
  };

  // Si viene id + placa nueva, actualizar placa; si solo placa como lookup, no picarla de nuevo.
  if (parsed.id && parsed.placa !== undefined) set("placa", parsed.placa);
  set("imagen_url", parsed.imagen_url);
  set("imagen_reverso_url", parsed.imagen_reverso_url);
  set("numero_licencia", parsed.numero_licencia);
  set("marca", parsed.marca);
  set("linea", parsed.linea);
  set("modelo", parsed.modelo);
  set("cilindrada", parsed.cilindrada);
  set("color", parsed.color);
  set("servicio", parsed.servicio);
  set("clase_vehiculo", parsed.clase_vehiculo);
  set("tipo_carroceria", parsed.tipo_carroceria);
  set("combustible", parsed.combustible);
  set("capacidad", parsed.capacidad);
  set("numero_motor", parsed.numero_motor);
  set("vin", parsed.vin);
  set("numero_serie", parsed.numero_serie);
  set("numero_chasis", parsed.numero_chasis);
  set("propietario", parsed.propietario);
  set("identificacion_tipo", parsed.identificacion_tipo);
  set("identificacion_numero", parsed.identificacion_numero);

  if (Object.keys(patch).length === 0) {
    throw new Error("No hay campos para actualizar.");
  }

  const { data, error } = await supabase
    .from("tarjetas_propiedad")
    .update(patch)
    .eq("id", existing.id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(`Ya existe una tarjeta con placa ${parsed.placa}.`);
    }
    throw new Error(error.message);
  }

  revalidatePath("/tarjetas-propiedad");
  revalidatePath("/licencias");
  return toRow(data as Record<string, unknown>);
}

export async function deleteTarjetaPropiedad(id: string): Promise<void> {
  await requireAdminSession();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("tarjetas_propiedad")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/tarjetas-propiedad");
  revalidatePath("/licencias");
}
