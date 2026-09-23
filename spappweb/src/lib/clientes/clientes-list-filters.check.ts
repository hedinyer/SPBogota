import assert from "node:assert/strict";
import {
  DEFAULT_CLIENTES_FILTERS,
  filterClientSearchResults,
  hasActiveClientesFilters,
} from "./clientes-list-filters.ts";

function client(
  partial: Partial<Parameters<typeof filterClientSearchResults>[0][number]>,
): Parameters<typeof filterClientSearchResults>[0][number] {
  return {
    userId: 1,
    username: "u",
    displayName: "Ana",
    cedula: "1",
    placa: "ABC12D",
    motoLabel: "SBR · rojo",
    compraId: "c1",
    compraEstado: "entregada",
    cuotasPagadas: 0,
    diasAtraso: 0,
    motoRecogida: false,
    puedeMarcarRecogida: false,
    vigilado: false,
    notaVigilancia: null,
    matchLabel: "",
    seleccionadoAt: "2026-01-10T00:00:00Z",
    fechaVenta: "2026-01-10T00:00:00Z",
    selfieUrl: null,
    motoImagenUrl: null,
    referralLabel: "Punto de venta",
    ...partial,
  };
}

const rows = [
  client({ userId: 1, displayName: "Al dia" }),
  client({
    userId: 2,
    displayName: "Atraso",
    diasAtraso: 5,
    puedeMarcarRecogida: true,
  }),
  client({
    userId: 3,
    displayName: "Recogida",
    diasAtraso: 8,
    motoRecogida: true,
  }),
  client({
    userId: 4,
    displayName: "Vigilado",
    vigilado: true,
    notaVigilancia: "Cuidado",
  }),
  client({
    userId: 5,
    displayName: "Cancelado",
    compraEstado: "cancelada",
    diasAtraso: 12,
  }),
];

assert.equal(hasActiveClientesFilters(DEFAULT_CLIENTES_FILTERS), false);
assert.equal(
  filterClientSearchResults(rows, DEFAULT_CLIENTES_FILTERS).length,
  5,
);

assert.deepEqual(
  filterClientSearchResults(rows, {
    ...DEFAULT_CLIENTES_FILTERS,
    situacion: "al_dia",
  }).map((c) => c.displayName),
  ["Al dia", "Vigilado"],
);

assert.deepEqual(
  filterClientSearchResults(rows, {
    ...DEFAULT_CLIENTES_FILTERS,
    situacion: "atraso",
  }).map((c) => c.displayName),
  ["Atraso"],
);

assert.deepEqual(
  filterClientSearchResults(rows, {
    ...DEFAULT_CLIENTES_FILTERS,
    situacion: "recogida",
  }).map((c) => c.displayName),
  ["Recogida"],
);

assert.deepEqual(
  filterClientSearchResults(rows, {
    ...DEFAULT_CLIENTES_FILTERS,
    situacion: "vigilado",
  }).map((c) => c.displayName),
  ["Vigilado"],
);

assert.deepEqual(
  filterClientSearchResults(rows, {
    ...DEFAULT_CLIENTES_FILTERS,
    situacion: "cancelado",
  }).map((c) => c.displayName),
  ["Cancelado"],
);

assert.deepEqual(
  filterClientSearchResults(rows, {
    ...DEFAULT_CLIENTES_FILTERS,
    fechaDesde: "2026-02-01",
  }).map((c) => c.userId),
  [],
);

assert.equal(
  filterClientSearchResults(rows, {
    ...DEFAULT_CLIENTES_FILTERS,
    fechaHasta: "2026-01-10",
  }).length,
  5,
);

console.log("clientes-list-filters.check OK");
