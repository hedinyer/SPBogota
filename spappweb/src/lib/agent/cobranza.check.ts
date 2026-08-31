import assert from "node:assert";
import { buildWhatsAppDraftPrompt } from "./cobranza.ts";

const prompt = buildWhatsAppDraftPrompt({
  nombre: "Ana Pérez",
  cedula: "123",
  placa: "ZOK44H",
  dias: 3,
  monto: 120000,
  etapa: "mora",
});

assert.ok(prompt.includes("Ana Pérez"));
assert.ok(prompt.includes("3 días"));
assert.ok(prompt.includes("120000"));
assert.ok(prompt.includes("Soluciones Pinilla"));
assert.ok(!prompt.includes("comillas ni explicaciones") || prompt.includes("Solo el texto"));

const recoger = buildWhatsAppDraftPrompt({
  nombre: "Juan",
  cedula: null,
  placa: null,
  dias: 5,
  monto: 0,
  etapa: "recoger",
});
assert.ok(recoger.includes("Juan"));
assert.ok(recoger.includes("5 días"));
assert.ok(recoger.includes("recoger"));

console.log("cobranza.check OK");
