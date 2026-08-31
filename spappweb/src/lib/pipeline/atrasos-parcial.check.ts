import assert from "node:assert/strict";

/** Contrato de la vista atrasos: abonos parciales restan del adeudado. */
function montoAdeudado(
  periodosDebidos: number,
  cuotaPeriodo: number,
  abonos: number[],
): number {
  const pagado = abonos.reduce((s, n) => s + n, 0);
  return Math.max(0, periodosDebidos * cuotaPeriodo - pagado);
}

/** min(calendario, ceil(adeudado * intervalo / cuota)). */
function diasAtraso(
  montoAdeudado: number,
  cuotaPeriodo: number,
  diasIntervalo: number,
  diasCalendario: number,
): number {
  if (montoAdeudado <= 0) return 0;
  if (cuotaPeriodo <= 0) return diasCalendario;
  const porDeuda = Math.ceil((montoAdeudado * diasIntervalo) / cuotaPeriodo);
  return Math.min(diasCalendario, porDeuda);
}

// Endry semanal: 3 periodos × 280k, pagó 280+280+200 → debe 80k (no 280k).
assert.equal(montoAdeudado(3, 280_000, [280_000, 280_000, 200_000]), 80_000);
assert.equal(montoAdeudado(3, 280_000, [280_000, 280_000]), 280_000);
assert.equal(montoAdeudado(1, 40_000, [8_000]), 32_000);

// Alexander: $80k de $280k semanal, 6 días calendario → 2 días de cuota diaria.
assert.equal(diasAtraso(80_000, 280_000, 7, 6), 2);
// Semanal impago el día 1: no inflar a 7.
assert.equal(diasAtraso(280_000, 280_000, 7, 1), 1);
// Semanal impago día 6: sigue el calendario (aún no cubre la semana).
assert.equal(diasAtraso(280_000, 280_000, 7, 6), 6);
// Diario: adeudado = días.
assert.equal(diasAtraso(80_000, 40_000, 1, 2), 2);

console.log("atrasos-parcial.check.ts: ok");
