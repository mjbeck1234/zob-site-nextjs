import { NextResponse } from 'next/server';
import { deleteRampCoordEntry, getRampCoordQueue, upsertRampCoordEntry } from '@/lib/ids/ramp';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const icao = (searchParams.get('icao') ?? 'KDTW').trim().toUpperCase();

  try {
    const queue = await getRampCoordQueue(icao);
    return NextResponse.json({ ok: true, icao, queue });
  } catch (e: any) {
    return NextResponse.json({ ok: false, icao, error: e?.message || 'Failed to load coordination queue' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const icao = String(body?.icao ?? 'KDTW').trim().toUpperCase();
    const callsign = String(body?.callsign ?? '').trim();
    const status = String(body?.status ?? 'ready_taxi').trim();
    const note = String(body?.note ?? '').trim();

    const res = await upsertRampCoordEntry(icao, callsign, status, note);
    if (!res.ok) {
      return NextResponse.json({ ok: false, icao, error: res.error ?? 'Failed to save coordination entry' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, icao });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to save coordination entry' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const icao = String(body?.icao ?? 'KDTW').trim().toUpperCase();
    const callsign = String(body?.callsign ?? '').trim();

    const res = await deleteRampCoordEntry(icao, callsign);
    if (!res.ok) {
      return NextResponse.json({ ok: false, icao, error: res.error ?? 'Failed to delete coordination entry' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, icao });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to delete coordination entry' }, { status: 500 });
  }
}
