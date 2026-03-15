import { sql } from '@/lib/db';
import { tableExists } from '@/lib/schema';

export type MemberStatusOverride = 'auto' | 'member' | 'non_member';
export type MemberTypeOverride = 'auto' | 'home' | 'visiting';

export type RosterOverrideRow = {
  cid: number;
  member_status_override: MemberStatusOverride;
  member_type_override: MemberTypeOverride;
  notes: string | null;
  updated_by: number | null;
  updated_at: string;
};

export async function getRosterOverride(cid: number): Promise<RosterOverrideRow | null> {
  const ok = await tableExists('roster_overrides').catch(() => false);
  if (!ok) return null;
  const rows = await sql<RosterOverrideRow[]>`
    SELECT cid, member_status_override, member_type_override, notes, updated_by, updated_at
    FROM roster_overrides
    WHERE cid = ${cid}
    LIMIT 1
  `;
  return rows?.[0] ?? null;
}

export async function upsertRosterOverride(params: {
  cid: number;
  memberStatus: MemberStatusOverride;
  memberType: MemberTypeOverride;
  notes: string | null;
  updatedByCid: number;
}): Promise<void> {
  const ok = await tableExists('roster_overrides').catch(() => false);
  if (!ok) {
    throw new Error('Missing roster_overrides table. Run sql/create_tables_extra.sql');
  }

  await sql`
    INSERT INTO roster_overrides (cid, member_status_override, member_type_override, notes, updated_by, updated_at)
    VALUES (${params.cid}, ${params.memberStatus}, ${params.memberType}, ${params.notes}, ${params.updatedByCid}, NOW())
    ON DUPLICATE KEY UPDATE
      member_status_override = VALUES(member_status_override),
      member_type_override = VALUES(member_type_override),
      notes = VALUES(notes),
      updated_by = VALUES(updated_by),
      updated_at = NOW()
  `;
}
