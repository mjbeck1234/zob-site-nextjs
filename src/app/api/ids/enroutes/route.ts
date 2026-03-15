import { NextResponse } from 'next/server';
import { loadIdsJson } from '@/lib/idsStaticData';
import { preferShortAirportCode } from '@/lib/ids/airportCode';

export const dynamic = 'force-dynamic';

type RawEnroute = {
  Field: string;
  Qualifier?: string;
  Areas: string | number;
  Rule?: string;
};

const norm = (s: string) => preferShortAirportCode(s);

function parseFields(v: string): string[] {
  return String(v ?? '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => norm(s));
}

function parseAreas(v: string | number): number[] {
  if (typeof v === 'number') return [v];
  return String(v ?? '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const field = norm(url.searchParams.get('field') ?? '');
  const areaStr = url.searchParams.get('area') ?? '';
  const area = areaStr ? Number(areaStr) : null;

  if (!field) return NextResponse.json({ error: 'Missing field' }, { status: 400 });

  const rawAny = await loadIdsJson<any>('static/ids.enroute.json');
  // Be tolerant: some sources wrap arrays (e.g. {data:[...]}, {enroutes:[...]}).
  const raw: RawEnroute[] = Array.isArray(rawAny)
    ? rawAny
    : Array.isArray(rawAny?.data)
      ? rawAny.data
      : Array.isArray(rawAny?.enroutes)
        ? rawAny.enroutes
        : Array.isArray(rawAny?.records)
          ? rawAny.records
          : [];

  const results = raw
    .map((r) => {
      const fields = parseFields(r.Field);
      const areas = parseAreas(r.Areas);
      return {
        fields,
        qualifier: r.Qualifier ?? '',
        areas,
        rule: r.Rule ?? '',
      };
    })
    .filter((r) => r.fields.includes(field))
    .filter((r) => (area ? r.areas.includes(area) : true));

  return NextResponse.json(results);
}
