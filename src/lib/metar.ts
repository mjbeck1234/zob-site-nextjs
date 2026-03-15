export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR';

export type MetarInfo = {
  icao: string;
  raw: string | null;
  category: FlightCategory | null;
  visibilitySm: number | null;
  ceilingFt: number | null;
  fetchedAtIso: string;
  source: 'noaa-tgftp';
};

function parseFraction(frac: string): number | null {
  const parts = String(frac).split('/').map((x) => x.trim());
  if (parts.length !== 2) return null;
  const n = Number(parts[0]);
  const d = Number(parts[1]);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  return n / d;
}

function parseVisibilitySm(raw: string): number | null {
  const up = raw.toUpperCase();

  // P6SM => greater than 6SM; treat as 6 for categorization.
  const p6 = up.match(/\bP6SM\b/);
  if (p6) return 6;

  // Examples:
  // 10SM
  // 1/2SM
  // 2 1/2SM
  // 3SM
  const m = up.match(/\b(\d+)?\s*(\d+\/\d+)?SM\b/);
  if (!m) return null;

  const whole = m[1] ? Number(m[1]) : 0;
  const frac = m[2] ? parseFraction(m[2]) : 0;

  const vis = (Number.isFinite(whole) ? whole : 0) + (typeof frac === 'number' && Number.isFinite(frac) ? frac : 0);
  return Number.isFinite(vis) && vis > 0 ? vis : null;
}

function parseCeilingFt(raw: string): number | null {
  const up = raw.toUpperCase();
  // Lowest BKN/OVC/VV group is the ceiling.
  const matches = [...up.matchAll(/\b(?:BKN|OVC|VV)(\d{3})\b/g)];
  if (!matches.length) return null;

  let min: number | null = null;
  for (const m of matches) {
    const h = Number(m[1]);
    if (!Number.isFinite(h)) continue;
    const ft = h * 100;
    if (!min || ft < min) min = ft;
  }
  return min;
}

function deriveCategory(visSm: number | null, ceilingFt: number | null): FlightCategory | null {
  // If we have neither, we can't reliably categorize.
  if (visSm == null && ceilingFt == null) return null;

  // Treat missing values as "very good" for the purposes of the other dimension.
  const v = visSm ?? 99;
  const c = ceilingFt ?? 99999;

  if (v < 1 || c < 500) return 'LIFR';
  if (v < 3 || c < 1000) return 'IFR';
  if (v <= 5 || c < 3000) return 'MVFR';
  return 'VFR';
}

export async function fetchMetarNoaa(icao: string): Promise<MetarInfo> {
  const up = String(icao ?? '').trim().toUpperCase();
  const fetchedAtIso = new Date().toISOString();

  if (!up) {
    return { icao: up, raw: null, category: null, visibilitySm: null, ceilingFt: null, fetchedAtIso, source: 'noaa-tgftp' };
  }

  try {
    const res = await fetch(`https://tgftp.nws.noaa.gov/data/observations/metar/stations/${up}.TXT`, {
      // Refresh fairly often, but allow caching to avoid hammering NOAA.
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return { icao: up, raw: null, category: null, visibilitySm: null, ceilingFt: null, fetchedAtIso, source: 'noaa-tgftp' };
    }

    const txt = await res.text();
    const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    // Usually: line 0 = timestamp, line 1 = METAR
    const metar = lines.length >= 2 ? lines[1] : (lines[0] || null);

    const visibilitySm = metar ? parseVisibilitySm(metar) : null;
    const ceilingFt = metar ? parseCeilingFt(metar) : null;
    const category = metar ? deriveCategory(visibilitySm, ceilingFt) : null;

    return {
      icao: up,
      raw: metar,
      category,
      visibilitySm,
      ceilingFt,
      fetchedAtIso,
      source: 'noaa-tgftp',
    };
  } catch {
    return { icao: up, raw: null, category: null, visibilitySm: null, ceilingFt: null, fetchedAtIso, source: 'noaa-tgftp' };
  }
}
