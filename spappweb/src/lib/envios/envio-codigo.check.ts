import assert from "node:assert/strict";
import {
  esCodigoEnvioValido,
  generarCodigoEnvio,
  normalizarCodigoEnvio,
} from "./envio-codigo.ts";

{
  const fixed = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
  const code = generarCodigoEnvio(fixed);
  assert.equal(code, "SPB-ABCDEFGH");
  assert.equal(esCodigoEnvioValido(code), true);
}

{
  assert.equal(normalizarCodigoEnvio("  spb-abcdefgh  "), "SPB-ABCDEFGH");
  assert.equal(esCodigoEnvioValido("SPB-ABCDEFGH"), true);
  assert.equal(esCodigoEnvioValido("SPB-ABC1OIL0"), false); // 1,O,I,L,0 fuera del alfabeto
  assert.equal(esCodigoEnvioValido("XYZ-ABCDEFGH"), false);
  assert.equal(esCodigoEnvioValido("SPB-SHORT"), false);
}

console.log("envio-codigo.check OK");
