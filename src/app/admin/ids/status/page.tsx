import { requireStaff } from "@/lib/auth/guards";
import { getIdsDataStatus, getIdsJsonRoot } from "@/lib/idsStaticData";
import { IdsDataStatusClient } from "./IdsDataStatusClient";

export default async function IdsStatusPage() {
  await requireStaff();
  const root = await getIdsJsonRoot();
  const status = await getIdsDataStatus();
  return <IdsDataStatusClient initialRoot={root} initialStatus={status} />;
}
