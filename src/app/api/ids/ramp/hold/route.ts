import { NextResponse } from 'next/server';
import { setRampStandHold } from '@/lib/ids/ramp';
import { getUser } from '@/lib/auth/getUser';
import { deriveRampRoleForAirport, getVatsimPilotIdentityByCid } from '@/lib/ids/ramp';

export const dynamic = 'force-dynamic';

function normalizeMode(raw: string | undefined | null): string {
  const m = String(raw ?? '').trim().toLowerCase();
  if (!m) return 'controller';
  // Only allow small set of modes for auditing.
  if (m === 'controller' || m === 'ids' || m === 'admin' || m === 'staff') return m;
  return 'controller';
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const icao = String(body?.icao ?? 'KDTW').trim().toUpperCase();
    const standId = String(body?.standId ?? '').trim();
    const standLabel = String(body?.standLabel ?? body?.standRef ?? '').trim();
    const hold = Boolean(body?.hold ?? true);
    const modeRaw = String(body?.mode ?? '').trim().toLowerCase();
    let note = String(body?.note ?? '').trim();

    let createdByCid: number | undefined;
    let createdByMode: string | undefined;

    // Pilot mode: require login; derive callsign from CID on the VATSIM feed and enforce ARR/DEP rules.
    if (modeRaw === 'pilot') {
      const user = await getUser();
      if (!user) return NextResponse.json({ ok: false, icao, error: 'not_logged_in' }, { status: 401 });
      createdByCid = user.cid;
      createdByMode = 'pilot';

      const identity = await getVatsimPilotIdentityByCid(user.cid);
      if (!identity) {
        return NextResponse.json({ ok: false, icao, error: 'pilot_not_found' }, { status: 403 });
      }

      const role = deriveRampRoleForAirport(icao, identity.flightPlan ?? null);

      // Creating a hold requires a valid flight plan for the airport.
      if (hold && !role) {
        return NextResponse.json({ ok: false, icao, error: 'flight_plan_not_for_airport' }, { status: 403 });
      }

      // Must be connected on the network to create a reservation.
      // Prefiles are view-only.
      if (hold && !identity.connected) {
        return NextResponse.json({ ok: false, icao, error: 'requires_connected' }, { status: 403 });
      }

      // Clamp user note length to keep holds readable.
      const extra = note ? note.slice(0, 80).trim() : '';
      const prefix = role ? `${identity.callsign} ${role}` : identity.callsign;
      note = hold ? (extra ? `${prefix} - ${extra}` : prefix) : '';
    } else {
      // Controller/IDS mode: require login so holds are auditable.
      const user = await getUser();
      if (!user) return NextResponse.json({ ok: false, icao, error: 'not_logged_in' }, { status: 401 });
      createdByCid = user.cid;
      createdByMode = normalizeMode(modeRaw);
      // Note is free-form; keep it short.
      note = note ? note.slice(0, 120).trim() : '';
    }

    // Pilot reservations are fixed to 30 minutes.
    const ttlMinutes = modeRaw === 'pilot' && hold ? 30 : undefined;

    const res = await setRampStandHold(icao, standId, hold, note, ttlMinutes, createdByCid, createdByMode, standLabel);
    if (!res.ok) {
      const code = String(res.error ?? 'Failed to update hold').trim();
      const status = code === 'stand_already_held' ? 409 : 400;
      const msg =
        code === 'stand_already_held'
          ? 'That stand is already reserved.'
          : code === 'schema_mismatch'
            ? 'DB schema mismatch (expires_at_ms must be BIGINT).'
            : code || 'Failed to update hold';
      return NextResponse.json({ ok: false, icao, error: msg, code }, { status });
    }

    return NextResponse.json({
      ok: true,
      icao,
      ...(res.expiresAt ? { expiresAt: res.expiresAt } : {}),
      ...(typeof (res as any).persisted === 'boolean' ? { persisted: (res as any).persisted } : {}),
      ...(typeof (res as any).dbEnabled === 'boolean' ? { dbEnabled: (res as any).dbEnabled } : {}),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to update hold' }, { status: 500 });
  }
}
