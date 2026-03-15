import { NextResponse } from 'next/server';
import { getRampOccupancy } from '@/lib/ids/ramp';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const icao = (searchParams.get('icao') ?? 'KDTW').trim().toUpperCase();

  try {
    const data = await getRampOccupancy(icao);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ ok: false, icao, error: e?.message || 'Failed to compute occupancy' }, { status: 500 });
  }
}
