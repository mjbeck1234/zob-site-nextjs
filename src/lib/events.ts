import { sql } from '@/lib/db';
import { tableHasColumn } from '@/lib/schema';

function toBoolInt(v: any): boolean {
  if (v === true) return true;
  if (v === false) return false;
  if (v === null || v === undefined) return false;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on';
}

function isoFromStoredFields(dateStr: any, timeStr: any) {
  const d = String(dateStr ?? '').trim();
  const t = String(timeStr ?? '').trim();
  if (!d && !t) return null;
  // Some dumps store time_start as an ISO-like datetime already.
  if (t.includes('T') && t.length >= 16) {
    const maybe = new Date(t);
    return Number.isNaN(maybe.getTime()) ? null : maybe.toISOString();
  }

  // time could be HHMM or HH:MM
  let hh = '00';
  let mm = '00';
  if (/^\d{3,4}$/.test(t)) {
    const p = t.padStart(4, '0');
    hh = p.slice(0, 2);
    mm = p.slice(2, 4);
  } else if (/^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(':');
    hh = String(h).padStart(2, '0');
    mm = String(m).padStart(2, '0');
  }

  if (!d) return null;
  const local = new Date(`${d}T${hh}:${mm}:00`);
  return Number.isNaN(local.getTime()) ? null : local.toISOString();
}

function mapEventRow(r: any) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    host: r.host,
    banner_path: r.banner_path,
    published: String(r.published ?? '').toLowerCase() === 'yes' || toBoolInt(r.published),
    assignments_published: toBoolInt(r.assignments_published),
    archived: toBoolInt(r.archived),
    shift_1_label: r.shift_1 ?? '',
    shift_2_label: r.shift_2 ?? '',
    max_shifts_per_user: Number(r.max_shifts_per_user ?? 1),
    // Normalize to common fields the UI uses
    start_at: isoFromStoredFields(r.event_date, r.time_start),
    end_at: isoFromStoredFields(r.event_date, r.time_end),
    // keep existing fields around too
    event_date: r.event_date,
    time_start: r.time_start,
    time_end: r.time_end,
  };
}

function storedStartSortExpr(order: 'ASC' | 'DESC') {
  // Robust ordering across common existing formats:
  // - ISO-like (YYYY-MM-DDTHH:mm)
  // - HH:MM
  // - HHMM / HMM
  return `(
    CASE
      WHEN time_start REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}'
        THEN STR_TO_DATE(time_start, '%Y-%m-%dT%H:%i')
      WHEN time_start REGEXP '^[0-9]{1,2}:[0-9]{2}$'
        THEN STR_TO_DATE(CONCAT(event_date, ' ', LPAD(SUBSTRING_INDEX(time_start,':',1),2,'0'), ':', SUBSTRING_INDEX(time_start,':',-1)), '%Y-%m-%d %H:%i')
      WHEN time_start REGEXP '^[0-9]{3,4}$'
        THEN STR_TO_DATE(CONCAT(event_date, ' ', SUBSTR(LPAD(time_start,4,'0'),1,2), ':', SUBSTR(LPAD(time_start,4,'0'),3,2)), '%Y-%m-%d %H:%i')
      ELSE STR_TO_DATE(CONCAT(event_date, ' 00:00'), '%Y-%m-%d %H:%i')
    END
  ) ${order}, id ${order}`;
}

export async function getEventById(id: number) {
  const rows = await sql<any[]>`
    SELECT *
    FROM events
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows?.[0] ? mapEventRow(rows[0]) : null;
}

export async function getEventPositions(eventId: number) {
  const rows = await sql<any[]>`
    SELECT *
    FROM event_positions
    WHERE event_id = ${eventId}
    ORDER BY id ASC
  `;
  return rows ?? [];
}

export async function getEventSignups(eventId: number) {
  // Stored event_signups table.
  const rows = await sql<any[]>`
    SELECT *
    FROM event_signups
    WHERE event_id = ${eventId}
    ORDER BY id ASC
  `;
  return rows ?? [];
}

/**
 * Fetch signups for a single controller for a given event.
 * This is safe to use for normal users (shows only their own rows).
 */
export async function getEventSignupsForCid(eventId: number, cid: number) {
  const rows = await sql<any[]>`
    SELECT *
    FROM event_signups
    WHERE event_id = ${eventId}
      AND controller_cid = ${cid}
    ORDER BY id ASC
  `;
  return rows ?? [];
}

/**
 * Fetch signups for a controller across multiple event ids.
 */
export async function getEventSignupsForCidAcrossEvents(cid: number, eventIds: number[]) {
  const ids = (eventIds ?? []).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) return [] as any[];
  const rows = await sql<any[]>`
    SELECT *
    FROM event_signups
    WHERE controller_cid = ${cid}
      AND event_id IN ${sql.in(ids)}
    ORDER BY event_id ASC, id ASC
  `;
  return rows ?? [];
}

/**
 * Fetch assignment rows (event_positions) where this controller is assigned to shift_1 and/or shift_2.
 * This is used for "your upcoming assignments" displays.
 */
export async function getEventAssignmentsForCidAcrossEvents(cid: number, eventIds: number[]) {
  const ids = (eventIds ?? []).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) return [] as any[];
  const cidStr = String(cid);
  const rows = await sql<any[]>`
    SELECT id, event_id, position_name, shift_1, shift_2
    FROM event_positions
    WHERE event_id IN ${sql.in(ids)}
      AND (shift_1 = ${cidStr} OR shift_2 = ${cidStr})
    ORDER BY event_id ASC, id ASC
  `;
  return rows ?? [];
}

export async function listPublishedEvents(opts?: {
  includeArchived?: boolean;
  order?: 'asc' | 'desc';
  limit?: number;
  fromToday?: boolean;
}) {
  const includeArchived = Boolean(opts?.includeArchived);
  const fromToday = Boolean(opts?.fromToday);
  const safeLimit = Math.max(1, Math.min(500, Number.isFinite(opts?.limit as any) ? Number(opts?.limit) : 200));
  const order: 'ASC' | 'DESC' = (opts?.order ?? 'asc') === 'desc' ? 'DESC' : 'ASC';

  const hasEventDate = await tableHasColumn('events', 'event_date').catch(() => false);
  const hasArchived = await tableHasColumn('events', 'archived').catch(() => false);

  if (hasEventDate) {
    // Support existing (Yes/No) and numeric/boolean (1/0) published formats.
    const where: string[] = [`(published = 'Yes' OR published = 1 OR published = '1' OR published = TRUE)`];
    if (hasArchived && !includeArchived) where.push(`archived = 0`);
    if (fromToday) where.push(`event_date >= CURDATE()`);

    const rows = await sql<any[]>`
      SELECT *
      FROM events
      WHERE ${sql.unsafe(where.join(' AND '))}
      ORDER BY ${sql.unsafe(storedStartSortExpr(order))}
      LIMIT ${sql.unsafe(String(safeLimit))}
    `;
    return (rows ?? []).map(mapEventRow);
  }

  // Fallback: generic schema
  const rows = await sql<any[]>`
    SELECT *
    FROM events
    ORDER BY id ${sql.unsafe(order)}
    LIMIT ${sql.unsafe(String(safeLimit))}
  `;
  return (rows ?? []).map(mapEventRow);
}

export async function getUpcomingPublishedEvents(limit = 50) {
  // Some installs use event_date/time_start.
  const hasEventDate = await tableHasColumn('events', 'event_date').catch(() => false);
  if (hasEventDate) {
    // Upcoming = published + not archived + from today onward.
    return listPublishedEvents({ includeArchived: false, order: 'asc', limit, fromToday: true });
  }

  // Fallback: best effort.
  return listPublishedEvents({ includeArchived: false, order: 'asc', limit });
}
