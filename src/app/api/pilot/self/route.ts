import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/getUser';
import { deriveRampRoleForAirport, getPilotRampReservation, getVatsimPilotIdentityByCid } from '@/lib/ids/ramp';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 });
    }

    // For now, Ramp Gate Selection supports KDTW only.
    const supportedAirport = 'KDTW';
    const reservation = await getPilotRampReservation(supportedAirport, user.cid);

    const identity = await getVatsimPilotIdentityByCid(user.cid);
    if (!identity) {
      // Map is still viewable; treat this as a soft failure.
      return NextResponse.json(
        {
          ok: false,
          error: 'not_on_network_feed',
          cid: user.cid,
          ramp: {
            airport: supportedAirport,
            role: null,
            canReserve: false,
            canAssign: false,
            reason: 'not_on_network_feed',
          },
          reservation: reservation
            ? {
                airport: reservation.icao,
                standId: reservation.standId,
                standRef: reservation.standRef ?? null,
                note: reservation.note ?? null,
                expiresAtMs: reservation.expiresAtMs,
              }
            : null,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const fp = identity.flightPlan ?? null;
    const planDep = String(fp?.departure ?? '').trim().toUpperCase();
    const planArr = String(fp?.arrival ?? '').trim().toUpperCase();

    // Prefer ARR when both match.
    const role = fp ? deriveRampRoleForAirport(supportedAirport, fp) : null;

    // Reserve rules:
    // - Must be connected on the network (prefiles are view-only)
    const canReserve = Boolean(role) && identity.connected;
    // Pilot page is reserve-only.
    const canAssign = false;

    let reason: string | null = null;
    if (!fp || (!planDep && !planArr)) reason = 'no_flight_plan';
    else if (!role) reason = 'flight_plan_not_for_airport';
    else if (role && !identity.connected) reason = 'requires_connected';

    return NextResponse.json(
      {
        ok: true,
        cid: identity.cid,
        callsign: identity.callsign,
        connected: identity.connected,
        source: identity.source,
        flightPlan: {
          departure: fp?.departure ?? null,
          arrival: fp?.arrival ?? null,
        },
        ramp: {
          airport: supportedAirport,
          role,
          canReserve,
          canAssign,
          reason,
        },
        reservation: reservation
          ? {
              airport: reservation.icao,
              standId: reservation.standId,
              standRef: reservation.standRef ?? null,
              note: reservation.note ?? null,
              expiresAtMs: reservation.expiresAtMs,
            }
          : null,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}
