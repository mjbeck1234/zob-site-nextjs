import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/guards";
import { clearIdsJsonCache, getIdsDataStatus, getIdsJsonRoot } from "@/lib/idsStaticData";

export async function POST() {
  // Only staff+.
  await requireStaff();
  clearIdsJsonCache();
  const root = await getIdsJsonRoot();
  const status = await getIdsDataStatus();
  return NextResponse.json({ ok: true, root, status });
}
