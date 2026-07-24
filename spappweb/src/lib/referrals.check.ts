import assert from "node:assert";
import {
  assertVisitadorAllowedForReferral,
  buildReferralLeaderboard,
  filterVisitadoresForReferral,
  isHiddenReferral,
  parseReferralSource,
  rankLeaderboard,
  referralLabel,
  resolveReferralSource,
  visitadorMatchesReferral,
} from "./referrals";

assert.equal(parseReferralSource("guillen"), "guillen");
assert.equal(isHiddenReferral("guillen"), true);
assert.equal(isHiddenReferral("Guillen"), true);
assert.equal(isHiddenReferral("yhosmer"), false);
assert.equal(isHiddenReferral(null), false);
assert.equal(parseReferralSource("Yhosmer"), "yhosmer");
assert.equal(parseReferralSource("fabian"), "fabian");
assert.equal(parseReferralSource("punto-de-venta"), "punto-de-venta");
assert.equal(parseReferralSource("hacker"), null);
assert.equal(referralLabel("fabian"), "Fabian");
assert.equal(referralLabel("guillen"), "Guillen");
assert.equal(resolveReferralSource(null), "punto-de-venta");
assert.equal(resolveReferralSource(""), "punto-de-venta");
assert.equal(resolveReferralSource("guillen"), "guillen");

const board = buildReferralLeaderboard({
  yhosmer: 5,
  fabian: 5,
  "punto-de-venta": 2,
  guillen: 99,
});
assert.equal(board[0].rank, 1);
assert.equal(board[1].rank, 1);
assert.equal(board[2].rank, 3);
assert.equal(board[2].slug, "punto-de-venta");
assert.equal(board.length, 3);
assert.equal(
  board.find((r) => r.slug === "guillen"),
  undefined,
);

const visitadores = [
  { id: 1, nombre: "Guillen" },
  { id: 2, nombre: "Yhosmer" },
  { id: 3, nombre: "Fabian" },
  { id: 4, nombre: "Otro" },
];
// Guillen se guarda en DB pero aquí no tiene lock de visitador.
assert.deepEqual(
  filterVisitadoresForReferral(visitadores, "guillen").map((v) => v.id),
  [1, 2, 3, 4],
);
assert.deepEqual(
  filterVisitadoresForReferral(visitadores, "yhosmer").map((v) => v.id),
  [2],
);
// Fabian es captador, no visitador: puede asignarse a cualquiera.
assert.deepEqual(
  filterVisitadoresForReferral(visitadores, "fabian").map((v) => v.id),
  [1, 2, 3, 4],
);
assert.deepEqual(
  filterVisitadoresForReferral(visitadores, null).map((v) => v.id),
  [1, 2, 3, 4],
);
assert.equal(visitadorMatchesReferral("Yhosmer", "yhosmer"), true);
assert.throws(
  () => assertVisitadorAllowedForReferral("Otro", "yhosmer"),
  /referido por Yhosmer/,
);
assertVisitadorAllowedForReferral("Yhosmer", "yhosmer");
assertVisitadorAllowedForReferral("Otro", "fabian");
assertVisitadorAllowedForReferral("Otro", "punto-de-venta");
assertVisitadorAllowedForReferral("Otro", "guillen");

const visitadoresBoard = rankLeaderboard([
  { slug: "1", label: "Guillen", count: 3 },
  { slug: "2", label: "Yhosmer", count: 3 },
  { slug: "3", label: "Otro", count: 1 },
]);
assert.equal(visitadoresBoard[0].rank, 1);
assert.equal(visitadoresBoard[1].rank, 1);
assert.equal(visitadoresBoard[2].rank, 3);

console.log("referrals.check: ok");
