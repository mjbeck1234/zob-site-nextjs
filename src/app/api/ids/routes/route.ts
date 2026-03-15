import { NextResponse } from 'next/server';
import { loadIdsJson, loadIdsDataset } from '@/lib/idsStaticData';
import { getPfrRoutes } from '@/lib/idsCoreData';
import { preferShortAirportCode } from '@/lib/ids/airportCode';

export const dynamic = 'force-dynamic';

type CustomRoute = {
  origin: string;
  destination: string;
  route: string;
  alt?: string | number;
  notes?: string;
};

type FaaRoute = {
  Origin: string;
  Dest: string;
  RouteString: string;
  RouteType?: string;
  Area?: string;
};

// Allow users to enter ICAO (KDTW/CYYZ) while matching datasets that commonly
// store 3-letter codes (DTW/YYZ).
const normApt = (s: string) => preferShortAirportCode(s);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dep = normApt(url.searchParams.get('dep') ?? '');
  const dest = normApt(url.searchParams.get('dest') ?? '');

  if (!dep || !dest) {
    return NextResponse.json({ error: 'Missing dep/dest' }, { status: 400 });
  }

  // Prefer the normalized PFR table to avoid loading a giant JSON array into memory.
  const [customAny, faaDb] = await Promise.all([
    loadIdsJson<any>('static/ids.routes.json'),
    (async () => { try { return await getPfrRoutes(dep, dest); } catch (err) { console.error("[ids/routes] getPfrRoutes failed; falling back to static routes only:", err); return []; } })(),
  ]);

  // Some sources wrap arrays (e.g. {data:[...]}, {routes:[...]}). Normalize.
  const custom: CustomRoute[] = Array.isArray(customAny)
    ? customAny
    : (Array.isArray(customAny?.data) ? customAny.data : (Array.isArray(customAny?.routes) ? customAny.routes : []));

  // Back-compat fallback: if the PFR table is empty (e.g. older DB), use ids_datasets.
  let faaFallback: FaaRoute[] | null = null;
  if (!faaDb?.length) {
    const ds = await loadIdsDataset<FaaRoute[]>('faa');
    faaFallback = ds.data ?? null;
  }

  const customMatches = custom
    .filter((r) => normApt(r.origin) === dep && normApt(r.destination) === dest)
    .map((r) => ({
      dep,
      dest,
      route: String(r.route ?? '').trim(),
      altitude: r.alt != null ? String(r.alt) : '',
      notes: r.notes ?? '',
      source: 'custom' as const,
    }));

  const faaMatches = (faaDb?.length
    ? faaDb.map((r) => ({ Origin: dep, Dest: dest, RouteString: r.route_string, RouteType: r.route_type ?? undefined }))
    : (faaFallback ?? []).filter((r) => normApt(r.Origin) === dep && normApt(r.Dest) === dest)
  ).map((r: any) => ({
      dep,
      dest,
      route: String(r.RouteString ?? '').trim(),
      altitude: '',
      notes: r.RouteType ? `FAA ${r.RouteType}` : 'FAA preferred',
      source: 'faa' as const,
    }));

  return NextResponse.json([...customMatches, ...faaMatches]);
}
