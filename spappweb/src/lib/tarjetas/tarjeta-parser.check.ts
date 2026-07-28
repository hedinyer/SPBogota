/**
 * ponytail: self-check del parser de Licencia de Tránsito (sin framework).
 * Run: npx tsx src/lib/tarjetas/tarjeta-parser.check.ts
 */
import assert from "node:assert/strict";
import { parseTarjetaPropiedadText } from "./tarjeta-parser";

const SAMPLE = `
REPUBLICA DE COLOMBIA
MINISTERIO DE TRANSPORTE
LICENCIA DE TRANSITO
No. 10037296534
PLACA
ZOT50H
MARCA
BERA
LINEA
BR 150CC SBR
MODELO
2026
CILINDRADA CC
149
COLOR
GRIS
SERVICIO
PARTICULAR
CLASE DE VEHICULO
MOTOCICLETA
TIPO CARROCERIA
SIN CARROCERIA
COMBUSTIBLE
GASOLINA
CAPACIDAD Kg/PSJ
2
NUMERO DE MOTOR
Z162FMJ 2500236077
REG N
VIN
LB7GKC5A6SF050756
NUMERO DE SERIE
LB7GKC5A6SF050756
REG N
NUMERO DE CHASIS
LB7GKC5A6SF050756
REG N
PROPIETARIO: APELLIDO(S) Y NOMBRE(S)
SOLUCIONES PINILLA S.A.S.
IDENTIFICACION
NIT 901397015
`;

const parsed = parseTarjetaPropiedadText(SAMPLE);

assert.equal(parsed.numero_licencia, "10037296534");
assert.equal(parsed.placa, "ZOT50H");
assert.equal(parsed.marca, "BERA");
assert.equal(parsed.linea, "BR 150CC SBR");
assert.equal(parsed.modelo, "2026");
assert.equal(parsed.cilindrada, "149");
assert.equal(parsed.color, "GRIS");
assert.equal(parsed.servicio, "PARTICULAR");
assert.equal(parsed.clase_vehiculo, "MOTOCICLETA");
assert.equal(parsed.tipo_carroceria, "SIN CARROCERIA");
assert.equal(parsed.combustible, "GASOLINA");
assert.equal(parsed.capacidad, "2");
assert.equal(parsed.numero_motor, "Z162FMJ 2500236077");
assert.equal(parsed.vin, "LB7GKC5A6SF050756");
assert.equal(parsed.numero_serie, "LB7GKC5A6SF050756");
assert.equal(parsed.numero_chasis, "LB7GKC5A6SF050756");
assert.equal(parsed.propietario, "SOLUCIONES PINILLA S.A.S.");
assert.equal(parsed.identificacion_tipo, "NIT");
assert.equal(parsed.identificacion_numero, "901397015");
assert.equal(parsed.motor_reg, "N");
assert.equal(parsed.serie_reg, "N");
assert.equal(parsed.chasis_reg, "N");

console.log("tarjeta-parser.check: ok");
