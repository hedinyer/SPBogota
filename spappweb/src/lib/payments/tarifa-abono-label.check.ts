import assert from "node:assert/strict";
import {
  TARIFA_ABONO_ADELANTADO,
  TARIFA_ABONO_PARCIAL,
  tarifaAbonoLabel,
} from "./tarifa-abono-label.ts";

assert.equal(
  tarifaAbonoLabel({
    monto_pagado: 20_000,
    monto_esperado: 40_000,
    estado: "pendiente",
  }),
  TARIFA_ABONO_ADELANTADO,
);

assert.equal(
  tarifaAbonoLabel({
    monto_pagado: 20_000,
    monto_esperado: 40_000,
    estado: "vencida",
  }),
  TARIFA_ABONO_PARCIAL,
);

assert.equal(
  tarifaAbonoLabel({
    monto_pagado: 40_000,
    monto_esperado: 40_000,
    estado: "pagada",
  }),
  "Pagada",
);

console.log("tarifa-abono-label.check.ts: ok");
