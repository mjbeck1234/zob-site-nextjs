import { NextResponse } from 'next/server';
import { loadIdsJson } from '@/lib/idsStaticData';
import { preferShortAirportCode } from '@/lib/ids/airportCode';

export const dynamic = 'force-dynamic';

type RawCrossing = {
  destination: string;
  artcc: string;
  bdry_fix: string;
  restriction?: string;
  notes?: string;
};

const norm = (s: string) => preferShortAirportCode(s);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const field = norm(url.searchParams.get('field') ?? '');

  if (!field) {
    return NextResponse.json({ error: 'Missing field' }, { status: 400 });
  }

  const rawAny = await loadIdsJson<any>('static/ids.crossings.json');
  // Be tolerant: some sources wrap arrays (e.g. {data:[...]}).
  const raw: RawCrossing[] = Array.isArray(rawAny)
    ? rawAny
    : Array.isArray(rawAny?.data)
      ? rawAny.data
      : Array.isArray(rawAny?.items)
        ? rawAny.items
        : Array.isArray(rawAny?.crossings)
          ? rawAny.crossings
          : [];

  const results = raw
    .filter((r) => norm(r.destination) === field)
    .map((r) => ({
      field,
      fix: r.bdry_fix,
      restriction: r.restriction ?? '',
      notes: r.notes ?? '',
      artcc_giving: 'ZOB',
      artcc_receiving: r.artcc,
    }));

  return NextResponse.json(results);
}
