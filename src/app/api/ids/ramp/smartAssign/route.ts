import { NextResponse } from 'next/server';
import { smartAssignRampStand } from '@/lib/ids/ramp';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const icao = String(body?.icao ?? 'KDTW').trim().toUpperCase();
    const callsign = String(body?.callsign ?? '').trim();
    const preferredAreaId = String(body?.preferredAreaId ?? '').trim();

    const res = await smartAssignRampStand(icao, callsign, preferredAreaId || undefined);
    if (!res.ok) {
      return NextResponse.json({ ok: false, icao, error: res.error ?? 'Failed to smart assign' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, icao, standId: res.standId, ref: res.ref, areaId: res.areaId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to smart assign' }, { status: 500 });
  }
}
