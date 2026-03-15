import { NextResponse } from 'next/server';
import { getRampBackground } from '@/lib/ids/ramp';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const icao = (searchParams.get('icao') ?? 'KDTW').trim().toUpperCase();

  try {
    const data = await getRampBackground(icao);
    return NextResponse.json({ ok: true, icao, geojson: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, icao, error: e?.message || 'Failed to load ramp background' }, { status: 500 });
  }
}
