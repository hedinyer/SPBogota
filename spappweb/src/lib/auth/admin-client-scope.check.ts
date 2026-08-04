import assert from "node:assert";
import {
  isPostDeliveryCompraEstado,
  referralAllowedForScopedAdmin,
  referralMatchesAdminScope,
  resolveAdminClientReferralScope,
  SCOPED_ADMIN_HIDDEN_QUEUES,
} from "./admin-client-scope.ts";

assert.equal(referralMatchesAdminScope("olga", null), true);
assert.equal(referralMatchesAdminScope("olga", "olga"), true);
assert.equal(referralMatchesAdminScope("fabian", "olga"), false);
assert.equal(referralMatchesAdminScope("guillen", "olga"), false);
assert.equal(referralAllowedForScopedAdmin("guillen", "olga"), true);
assert.equal(referralAllowedForScopedAdmin("fabian", "olga"), false);

assert.equal(isPostDeliveryCompraEstado("entregada"), true);
assert.equal(isPostDeliveryCompraEstado("saldada"), true);
assert.equal(isPostDeliveryCompraEstado("lista_retiro"), false);
assert.equal(isPostDeliveryCompraEstado("pendiente_pago"), false);

assert.ok(SCOPED_ADMIN_HIDDEN_QUEUES.includes("morosos"));
assert.ok(SCOPED_ADMIN_HIDDEN_QUEUES.includes("recoger"));
assert.ok(!(SCOPED_ADMIN_HIDDEN_QUEUES as readonly string[]).includes("clientes_guillen"));

assert.equal(
  resolveAdminClientReferralScope({
    isLoggedIn: true,
    userId: 174,
    username: "Opinilla",
  }),
  "olga",
);
assert.equal(
  resolveAdminClientReferralScope({
    isLoggedIn: true,
    userId: 1,
    username: "adminBogota",
  }),
  null,
);

console.log("admin-client-scope.check OK");
