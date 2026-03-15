import { sql } from '@/lib/db';
import { tableExists } from '@/lib/schema';

export type LoaRequestRow = {
  id: number;
  controller_cid: number;
  controller_name: string | null;
  controller_email: string | null;
  estimated_date: string | null;
  reason: string | null;
  approved: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function loaEnabled(): Promise<boolean> {
  return await tableExists('loa_requests').catch(() => false);
}

export async function getLoaRequestsForCid(cid: number): Promise<LoaRequestRow[]> {
  const ok = await loaEnabled();
  if (!ok) return [];
  const rows = await sql<LoaRequestRow[]>`
    SELECT id, controller_cid, controller_name, controller_email, estimated_date, reason, approved, created_at, updated_at
    FROM loa_requests
    WHERE controller_cid = ${cid}
    ORDER BY (created_at IS NULL) ASC, created_at DESC, id DESC
  `;
  return rows ?? [];
}

export async function getLatestLoaForCid(cid: number): Promise<LoaRequestRow | null> {
  const rows = await getLoaRequestsForCid(cid);
  return rows[0] ?? null;
}
