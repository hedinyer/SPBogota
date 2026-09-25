import assert from "node:assert";
import { formatDate, formatDateOnly } from "./format.ts";

assert.equal(formatDate(null), "—");
assert.equal(formatDateOnly(undefined), "—");
assert.equal(formatDate("no-es-fecha"), "—");

// 2026-08-01 14:19:00-05:00 → Bogotá
const iso = "2026-08-01T19:19:00.000Z";
assert.equal(formatDateOnly(iso), "1/08/2026");
assert.equal(formatDate(iso), "1/08/2026, 2:19 p. m.");

const morning = "2026-09-23T14:05:00.000Z"; // 9:05 a. m. Bogotá
assert.equal(formatDate(morning), "23/09/2026, 9:05 a. m.");

console.log("format.check ok");
