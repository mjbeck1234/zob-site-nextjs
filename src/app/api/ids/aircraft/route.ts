import { NextResponse } from 'next/server';
import { withLiveCache } from '@/lib/idsStaticData';

export const dynamic = 'force-dynamic';

const jsonOrNull = async (url: string) => {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number) {
  // Earth radius in nautical miles
  const R = 3440.065;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function GET() {
  const data = await withLiveCache('ids.aircraft', 60, async () => {
    let vatsimUrl: string | null = null;
    const status = await jsonOrNull('https://status.vatsim.net/status.json');
    if (status?.data?.v3 && Array.isArray(status.data.v3) && status.data.v3.length) {
      vatsimUrl = status.data.v3[0];
    }
    const vatsim = vatsimUrl ? await jsonOrNull(vatsimUrl) : null;
    const pilots = Array.isArray(vatsim?.pilots) ? vatsim.pilots : [];

    // Rough ZOB center point
    const center = { lat: 41.21, lon: -82.94 };
    const radiusNm = 500;

    const nearby = pilots
      .filter((p: any) => p?.latitude != null && p?.longitude != null)
      .map((p: any) => ({
        ...p,
        _d: haversineNm(center.lat, center.lon, Number(p.latitude), Number(p.longitude)),
      }))
      .filter((p: any) => p._d <= radiusNm)
      .sort((a: any, b: any) => a._d - b._d)
      .slice(0, 250);

    // Stored IDS expects { aircraft, count }. Keep { pilots } for backwards compatibility.
    return { aircraft: nearby, count: nearby.length, pilots: nearby };
  });

  return NextResponse.json(data);
}
