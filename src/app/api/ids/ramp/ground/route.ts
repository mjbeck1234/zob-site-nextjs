import { NextResponse } from 'next/server';
import { getRampGroundTraffic } from '@/lib/ids/ramp';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const icao = (searchParams.get('icao') ?? 'KDTW').trim().toUpperCase();

  try {
    const traffic = await getRampGroundTraffic(icao);
    return NextResponse.json({ ok: true, icao, traffic });
  } catch (e: any) {
    return NextResponse.json({ ok: false, icao, error: e?.message || 'Failed to load ground traffic' }, { status: 500 });
  }
}
