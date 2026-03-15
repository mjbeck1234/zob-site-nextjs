import { NextResponse } from 'next/server';
import { withLiveCache } from '@/lib/idsStaticData';

export const dynamic = 'force-dynamic';

type AtisEntry = {
  airport: string;
  type: 'arr' | 'dep' | 'combined';
  code: string;
  datis: string;
  time: string;
  updatedAt: string;
};

type ParsedAtis = {
  airport: string;
  flow: string | null;
  approachType: string | null;
  metar: string | null;
  fullText: string[];
};

const ICAOS = ['KDTW', 'KPIT', 'KBUF', 'KCLE'];

const FLOW_MAP: Record<string, Record<string, string[]>> = {
  KDTW: { north: ['3L', '3R', '4L', '4R'], south: ['21L', '21R', '22L', '22R'], west: ['27R', '27L'] },
  KCLE: { north: ['6L', '6R'], south: ['24L', '24R'] },
  KPIT: { east: ['10L', '10C', '10R', '14'], west: ['28L', '28C', '28R', '32'] },
  KBUF: { east: ['5'], west: ['23'] },
};

function truncateAtNotam(text: string): string {
  const upper = text.toUpperCase();
  const idxNotice = upper.indexOf('NOTICE TO AIRMEN');
  const idxNotams = upper.indexOf('NOTAMS');
  let idx = -1;
  if (idxNotice !== -1 && idxNotams !== -1) idx = Math.min(idxNotice, idxNotams);
  else if (idxNotice !== -1) idx = idxNotice;
  else if (idxNotams !== -1) idx = idxNotams;
  if (idx === -1) return text;
  return text.slice(0, idx);
}

function extractRunways(text: string): string[] {
  const truncated = truncateAtNotam(text);
  const matches = [
    ...truncated.matchAll(
      /(?:RWY|ILS|SIMUL ILS Z|SIMUL VISUAL|RUNWAY|DEPG RWY|DEPG RWYS|DEPARTING RUNWAY|ARRIVING RUNWAY|RY)\s?(\d{1,2}[LRC]?)/gi
    ),
  ];

  const runwaysFromMatches: string[] = [];
  for (const m of matches) {
    const idx = m.index ?? 0;
    const after = truncated.slice(idx + m[0].length, idx + m[0].length + 20).toUpperCase();
    if (after.includes('CLSD') || after.includes('CLOSED')) continue;
    runwaysFromMatches.push(String(m[1]).toUpperCase());
  }

  const extraMatches = [...truncated.matchAll(/DEPG RWYS?\s*([\d, ]+)/gi)];
  const runwaysFromExtra: string[] = [];
  for (const m of extraMatches) {
    if (!m[1]) continue;
    const rws = String(m[1])
      .split(',')
      .map((r) => r.trim().toUpperCase())
      .filter(Boolean);
    for (const r of rws) {
      const idxR = truncated.indexOf(r);
      const after = truncated.slice(idxR + r.length, idxR + r.length + 20).toUpperCase();
      if (after.includes('CLSD') || after.includes('CLOSED')) continue;
      runwaysFromExtra.push(r);
    }
  }

  return [...new Set([...runwaysFromMatches, ...runwaysFromExtra])];
}

function detectFlow(airport: string, runways: string[]): string | null {
  const flow = FLOW_MAP[airport];
  if (!flow) return null;

  const counts: Record<string, number> = {};
  for (const [dir, rwys] of Object.entries(flow)) {
    counts[dir] = runways.filter((r) => rwys.includes(r)).length;
  }

  const best = Object.entries(counts).reduce((a, b) => (b[1] > a[1] ? b : a), ['none', 0] as any);
  if (best[1] === 0) return null;
  return `${String(best[0]).toUpperCase()} FLOW`;
}

function detectApproachType(text: string): string | null {
  const truncated = truncateAtNotam(text).toUpperCase();
  if (truncated.includes('ILS')) return 'ILS';
  if (truncated.includes('RNAV') || truncated.includes('GPS')) return 'RNAV';
  if (truncated.includes('VISUAL')) return 'VISUAL';
  if (truncated.includes('LOC')) return 'LOC';
  if (truncated.includes('LDA')) return 'LDA';
  if (truncated.includes('VOR')) return 'VOR';
  return null;
}

function extractMetar(text: string): string | null {
  const truncated = truncateAtNotam(text);
  const segments = truncated.split('.');
  if (segments.length < 2) return null;
  return segments[1].trim();
}

function parseAtis(entries: AtisEntry[]): ParsedAtis {
  const airport = entries[0].airport;
  const fullText = entries.map((e) => e.datis);
  const joined = fullText.join(' ');

  const runways = extractRunways(joined);
  const flow = detectFlow(airport, runways);
  const approachType = detectApproachType(joined);
  const metar = extractMetar(joined);

  return { airport, flow, approachType, metar, fullText };
}

async function fetchAtis(): Promise<ParsedAtis[]> {
  const results = await Promise.all(
    ICAOS.map(async (icao) => {
      try {
        const res = await fetch(`https://datis.clowd.io/api/${icao}`, { cache: 'no-store' });
        if (!res.ok) return null;
        const data: AtisEntry[] = await res.json();
        if (!data?.length) return null;
        return parseAtis(data);
      } catch {
        return null;
      }
    })
  );
  return results.filter((r): r is ParsedAtis => !!r);
}

export async function GET() {
  const data = await withLiveCache('ids.airportinfo', 60, async () => {
    return await fetchAtis();
  });

  return NextResponse.json({ source: 'cache-or-live', data });
}
