import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/getUser';
import { claimRampStand, claimRampStandOffline, deriveRampRoleForAirport, getVatsimPilotIdentityByCid, unclaimRampStand } from '@/lib/ids/ramp';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const icao = String(body?.icao ?? 'KDTW').trim().toUpperCase();
    const standId = String(body?.standId ?? '').trim();

    // For pilot mode, we do not trust caller-provided callsigns.
    // Instead, derive the active pilot callsign from the logged-in user's CID.
    const mode = String(body?.mode ?? '').trim().toLowerCase();
    let callsign = String(body?.callsign ?? '').trim();
    let offlineClaim = false;
    if (mode === 'pilot') {
      const user = await getUser();
      if (!user) {
        return NextResponse.json({ ok: false, icao, error: 'not_logged_in' }, { status: 401 });
      }
      const identity = await getVatsimPilotIdentityByCid(user.cid);
      if (!identity) {
        return NextResponse.json({ ok: false, icao, error: 'pilot_not_found' }, { status: 403 });
      }
      const role = deriveRampRoleForAirport(icao, identity.flightPlan ?? null);
      if (!role) {
        return NextResponse.json({ ok: false, icao, error: 'flight_plan_not_for_airport' }, { status: 403 });
      }
      // Allow assigning from a prefile for departures (DEP). Arrivals still require being connected.
      if (!identity.connected && role !== 'DEP') {
        return NextResponse.json({ ok: false, icao, error: 'not_connected_as_pilot' }, { status: 403 });
      }
      offlineClaim = !identity.connected && role === 'DEP';
      callsign = identity.callsign;
    }

    const res = offlineClaim ? await claimRampStandOffline(icao, standId, callsign) : await claimRampStand(icao, standId, callsign);
    if (!res.ok) {
      return NextResponse.json({ ok: false, icao, error: res.error ?? 'Failed to claim stand' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, icao });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to claim stand' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const icao = String(body?.icao ?? 'KDTW').trim().toUpperCase();
    const standId = String(body?.standId ?? '').trim();

    const res = await unclaimRampStand(icao, standId);
    if (!res.ok) {
      return NextResponse.json({ ok: false, icao, error: res.error ?? 'Failed to unclaim stand' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, icao });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to unclaim stand' }, { status: 500 });
  }
}
