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

type Controller = {
  callsign: string;
  name?: string;
  frequency?: string | number;
  artccId?: string;
};

// Some Canadian enroute positions use local prefixes (e.g. TOR_CTR) rather than the ARTCC id.
// Map those to ARTCC ids that exist in boundaries.geojson.
const CALLSIGN_TO_ARTCC: Record<string, string> = {
  TOR: 'CZYZ',
  WPG: 'CZWG',
  MTL: 'CZUL',
  CZVR: 'CZVR',
  CZEG: 'CZEG',
  CZQM: 'CZQM',
  CZQX: 'CZQM',

  // Some US centers are occasionally logged with local city/region prefixes.
  // Normalize those to ARTCC ids that exist in boundaries.geojson.
  CHI: 'ZAU', // Chicago Center
  BOS: 'ZBW', // Boston Center
  NYC: 'ZNY', // New York Center
  NY: 'ZNY',
  WDC: 'ZDC', // Washington Center
  WAS: 'ZDC',
  IND: 'ZID', // Indianapolis Center
  MSP: 'ZMP', // Minneapolis Center
};

const ENROUTE_CALLSIGN_RE = /_(?:\d{1,3}_)?(?:CTR|FSS)$/i;

export async function GET() {
  const data = await withLiveCache('ids.controllers', 60, async () => {
    // vNAS controller list
    const vnas = await jsonOrNull('https://vnas.vatsim.net/api/v2/controller');

    // VATSIM v3 data
    let vatsimUrl: string | null = null;
    const status = await jsonOrNull('https://status.vatsim.net/status.json');
    if (status?.data?.v3 && Array.isArray(status.data.v3) && status.data.v3.length) {
      vatsimUrl = status.data.v3[0];
    }
    const vatsim = vatsimUrl ? await jsonOrNull(vatsimUrl) : null;

    const enroute: Controller[] = [];

    // Pull ARTCCs from vNAS
    if (vnas?.artccs && Array.isArray(vnas.artccs)) {
      for (const artcc of vnas.artccs) {
        if (!artcc?.id) continue;
        const artccId = String(artcc.id);
        const controllers = Array.isArray(artcc.controllers) ? artcc.controllers : [];
        for (const c of controllers) {
          if (!c?.callsign) continue;
          enroute.push({
            callsign: String(c.callsign),
            name: c.name ? String(c.name) : undefined,
            frequency: c.frequency,
            artccId,
          });
        }
      }
    }

    // Pull enroute controllers from VATSIM (facility 5 = center)
    if (vatsim?.controllers && Array.isArray(vatsim.controllers)) {
      for (const c of vatsim.controllers) {
        if (!c?.callsign) continue;
        const callsign = String(c.callsign).toUpperCase();
        // Be permissive: some feeds/clients can mis-report facility, but callsigns still end in _CTR/_FSS.
        if (c.facility !== 5 && !ENROUTE_CALLSIGN_RE.test(callsign)) continue;

        // Derive ARTCC id by callsign prefix.
        let artccId = callsign.split('_')[0];
        // Canadian special cases (TOR_CTR, etc.)
        if (CALLSIGN_TO_ARTCC[artccId]) artccId = CALLSIGN_TO_ARTCC[artccId];
        enroute.push({
          callsign: String(c.callsign),
          name: c.name ? String(c.name) : undefined,
          frequency: c.frequency,
          artccId,
        });
      }
    }

    // de-dupe by callsign
    const seen = new Set<string>();
    const uniq = enroute.filter((c) => {
      if (seen.has(c.callsign)) return false;
      seen.add(c.callsign);
      return true;
    });

    return { enroute: uniq };
  });

  return NextResponse.json(data);
}
