import assert from "node:assert";
import { MOTOS_TOOL_NAMES, isMotosTool, parseAgentToolScope } from "./motos-tools.ts";
import { AGENT_TOOLS, getAgentToolCatalog } from "./registry.ts";

assert.equal(parseAgentToolScope("motos"), "motos");
assert.equal(parseAgentToolScope("full"), "full");
assert.equal(parseAgentToolScope(null), "full");

for (const name of MOTOS_TOOL_NAMES) {
  assert.ok(
    name in AGENT_TOOLS,
    `MOTOS_TOOL_NAMES incluye "${name}" pero no está en AGENT_TOOLS`,
  );
  assert.ok(!name.startsWith("delete_"), `Motos no debe incluir delete: ${name}`);
}

const motosCatalog = getAgentToolCatalog("motos");
assert.equal(motosCatalog.length, MOTOS_TOOL_NAMES.length);
assert.ok(motosCatalog.every((t) => isMotosTool(t.name)));
assert.ok(!motosCatalog.some((t) => t.name.startsWith("delete_")));

const full = getAgentToolCatalog("full");
assert.ok(full.length > motosCatalog.length);
assert.ok(full.some((t) => t.name === "delete_garaje_moto"));

const required = [
  "get_garaje_moto",
  "get_venta_contado",
  "get_vendida",
  "get_tarjeta_propiedad",
  "update_tarjeta_propiedad",
  "list_garaje_motos",
  "save_garaje_moto",
];
for (const name of required) {
  assert.ok(
    motosCatalog.some((t) => t.name === name),
    `Falta tool Motos: ${name}`,
  );
}

console.log(
  `motos-tools.check OK (${motosCatalog.length} tools motos / ${full.length} full)`,
);
