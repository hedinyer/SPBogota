import { getAdminClientReferralScope } from "@/lib/auth/admin-client-scope";
import { AdminHubSubnav } from "@/components/layout/admin-hub-subnav";
import type { AdminNavGroup } from "@/components/layout/admin-nav-links";

export async function AdminScopedHubSubnav({
  hubId,
}: {
  hubId: AdminNavGroup["id"];
}) {
  const clientScope = await getAdminClientReferralScope();
  return <AdminHubSubnav hubId={hubId} hideEquipo={Boolean(clientScope)} />;
}
