import { sql } from '@/lib/db';

// Matches existing current table: `staffing`
// approved: varchar(3) => we store '0'=pending, '1'=approved, '2'=denied
export type StaffingApproval = '0' | '1' | '2';

export type StaffingRequestRow = {
  id: number;
  pilot_full_name: string;
  pilot_email: string;
  pilot_cid: number;
  group_name: string | null;
  pilot_count: number | null;
  event_date: string | null;
  time_start: string | null;
  time_end: string | null;
  description: string | null;
  event_banner: string | null;
  approved: string | null;
};

export type StaffingRequestInput = {
  pilotFullName: string;
  pilotEmail: string;
  pilotCid: number;
  groupName?: string | null;
  pilotCount?: number | null;
  eventDate?: string | null;
  timeStart?: string | null;
  timeEnd?: string | null;
  description?: string | null;
  eventBanner?: string | null;
};

function isPendingApprovedValue(v: any): boolean {
  if (v === null || v === undefined) return true;
  const s = String(v).trim().toLowerCase();
  return s === '' || s === '0' || s === 'no' || s === 'pending';
}

export function getStaffingStatusLabel(approved: any): { code: StaffingApproval; label: string } {
  if (approved === null || approved === undefined) return { code: '0', label: 'Pending' };
  const s = String(approved).trim().toLowerCase();
  if (s === '1' || s === 'yes' || s === 'y' || s === 'true') return { code: '1', label: 'Approved' };
  if (s === '2' || s === 'den' || s === 'deny' || s === 'denied' || s === 'rej' || s === 'rejected') return { code: '2', label: 'Denied' };
  if (isPendingApprovedValue(s)) return { code: '0', label: 'Pending' };
  // fallback
  return { code: '0', label: 'Pending' };
}

// Backwards-compatible export name used by pages/components.
// (Some pages import `approvalLabel`.)
export function approvalLabel(approved: any): { code: StaffingApproval; label: string } {
  return getStaffingStatusLabel(approved);
}

export async function countPendingStaffingRequestsForCid(cid: number): Promise<number> {
  const rows = await sql<{ cnt: number }[]>`
    SELECT COUNT(*) AS cnt
    FROM staffing
    WHERE pilot_cid = ${cid}
      AND (
        approved IS NULL OR TRIM(approved) = '' OR approved = '0' OR LOWER(TRIM(approved)) = 'no' OR LOWER(TRIM(approved)) = 'pending'
      )
  `;
  return Number(rows?.[0]?.cnt ?? 0);
}

export async function createStaffingRequest(input: StaffingRequestInput): Promise<number> {
  const pending = await countPendingStaffingRequestsForCid(input.pilotCid);
  if (pending >= 3) {
    throw new Error('You already have 3 pending staffing requests. Please wait for approval/denial before submitting more.');
  }

  const res = await sql<{ insertId: number }[]>`
    INSERT INTO staffing (
      pilot_full_name,
      pilot_email,
      pilot_cid,
      group_name,
      pilot_count,
      event_date,
      time_start,
      time_end,
      description,
      event_banner,
      approved
    ) VALUES (
      ${input.pilotFullName},
      ${input.pilotEmail},
      ${input.pilotCid},
      ${input.groupName ?? null},
      ${input.pilotCount ?? null},
      ${input.eventDate ?? null},
      ${input.timeStart ?? null},
      ${input.timeEnd ?? null},
      ${input.description ?? null},
      ${input.eventBanner ?? null},
      ${'0'}
    ) RETURNING insertId
  `;

  return Number(res?.[0]?.insertId ?? 0);
}

export async function listMyStaffingRequestsForCid(cid: number): Promise<StaffingRequestRow[]> {
  const rows = await sql<StaffingRequestRow[]>`
    SELECT
      id,
      pilot_full_name,
      pilot_email,
      pilot_cid,
      group_name,
      pilot_count,
      event_date,
      time_start,
      time_end,
      description,
      event_banner,
      approved
    FROM staffing
    WHERE pilot_cid = ${cid}
    ORDER BY id DESC
    LIMIT 50
  `;
  return rows ?? [];
}

export async function listStaffingRequestsForAdmin(filter: 'pending' | 'approved' | 'denied' | 'all' = 'pending'): Promise<StaffingRequestRow[]> {
  if (filter === 'approved') {
    return (
      (await sql<StaffingRequestRow[]>`
        SELECT
          id,
          pilot_full_name,
          pilot_email,
          pilot_cid,
          group_name,
          pilot_count,
          event_date,
          time_start,
          time_end,
          description,
          event_banner,
          approved
        FROM staffing
        WHERE (approved = '1' OR LOWER(TRIM(approved)) IN ('yes','y','true'))
        ORDER BY id DESC
        LIMIT 200
      `) ?? []
    );
  }

  if (filter === 'denied') {
    return (
      (await sql<StaffingRequestRow[]>`
        SELECT
          id,
          pilot_full_name,
          pilot_email,
          pilot_cid,
          group_name,
          pilot_count,
          event_date,
          time_start,
          time_end,
          description,
          event_banner,
          approved
        FROM staffing
        WHERE (approved = '2' OR LOWER(TRIM(approved)) IN ('deny','den','denied','rej','rejected'))
        ORDER BY id DESC
        LIMIT 200
      `) ?? []
    );
  }

  if (filter === 'all') {
    return (
      (await sql<StaffingRequestRow[]>`
        SELECT
          id,
          pilot_full_name,
          pilot_email,
          pilot_cid,
          group_name,
          pilot_count,
          event_date,
          time_start,
          time_end,
          description,
          event_banner,
          approved
        FROM staffing
        ORDER BY id DESC
        LIMIT 500
      `) ?? []
    );
  }

  // pending
  return (
    (await sql<StaffingRequestRow[]>`
      SELECT
        id,
        pilot_full_name,
        pilot_email,
        pilot_cid,
        group_name,
        pilot_count,
        event_date,
        time_start,
        time_end,
        description,
        event_banner,
        approved
      FROM staffing
      WHERE (approved IS NULL OR TRIM(approved) = '' OR approved = '0' OR LOWER(TRIM(approved)) IN ('no','pending'))
      ORDER BY id DESC
      LIMIT 200
    `) ?? []
  );
}

export async function setStaffingRequestApproval(id: number, approval: StaffingApproval): Promise<void> {
  await sql`
    UPDATE staffing
    SET approved = ${approval}
    WHERE id = ${id}
  `;
}
