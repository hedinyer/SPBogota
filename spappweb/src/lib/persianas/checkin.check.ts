import assert from "node:assert/strict";
import { parseCheckin } from "./checkin.ts";

const session_id = "11111111-1111-4111-8111-111111111111";

{
  const ok = parseCheckin({
    session_id,
    gps: {
      lat: 4.711,
      lng: -74.072,
      accuracy_m: 8,
      altitude_m: 2550,
      heading: null,
      speed_mps: 0,
    },
    network: { lat: 4.71, lng: -74.07, accuracy_m: 80 },
  });
  assert.equal(ok.gps?.lat, 4.711);
  assert.equal(ok.network?.accuracy_m, 80);
}

{
  const gpsOnly = parseCheckin({
    session_id,
    gps: {
      lat: 4.6,
      lng: -74.08,
      accuracy_m: 12,
      altitude_m: null,
      heading: null,
      speed_mps: null,
    },
    network: null,
  });
  assert.equal(gpsOnly.network, null);
}

assert.throws(() =>
  parseCheckin({ session_id, gps: null, network: null }),
);
assert.throws(() =>
  parseCheckin({
    session_id: "no-uuid",
    gps: {
      lat: 4,
      lng: -74,
      accuracy_m: 1,
      altitude_m: null,
      heading: null,
      speed_mps: null,
    },
    network: null,
  }),
);
assert.throws(() =>
  parseCheckin({
    session_id,
    gps: {
      lat: 99,
      lng: -74,
      accuracy_m: 1,
      altitude_m: null,
      heading: null,
      speed_mps: null,
    },
    network: null,
  }),
);

console.log("persianas checkin OK");
