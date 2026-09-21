/**
 * Genera PDF de renovación (no toca contrato.pdf original).
 * Run: npx tsx scripts/generate-contrato-renovacion.ts <userId>
 */
import Module from "node:module";
import { createClient } from "@supabase/supabase-js";
import type { FrecuenciaPago } from "../src/lib/pipeline/types";

const req = Module.prototype.require;
Module.prototype.require = function (this: NodeModule, id: string) {
  if (id === "server-only") return {};
  return req.apply(this, arguments as unknown as [string]);
};

async function main() {
  const userId = Number(process.argv[2]);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error("Usage: npx tsx scripts/generate-contrato-renovacion.ts <userId>");
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import(
    "../src/lib/supabase/public-env"
  );
  const { parseHojaVidaForm } = await import(
    "../src/lib/contracts/hoja-vida-schema"
  );
  const { buildContratoDataFromStored } = await import(
    "../src/lib/contracts/contrato-renting-clausulas"
  );
  const { generateContratoPdf } = await import(
    "../src/lib/contracts/contract-pdf"
  );
  const { resolveCondicionContrato } = await import(
    "../src/lib/contracts/garaje-condicion"
  );

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: contract, error: cErr } = await supabase
    .from("digital_contracts")
    .select(
      "id, user_id, status, hoja_vida_data, contrato_data, admin_data, signature_path, contrato_pdf_path",
    )
    .eq("user_id", userId)
    .eq("status", "firmado")
    .not("signature_path", "is", null)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cErr) throw new Error(cErr.message);
  if (!contract) throw new Error(`No hay contrato firmado para user ${userId}`);

  const { data: compra, error: compraErr } = await supabase
    .from("user_moto_compra")
    .select(
      "modelo, color, placa, chasis, referencia, condicion, frecuencia_pago, cuota_inicial_monto, monto_cuota_periodo, garaje_moto_id",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (compraErr) throw new Error(compraErr.message);
  if (!compra?.placa) throw new Error("Compra sin placa");

  const condicion = await resolveCondicionContrato(supabase, {
    condicion: compra.condicion,
    garajeMotoId: compra.garaje_moto_id as string | null,
    placa: compra.placa as string,
    referencia: (compra.referencia as string | null) ?? null,
  });

  const compraInput = {
    modelo: compra.modelo as string,
    color: compra.color as string,
    placa: compra.placa as string,
    chasis: (compra.chasis as string) ?? "",
    referencia: (compra.referencia as string | null) ?? null,
    frecuencia_pago: compra.frecuencia_pago as FrecuenciaPago,
    cuota_inicial_monto: compra.cuota_inicial_monto as number,
    monto_cuota_periodo: compra.monto_cuota_periodo as number,
    condicion,
  };

  const signaturePath = contract.signature_path as string;
  const { data: sigFile, error: sigError } = await supabase.storage
    .from("contract-documents")
    .download(signaturePath);
  if (sigError || !sigFile) {
    throw new Error(`Firma: ${sigError?.message ?? "missing"}`);
  }

  const signatureDataUrl = `data:image/png;base64,${Buffer.from(await sigFile.arrayBuffer()).toString("base64")}`;
  const hoja = parseHojaVidaForm(
    (contract.hoja_vida_data as Record<string, unknown>) ?? {},
  );
  const contratoData = (contract.contrato_data as Record<string, unknown>) ?? {};
  const contrato = buildContratoDataFromStored(
    {
      ...contratoData,
      tipo_documento_contratante: hoja.tipo_identificacion,
      celular_contratante: contratoData.celular_contratante ?? hoja.celular,
    },
    compraInput,
  );

  const pdf = await generateContratoPdf({ contrato, signatureDataUrl });
  const renovacionPath = `${userId}/${contract.id}/contrato_renovacion.pdf`;

  const { error: upErr } = await supabase.storage
    .from("contract-documents")
    .upload(renovacionPath, pdf, { contentType: "application/pdf", upsert: true });
  if (upErr) throw new Error(upErr.message);

  const adminData = {
    ...((contract.admin_data as Record<string, unknown>) ?? {}),
    contrato_renovacion_pdf_path: renovacionPath,
  };

  const { error: updErr } = await supabase
    .from("digital_contracts")
    .update({
      admin_data: adminData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contract.id);

  if (updErr) throw new Error(updErr.message);

  console.log(`OK user=${userId} renovacion=${renovacionPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
