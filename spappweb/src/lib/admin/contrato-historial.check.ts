import {
  appendContratoHistorial,
  getContratoRenovacionPdfPath,
  parseContratoHistorial,
} from "./contrato-historial";

const empty = appendContratoHistorial(null, {
  renovado_at: "2026-09-21T00:00:00.000Z",
  frecuencia_pago: "diario",
  monto_cuota_periodo: 40_000,
  fecha_inicio: "2026-07-26",
  periodos_debidos: 58,
  periodos_pagados: 36,
  monto_pagado: 1_468_000,
  monto_adeudado_perdonado: 852_000,
  modelo: "BERA SBR 150",
  placa: "JQX38I",
  signed_at: "2026-07-24T16:16:53.889Z",
  contrato_pdf_path: "120/x/contrato.pdf",
  digital_contract_id: "0df76f54-9558-48ce-aaa5-63fa9c6faa28",
});
const parsed = parseContratoHistorial(empty);
if (parsed.length !== 1 || parsed[0].monto_adeudado_perdonado !== 852_000) {
  throw new Error("contrato-historial append/parse broken");
}
if (
  getContratoRenovacionPdfPath({ contrato_renovacion_pdf_path: "a.pdf" }) !==
  "a.pdf"
) {
  throw new Error("contrato-historial renovacion path broken");
}
console.log("contrato-historial ok");
