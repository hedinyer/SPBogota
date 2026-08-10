/**
 * Backfill celular_contratante + regenera PDFs firmados.
 * Run: npx tsx scripts/backfill-contrato-celular.ts
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
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import(
    "../src/lib/supabase/public-env"
  );
  const {
    parseHojaVidaForm,
    patchContratoDataFromHoja,
  } = await import("../src/lib/contracts/hoja-vida-schema");
  const { regenerateSignedContractPdfs } = await import(
    "../src/lib/contracts/regenerate-signed-pdfs"
  );

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: rows, error } = await supabase
    .from("digital_contracts")
    .select(
      "id, user_id, status, hoja_vida_data, contrato_data, signature_path, hoja_vida_pdf_path, contrato_pdf_path",
    )
    .eq("status", "firmado")
    .not("signature_path", "is", null);

  if (error) throw new Error(error.message);
  const contracts = rows ?? [];
  console.log(`Firmados con firma: ${contracts.length}`);

  let ok = 0;
  let fail = 0;

  for (const row of contracts) {
    const id = row.id as string;
    const userId = row.user_id as number;
    try {
      const hoja = parseHojaVidaForm(
        (row.hoja_vida_data as Record<string, unknown>) ?? {},
      );
      const contratoData = patchContratoDataFromHoja(
        (row.contrato_data as Record<string, unknown> | null) ?? null,
        hoja,
      );

      const { data: compra } = await supabase
        .from("user_moto_compra")
        .select(
          "modelo, color, placa, chasis, referencia, frecuencia_pago, cuota_inicial_monto, monto_cuota_periodo",
        )
        .eq("user_id", userId)
        .maybeSingle();

      const compraInput =
        compra?.placa && compra?.chasis
          ? {
              modelo: compra.modelo as string,
              color: compra.color as string,
              placa: compra.placa as string,
              chasis: (compra.chasis as string) ?? "",
              referencia: (compra.referencia as string | null) ?? null,
              frecuencia_pago: compra.frecuencia_pago as FrecuenciaPago,
              cuota_inicial_monto: compra.cuota_inicial_monto as number,
              monto_cuota_periodo: compra.monto_cuota_periodo as number,
            }
          : null;

      const signaturePath = row.signature_path as string;
      const paths = await regenerateSignedContractPdfs(supabase, {
        contractId: id,
        userId,
        hojaVida: hoja,
        contratoData,
        signaturePath,
        hojaVidaPdfPath: (row.hoja_vida_pdf_path as string | null) ?? null,
        contratoPdfPath: (row.contrato_pdf_path as string | null) ?? null,
        compra: compraInput,
      });

      const { error: updateError } = await supabase
        .from("digital_contracts")
        .update({
          contrato_data: contratoData,
          hoja_vida_pdf_path: paths.hojaVidaPdfPath,
          contrato_pdf_path: paths.contratoPdfPath,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) throw new Error(updateError.message);

      ok += 1;
      console.log(`OK ${ok}/${contracts.length} user=${userId} ${id}`);
    } catch (e) {
      fail += 1;
      console.error(`FAIL user=${userId} ${id}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`Done. ok=${ok} fail=${fail}`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
