import { NextResponse } from 'next/server';
import { getRampStands } from '@/lib/ids/ramp';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const icao = (searchParams.get('icao') ?? 'KDTW').trim().toUpperCase();

  try {
    const { stands, center, bbox } = await getRampStands(icao);
    return NextResponse.json({ ok: true, icao, center, bbox, stands });
  } catch (e: any) {
    return NextResponse.json({ ok: false, icao, error: e?.message || 'Failed to load stands' }, { status: 500 });
  }
}
