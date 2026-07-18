import assert from "node:assert";
import {
  assertVisitadorAllowedForReferral,
  buildReferralLeaderboard,
  filterVisitadoresForReferral,
  parseReferralSource,
  rankLeaderboard,
  referralLabel,
  resolveReferralSource,
  visitadorMatchesReferral,
} from "./referrals";

assert.equal(parseReferralSource("guillen"), "guillen");
assert.equal(parseReferralSource("Yhosmer"), "yhosmer");
assert.equal(parseReferralSource("fabian"), "fabian");
assert.equal(parseReferralSource("punto-de-venta"), "punto-de-venta");
assert.equal(parseReferralSource("hacker"), null);
assert.equal(referralLabel("guillen"), "Guillen");
assert.equal(referralLabel("fabian"), "Fabian");
assert.equal(resolveReferralSource(null), "punto-de-venta");
assert.equal(resolveReferralSource(""), "punto-de-venta");
assert.equal(resolveReferralSource("guillen"), "guillen");

const board = buildReferralLeaderboard({
  guillen: 5,
  yhosmer: 5,
  "punto-de-venta": 2,
});
assert.equal(board[0].rank, 1);
assert.equal(board[1].rank, 1);
assert.equal(board[2].rank, 3);
assert.equal(board[2].slug, "punto-de-venta");
assert.equal(board[3].slug, "fabian");
assert.equal(board[3].count, 0);

const visitadores = [
  { id: 1, nombre: "Guillen" },
  { id: 2, nombre: "Yhosmer" },
  { id: 3, nombre: "Fabian" },
  { id: 4, nombre: "Otro" },
];
assert.deepEqual(
  filterVisitadoresForReferral(visitadores, "guillen").map((v) => v.id),
  [1],
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
assert.equal(visitadorMatchesReferral("Guillen", "guillen"), true);
assert.throws(
  () => assertVisitadorAllowedForReferral("Otro", "guillen"),
  /referido por Guillen/,
);
assertVisitadorAllowedForReferral("Guillen", "guillen");
assertVisitadorAllowedForReferral("Otro", "fabian");
assertVisitadorAllowedForReferral("Otro", "punto-de-venta");

const visitadoresBoard = rankLeaderboard([
  { slug: "1", label: "Guillen", count: 3 },
  { slug: "2", label: "Yhosmer", count: 3 },
  { slug: "3", label: "Otro", count: 1 },
]);
assert.equal(visitadoresBoard[0].rank, 1);
assert.equal(visitadoresBoard[1].rank, 1);
assert.equal(visitadoresBoard[2].rank, 3);

console.log("referrals.check: ok");
