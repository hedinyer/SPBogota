import assert from "node:assert";
import {
  buildReferralLeaderboard,
  parseReferralSource,
  referralLabel,
} from "./referrals";

assert.equal(parseReferralSource("guillen"), "guillen");
assert.equal(parseReferralSource("Yhosmer"), "yhosmer");
assert.equal(parseReferralSource("punto-de-venta"), "punto-de-venta");
assert.equal(parseReferralSource("hacker"), null);
assert.equal(referralLabel("guillen"), "Guillen");

const board = buildReferralLeaderboard({
  guillen: 5,
  yhosmer: 5,
  "punto-de-venta": 2,
});
assert.equal(board[0].rank, 1);
assert.equal(board[1].rank, 1);
assert.equal(board[2].rank, 3);
assert.equal(board[2].slug, "punto-de-venta");

console.log("referrals.check: ok");
