import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireEventsManager } from '@/lib/auth/guards';
import { sql } from '@/lib/db';
import { normalizeBool, normalizeText } from '@/lib/admin/crud';

function pickText(formData: FormData, key: string) {
  const v = formData.get(key);
  return v === null ? undefined : String(v).trim() || undefined;
}

function pickId(formData: FormData, key: string): string | undefined {
  const v = pickText(formData, key);
  return v && v.trim() ? v.trim() : undefined;
}

function yesNoFromBool(v: any): 'Yes' | 'No' {
  return v ? 'Yes' : 'No';
}

function datePartFromDateTimeLocal(dt: string | null | undefined): string {
  const s = String(dt ?? '').trim();
  if (!s) return '';
  return s.slice(0, 10);
}

async function getMaxShiftsPerUser(_eventId: number): Promise<number> {
  return 1;
}

async function countAssignedShifts(eventId: number, controllerCid: string): Promise<number> {
  const cid = String(controllerCid ?? '').trim();
  if (!cid) return 0;
  const rows = await sql<{ c: any }[]>`
    SELECT
      SUM(CASE WHEN shift_1 = ${cid} THEN 1 ELSE 0 END) +
      SUM(CASE WHEN shift_2 = ${cid} THEN 1 ELSE 0 END) AS c
    FROM event_positions
    WHERE event_id = ${eventId}
  `;
  const n = Number(rows?.[0]?.c);
  return Number.isFinite(n) ? n : 0;
}

export async function createEventAction(formData: FormData) {
  'use server';
  await requireEventsManager();

  const start_at = normalizeText(formData.get('start_at')) ?? '';
  const end_at = normalizeText(formData.get('end_at')) ?? '';

  const payload = {
    name: normalizeText(formData.get('name')) ?? '',
    event_date: datePartFromDateTimeLocal(start_at),
    time_start: start_at,
    time_end: end_at,
    description: normalizeText(formData.get('description')) ?? '',
    shift_1: normalizeText(formData.get('shift_1_label')) ?? '',
    shift_2: normalizeText(formData.get('shift_2_label')) ?? '',
    host: normalizeText(formData.get('host')) ?? '',
    banner_path: normalizeText(formData.get('banner_path')) ?? '',
    published: yesNoFromBool(normalizeBool(formData.get('published'))),
    assignments_published: normalizeBool(formData.get('assignments_published')) ? 1 : 0,
    archived: normalizeBool(formData.get('archived')) ? 1 : 0,
  };

  if (!payload.name) redirect('/admin/events/new?error=missing');
  if (!payload.event_date || !payload.time_start) redirect('/admin/events/new?error=missing_date');

  const rows = await sql<{ id: number }[]>`
    INSERT INTO events
      (name, event_date, time_start, time_end, description, shift_1, shift_2, host, banner_path, published, assignments_published, archived)
    VALUES
      (${payload.name}, ${payload.event_date}, ${payload.time_start}, ${payload.time_end}, ${payload.description}, ${payload.shift_1}, ${payload.shift_2}, ${payload.host}, ${payload.banner_path}, ${payload.published}, ${payload.assignments_published}, ${payload.archived})
    RETURNING id
  `;

  const id = rows?.[0]?.id;
  if (!id) redirect('/admin/events?error=create_failed');

  revalidatePath('/events');
  revalidatePath('/');
  revalidatePath('/admin/events');

  redirect(`/admin/events/${id}`);
}

export async function updateEventAction(formData: FormData) {
  'use server';
  await requireEventsManager();

  const id = pickId(formData, 'id');
  if (!id) redirect('/admin/events?error=missing_id');

  const start_at = normalizeText(formData.get('start_at')) ?? '';
  const end_at = normalizeText(formData.get('end_at')) ?? '';

  const payload = {
    name: normalizeText(formData.get('name')) ?? '',
    event_date: datePartFromDateTimeLocal(start_at) || (normalizeText(formData.get('event_date')) ?? ''),
    time_start: start_at,
    time_end: end_at,
    description: normalizeText(formData.get('description')) ?? '',
    shift_1: normalizeText(formData.get('shift_1_label')) ?? '',
    shift_2: normalizeText(formData.get('shift_2_label')) ?? '',
    host: normalizeText(formData.get('host')) ?? '',
    banner_path: normalizeText(formData.get('banner_path')) ?? '',
    published: yesNoFromBool(normalizeBool(formData.get('published'))),
    assignments_published: normalizeBool(formData.get('assignments_published')) ? 1 : 0,
    archived: normalizeBool(formData.get('archived')) ? 1 : 0,
  };

  await sql`
    UPDATE events
    SET
      name = ${payload.name},
      event_date = ${payload.event_date},
      time_start = ${payload.time_start},
      time_end = ${payload.time_end},
      description = ${payload.description},
      shift_1 = ${payload.shift_1},
      shift_2 = ${payload.shift_2},
      host = ${payload.host},
      banner_path = ${payload.banner_path},
      published = ${payload.published},
      assignments_published = ${payload.assignments_published},
      archived = ${payload.archived}
    WHERE id = ${id}
  `;

  if (!String(payload.shift_2 ?? '').trim()) {
    await sql`UPDATE event_positions SET shift_2 = '' WHERE event_id = ${id}`;
  }

  revalidatePath('/events');
  revalidatePath('/');
  revalidatePath('/admin/events');
  revalidatePath(`/admin/events/${id}`);

  redirect(`/admin/events/${id}?saved=1`);
}

export async function deleteEventAction(formData: FormData) {
  'use server';
  await requireEventsManager();

  const id = pickId(formData, 'id');
  if (!id) redirect('/admin/events?error=missing_id');

  await sql`DELETE FROM event_signups WHERE event_id = ${id}`;
  await sql`DELETE FROM event_positions WHERE event_id = ${id}`;
  await sql`DELETE FROM events WHERE id = ${id}`;

  revalidatePath('/events');
  revalidatePath('/');
  revalidatePath('/admin/events');

  redirect('/admin/events?deleted=1');
}

export async function addEventPositionAction(formData: FormData) {
  'use server';
  await requireEventsManager();

  const eventId = pickId(formData, 'event_id');
  if (!eventId) redirect('/admin/events?error=missing_event');

  const eventIdNum = Number(eventId);
  if (!Number.isFinite(eventIdNum)) redirect('/admin/events?error=bad_event');

  const position_name_raw = pickText(formData, 'position_name');
  const position_name = position_name_raw ? position_name_raw.toUpperCase() : undefined;
  if (!position_name) redirect(`/admin/events/${eventId}?error=pos_missing`);

  const shift1 = pickText(formData, 'shift_1') ?? '';
  const shift2 = pickText(formData, 'shift_2') ?? '';

  const existing = await sql<{ id: number }[]>`
    SELECT id FROM event_positions WHERE event_id = ${eventIdNum} AND position_name = ${position_name} LIMIT 1
  `;
  if (existing?.[0]?.id) {
    revalidatePath(`/admin/events/${eventId}`);
    revalidatePath(`/events/${eventId}`);
    redirect(`/admin/events/${eventId}?pos_exists=1`);
  }

  if (String(shift2 ?? '').trim()) {
    const ev = await sql<{ shift_2?: string | null }[]>`SELECT shift_2 FROM events WHERE id = ${eventIdNum} LIMIT 1`;
    const hasShift2 = Boolean(String(ev?.[0]?.shift_2 ?? '').trim());
    if (!hasShift2) {
      revalidatePath(`/admin/events/${eventId}`);
      redirect(`/admin/events/${eventId}?shift2_disabled=1`);
    }
  }

  const maxShifts = await getMaxShiftsPerUser(eventIdNum);
  if (maxShifts > 0) {
    const addCounts: Record<string, number> = {};
    for (const cid of [shift1, shift2]) {
      const c = String(cid ?? '').trim();
      if (!c) continue;
      addCounts[c] = (addCounts[c] ?? 0) + 1;
    }
    for (const [cid, add] of Object.entries(addCounts)) {
      const existingCount = await countAssignedShifts(eventIdNum, cid);
      if (existingCount + add > maxShifts) {
        revalidatePath(`/admin/events/${eventId}`);
        redirect(`/admin/events/${eventId}?max_assigned=1`);
      }
    }
  }

  await sql`
    INSERT INTO event_positions (event_id, position_name, shift_1, shift_2)
    VALUES (${eventIdNum}, ${position_name}, ${shift1}, ${shift2})
  `;

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/events/${eventId}`);
  redirect(`/admin/events/${eventId}?pos_added=1`);
}

export async function deleteEventPositionAction(formData: FormData) {
  'use server';
  await requireEventsManager();

  const eventId = pickId(formData, 'event_id');
  const posId = pickId(formData, 'id');
  if (!eventId || !posId) redirect('/admin/events?error=missing');

  await sql`DELETE FROM event_signups WHERE position_id = ${posId}`;
  await sql`DELETE FROM event_positions WHERE id = ${posId}`;

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/events/${eventId}`);
  redirect(`/admin/events/${eventId}?pos_deleted=1`);
}

export async function setEventPositionAssignmentsAction(formData: FormData) {
  'use server';
  await requireEventsManager();

  const eventId = pickId(formData, 'event_id');
  const posId = pickId(formData, 'id');
  if (!eventId || !posId) redirect('/admin/events?error=missing');

  const shift1 = normalizeText(formData.get('shift_1')) ?? '';
  const shift2 = normalizeText(formData.get('shift_2')) ?? '';
  const eventIdNum = Number(eventId);
  if (!Number.isFinite(eventIdNum)) redirect('/admin/events');

  if (String(shift2 ?? '').trim()) {
    const ev = await sql<{ shift_2?: string | null }[]>`SELECT shift_2 FROM events WHERE id = ${eventIdNum} LIMIT 1`;
    const hasShift2 = Boolean(String(ev?.[0]?.shift_2 ?? '').trim());
    if (!hasShift2) {
      revalidatePath(`/admin/events/${eventId}`);
      redirect(`/admin/events/${eventId}?shift2_disabled=1`);
    }
  }

  const maxShifts = await getMaxShiftsPerUser(eventIdNum);
  if (maxShifts > 0) {
    const cur = await sql<{ shift_1?: string | null; shift_2?: string | null }[]>`
      SELECT shift_1, shift_2 FROM event_positions WHERE id = ${posId} LIMIT 1
    `;
    const old1 = String(cur?.[0]?.shift_1 ?? '').trim();
    const old2 = String(cur?.[0]?.shift_2 ?? '').trim();
    const new1 = String(shift1 ?? '').trim();
    const new2 = String(shift2 ?? '').trim();

    const cids: Record<string, true> = {};
    for (const cid of [old1, old2, new1, new2]) {
      const c = String(cid ?? '').trim();
      if (c) cids[c] = true;
    }

    for (const cid of Object.keys(cids)) {
      const remove = (old1 === cid && new1 !== cid ? 1 : 0) + (old2 === cid && new2 !== cid ? 1 : 0);
      const add = (new1 === cid && old1 !== cid ? 1 : 0) + (new2 === cid && old2 !== cid ? 1 : 0);
      if (add <= 0) continue;
      const existingCount = await countAssignedShifts(eventIdNum, cid);
      const projected = existingCount - remove + add;
      if (projected > maxShifts) {
        revalidatePath(`/admin/events/${eventId}`);
        redirect(`/admin/events/${eventId}?max_assigned=1`);
      }
    }
  }

  await sql`
    UPDATE event_positions
    SET shift_1 = ${shift1}, shift_2 = ${shift2}
    WHERE id = ${posId}
  `;

  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/events/${eventId}`);
  redirect(`/admin/events/${eventId}?assigned=1`);
}

export async function deleteEventSignupAction(formData: FormData) {
  'use server';
  await requireEventsManager();

  const eventId = pickId(formData, 'event_id');
  const signupId = pickId(formData, 'id');
  if (!eventId || !signupId) redirect('/admin/events?error=missing');

  await sql`DELETE FROM event_signups WHERE id = ${signupId}`;
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/events/${eventId}`);
  redirect(`/admin/events/${eventId}?signup_deleted=1`);
}

export async function assignFromSignupAction(formData: FormData) {
  'use server';
  await requireEventsManager();
  const eventId = Number(pickText(formData, 'event_id'));
  const controllerCid = String(pickText(formData, 'controller_cid') ?? '').trim();
  const positionId = Number(pickText(formData, 'position_id') ?? '0');
  const shift = String(pickText(formData, 'shift') ?? '').trim();

  let targetPositionId = positionId;
  if (positionId === 0) {
    targetPositionId = Number(pickText(formData, 'target_position_id') ?? NaN);
  }

  if (!Number.isFinite(eventId) || !controllerCid || !Number.isFinite(targetPositionId) || !(shift === '1' || shift === '2')) {
    redirect('/admin/events');
  }

  const maxShifts = await getMaxShiftsPerUser(eventId);
  if (maxShifts > 0) {
    const cur = await sql<{ shift_1?: string | null; shift_2?: string | null }[]>`
      SELECT shift_1, shift_2 FROM event_positions WHERE event_id = ${eventId} AND id = ${targetPositionId} LIMIT 1
    `;
    const old1 = String(cur?.[0]?.shift_1 ?? '').trim();
    const old2 = String(cur?.[0]?.shift_2 ?? '').trim();
    const new1 = shift === '1' ? controllerCid : old1;
    const new2 = shift === '2' ? controllerCid : old2;

    const existingCount = await countAssignedShifts(eventId, controllerCid);
    const remove = (old1 === controllerCid && new1 !== controllerCid ? 1 : 0) + (old2 === controllerCid && new2 !== controllerCid ? 1 : 0);
    const add = (new1 === controllerCid && old1 !== controllerCid ? 1 : 0) + (new2 === controllerCid && old2 !== controllerCid ? 1 : 0);
    const projected = existingCount - remove + add;
    if (projected > maxShifts) {
      revalidatePath(`/admin/events/${eventId}`);
      redirect(`/admin/events/${eventId}?max_assigned=1`);
    }
  }

  if (shift === '2') {
    const ev = await sql<{ shift_2?: string | null }[]>`SELECT shift_2 FROM events WHERE id = ${eventId} LIMIT 1`;
    const hasShift2 = Boolean(String(ev?.[0]?.shift_2 ?? '').trim());
    if (!hasShift2) {
      revalidatePath(`/admin/events/${eventId}`);
      redirect(`/admin/events/${eventId}?shift2_disabled=1`);
    }
  }

  if (shift === '1') {
    await sql`
      UPDATE event_positions
      SET shift_1 = ${controllerCid}
      WHERE event_id = ${eventId} AND id = ${targetPositionId}
    `;
  } else {
    await sql`
      UPDATE event_positions
      SET shift_2 = ${controllerCid}
      WHERE event_id = ${eventId} AND id = ${targetPositionId}
    `;
  }

  revalidatePath(`/admin/events/${eventId}`);
  redirect(`/admin/events/${eventId}?assigned=1`);
}
