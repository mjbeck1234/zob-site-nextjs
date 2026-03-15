'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireZobMember } from '@/lib/auth/guards';
import { sql } from '@/lib/db';

function pick(formData: FormData, k: string): string | undefined {
  const v = formData.get(k);
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

export async function signupForEventAction(formData: FormData) {
  const user = await requireZobMember();

  const eventId = Number(pick(formData, 'event_id'));
  if (!Number.isFinite(eventId)) redirect('/events');

  // Determine whether this event supports Shift 2 (current schema stores a label in events.shift_2).
  const eventRows = await sql<{ shift_2?: string | null }[]>`
    SELECT shift_2 FROM events WHERE id = ${eventId} LIMIT 1
  `;
  const hasShift2 = Boolean(String(eventRows?.[0]?.shift_2 ?? '').trim());

  const anyPosition = Boolean(pick(formData, 'any_position'));
  const rawIds = [
    pick(formData, 'event_position_id_1'),
    pick(formData, 'event_position_id_2'),
    pick(formData, 'event_position_id_3'),
  ];
  let posIds = rawIds
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);

  // De-dupe while preserving order.
  posIds = posIds.filter((id, i) => posIds.indexOf(id) === i);

  if (anyPosition) {
    // If Any Position is selected, it must be the ONLY selection.
    posIds = [];
  } else {
    // Up to 3 specific picks.
    posIds = posIds.slice(0, 3);
  }

  const shift1 = Boolean(pick(formData, 'shift_1'));
  const shift2 = hasShift2 ? Boolean(pick(formData, 'shift_2')) : false;
  // If neither is selected, default to Shift 1.
  const s1 = shift1 || (!shift1 && !shift2);
  const s2 = shift2;
  // Stored event_signups.shifts_available is a varchar in dump, usually:
  // 0 = both/any, 1 = shift 1, 2 = shift 2 (some installs may store bitmask 3).
  const shiftsAvailable = s1 === s2 ? '0' : s1 ? '1' : '2';

  // Build selections list.
  const selections: Array<{ position_id: number; position_name: string }> = [];
  if (anyPosition) selections.push({ position_id: 0, position_name: 'Any Position' });
  for (const id of posIds) {
    const posRows = await sql<{ position_name: string }[]>`
      SELECT position_name FROM event_positions WHERE id = ${id} LIMIT 1
    `;
    selections.push({ position_id: id, position_name: posRows?.[0]?.position_name ?? String(id) });
  }

  if (!selections.length) {
    // Nothing selected.
    redirect(`/events/${eventId}`);
  }

  // Keep the existing behavior: a controller can have up to 3 signup rows per event.
  // We treat the form submission as the authoritative set.
  await sql`
    DELETE FROM event_signups
    WHERE event_id = ${eventId}
      AND controller_cid = ${user.cid}
  `;

  for (const s of selections) {
    await sql`
      INSERT INTO event_signups (position_name, controller_full_name, controller_cid, position_id, shifts_available, event_id)
      VALUES (${s.position_name}, ${user.fullName}, ${user.cid}, ${s.position_id}, ${shiftsAvailable}, ${eventId})
    `;
  }

  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
}

export async function cancelEventSignupAction(formData: FormData) {
  const user = await requireZobMember();
  const signupId = Number(pick(formData, 'signup_id'));
  const eventId = Number(pick(formData, 'event_id'));
  if (!Number.isFinite(signupId) || !Number.isFinite(eventId)) redirect('/events');

  await sql`DELETE FROM event_signups WHERE id = ${signupId} AND controller_cid = ${user.cid}`;
  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
}
