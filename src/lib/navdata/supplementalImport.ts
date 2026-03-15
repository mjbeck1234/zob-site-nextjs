import 'server-only';

import { insertAirports, insertFixes, insertNav } from '@/lib/idsCoreData';

export type NavdataScope = 'region' | 'north_america' | 'global';

const REGION_BBOX = { minLat: 36, maxLat: 47.8, minLon: -93.5, maxLon: -71.0 };
const NA_BBOX = { minLat: 5, maxLat: 85, minLon: -170, maxLon: -45 };

function inBbox(lat: number, lon: number, bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number }) {
  return lat >= bbox.minLat && lat <= bbox.maxLat && lon >= bbox.minLon && lon <= bbox.maxLon;
}

function allowPoint(lat: number, lon: number, scope: NavdataScope): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (scope === 'global') return true;
  if (scope === 'north_america') return inBbox(lat, lon, NA_BBOX);
  return inBbox(lat, lon, REGION_BBOX);
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

async function flushInChunks<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<void>) {
  for (let i = 0; i < rows.length; i += size) {
    await fn(rows.slice(i, i + size));
  }
}

export async function importSupplementalNavdata(args: {
  scope: NavdataScope;
  airportsCsvText?: string | null;
  earthFixDatText?: string | null;
  earthNavDatText?: string | null;
}): Promise<{ inserted: Record<string, number> }> {
  const { scope, airportsCsvText, earthFixDatText, earthNavDatText } = args;
  const airports: Array<{ arpt_id: string; lat: number; lon: number }> = [];
  const fixes: Array<{ fix_id: string; lat: number; lon: number }> = [];
  const nav: Array<{ nav_id: string; name: string | null; lat: number; lon: number }> = [];

  if (airportsCsvText) {
    const lines = airportsCsvText.split(/\r?\n/).filter(Boolean);
    if (lines.length > 1) {
      const header = splitCsvLine(lines[0]).map((x) => x.trim().toLowerCase());
      const identIdx = header.indexOf('ident');
      const latIdx = header.indexOf('latitude_deg');
      const lonIdx = header.indexOf('longitude_deg');
      for (let i = 1; i < lines.length; i++) {
        const cols = splitCsvLine(lines[i]);
        const ident = String(cols[identIdx] ?? '').trim().toUpperCase();
        const lat = Number(cols[latIdx]);
        const lon = Number(cols[lonIdx]);
        if (!ident || !allowPoint(lat, lon, scope)) continue;
        airports.push({ arpt_id: ident, lat, lon });
      }
    }
  }

  if (earthFixDatText) {
    const lines = earthFixDatText.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('I') || line.startsWith('A') || line.startsWith('99')) continue;
      const parts = line.split(/\s+/);
      if (parts.length < 3) continue;
      const lat = Number(parts[0]);
      const lon = Number(parts[1]);
      const ident = String(parts[2] ?? '').trim().toUpperCase();
      if (!ident || !allowPoint(lat, lon, scope)) continue;
      fixes.push({ fix_id: ident, lat, lon });
    }
  }

  if (earthNavDatText) {
    const lines = earthNavDatText.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('I') || line.startsWith('A') || line.startsWith('99')) continue;
      const parts = line.split(/\s+/);
      if (parts.length < 8) continue;
      const recordType = Number(parts[0]);
      if (!Number.isFinite(recordType)) continue;
      const lat = Number(parts[1]);
      const lon = Number(parts[2]);
      const ident = String(parts[7] ?? '').trim().toUpperCase();
      const name = parts.length > 8 ? parts.slice(8).join(' ').trim() : null;
      if (!ident || !allowPoint(lat, lon, scope)) continue;
      nav.push({ nav_id: ident, name: name || null, lat, lon });
    }
  }

  await flushInChunks(airports, 1000, insertAirports);
  await flushInChunks(fixes, 2000, insertFixes);
  await flushInChunks(nav, 2000, insertNav);

  return {
    inserted: {
      airports: airports.length,
      fixes: fixes.length,
      nav: nav.length,
    },
  };
}
