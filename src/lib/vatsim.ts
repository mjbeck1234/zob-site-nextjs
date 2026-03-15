import { z } from 'zod';
import { ZOB_FACILITIES } from '@/config/zobFacilities';
import { selectAll } from '@/lib/query';

const StatusSchema = z.object({
  data: z.object({
    v3: z.array(z.string()).optional(),
    v3_json: z.array(z.string()).optional(),
  }),
});

const DataSchema = z.object({
  controllers: z.array(
    z.object({
      cid: z.number(),
      name: z.string(),
      callsign: z.string(),
      frequency: z.string(),
      facility: z.number().optional(),
      logon_time: z.string().optional(),
    })
  ).optional(),
});

// Minimal pilot schema for traffic counts.
// VATSIM v3 provides pilots[].flight_plan.{departure,arrival}.
const PilotSchema = z
  .object({
    cid: z.number().optional(),
    callsign: z.string().optional(),
    flight_plan: z
      .object({
        departure: z.string().nullable().optional(),
        arrival: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

const DataWithPilotsSchema = DataSchema.extend({
  pilots: z.array(PilotSchema).optional(),
});

export type OnlineController = {
  cid: number;
  name: string;
  callsign: string;
  frequency: string;
  logonTime?: string;
};

export type AirportTrafficCounts = {
  airport: string;
  departures: number;
  arrivals: number;
};

let cached: { expiresAt: number; controllers: OnlineController[] } | null = null;
let trafficCached: { expiresAt: number; counts: AirportTrafficCounts[] } | null = null;
let v3JsonCached: { expiresAt: number; json: unknown } | null = null;
let v3JsonInFlight: Promise<unknown | null> | null = null;
const TTL_MS = Number(process.env.VATSIM_CACHE_TTL_MS ?? `${30 * 1000}`);

async function fetchVatsimV3Json(): Promise<unknown | null> {
  const now = Date.now();
  if (v3JsonCached && v3JsonCached.expiresAt > now) return v3JsonCached.json;

  // Prevent duplicate upstream requests when multiple server components request data concurrently.
  if (v3JsonInFlight) return await v3JsonInFlight;

  v3JsonInFlight = (async () => {
    const statusRes = await fetch('https://status.vatsim.net/status.json', { cache: 'no-store' });
    if (!statusRes.ok) return null;
    const status = StatusSchema.safeParse(await statusRes.json());
    if (!status.success) return null;

    const urls = status.data.data.v3 ?? status.data.data.v3_json ?? [];
    const dataUrl = urls[0];
    if (!dataUrl) return null;

    const dataRes = await fetch(dataUrl, { cache: 'no-store' });
    if (!dataRes.ok) return null;
    const json = await dataRes.json();
    v3JsonCached = { expiresAt: Date.now() + TTL_MS, json };
    return json;
  })();

  try {
    return await v3JsonInFlight;
  } finally {
    v3JsonInFlight = null;
  }
}

export async function getZobControllersOnline(): Promise<OnlineController[]> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.controllers;

  const raw = await fetchVatsimV3Json();
  if (!raw) return [];

  const data = DataSchema.safeParse(raw);
  if (!data.success || !data.data.controllers) return [];

  // Facilities configuration (defaults to src/config/zobFacilities.ts).
  // Optional override via env var: ZOB_FACILITIES="CLE_,DTW_,..." (comma-separated).
  const facilities = (process.env.ZOB_FACILITIES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const facilitySet = new Set((facilities.length ? facilities : ZOB_FACILITIES).map((s) => String(s).toUpperCase()));

  // Mimic the previous PHP logic:
  // - callsign must include "_"
  // - exclude OBS/SUP/ADM
  // - compare first 4 chars of callsign against configured facility prefixes
  const filtered = data.data.controllers.filter((c) => {
    const cs = String(c.callsign ?? '').toUpperCase();
    if (!cs.includes('_')) return false;
    if (cs.includes('_OBS') || cs.includes('_SUP') || cs.includes('_ADM')) return false;
    const prefix4 = cs.slice(0, 4);
    return facilitySet.has(prefix4);
  });

  // Prefer roster display names when available; fall back to VATSIM-provided name.
  // This is best-effort: if the DB is unavailable, we still return controllers.
  let rosterNameByCid: Record<string, string> = {};
  try {
    const cids = Array.from(new Set(filtered.map((c) => c.cid))).filter((cid) => Number.isFinite(cid));
    if (cids.length) {
      const placeholders = cids.map(() => '?').join(',');
      const rows = await selectAll('roster', {
        whereSql: `cid IN (${placeholders})`,
        params: cids,
        limit: cids.length,
      });
      for (const r of rows ?? []) {
        const cid = r?.cid;
        if (cid === null || cid === undefined) continue;
        const cidStr = String(cid).trim();
        const pref = String(r?.pref_name ?? '').trim();
        const first = String(r?.first_name ?? '').trim();
        const last = String(r?.last_name ?? '').trim();
        const name = pref || [first, last].filter(Boolean).join(' ').trim();
        if (cidStr && name) rosterNameByCid[cidStr] = name;
      }
    }
  } catch {
    rosterNameByCid = {};
  }

  const controllers = filtered
    .map((c) => ({
      cid: c.cid,
      name: rosterNameByCid[String(c.cid).trim()] ?? c.name,
      callsign: c.callsign,
      frequency: c.frequency,
      logonTime: c.logon_time,
    }))
    .sort((a, b) => a.callsign.localeCompare(b.callsign));

  cached = { expiresAt: now + TTL_MS, controllers };
  return controllers;
}

function normAirport(s: unknown): string | null {
  if (!s) return null;
  const v = String(s).trim().toUpperCase();
  if (!v) return null;
  // Some plans may include 3-letter (e.g., CLE) but we want ICAO (KCLE).
  if (v.length === 3) return `K${v}`;
  return v;
}

/**
 * Network-wide arrivals/departures counts for selected airports.
 * Uses the VATSIM v3 feed pilots[].flight_plan.{departure,arrival}.
 */
export async function getMajorAirportTrafficCounts(
  airports: string[] = ['KBUF', 'KCLE', 'KPIT', 'KDTW']
): Promise<AirportTrafficCounts[]> {
  const now = Date.now();
  if (trafficCached && trafficCached.expiresAt > now) return trafficCached.counts;

  const raw = await fetchVatsimV3Json();
  if (!raw) return airports.map((a) => ({ airport: a, departures: 0, arrivals: 0 }));

  const parsed = DataWithPilotsSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.pilots) {
    return airports.map((a) => ({ airport: a, departures: 0, arrivals: 0 }));
  }

  const want = new Set(airports.map((a) => a.trim().toUpperCase()).filter(Boolean));
  const countsMap = new Map<string, { dep: number; arr: number }>();
  for (const a of want) countsMap.set(a, { dep: 0, arr: 0 });

  for (const p of parsed.data.pilots) {
    const fp = p.flight_plan;
    if (!fp) continue;
    const dep = normAirport(fp.departure);
    const arr = normAirport(fp.arrival);
    if (dep && want.has(dep)) countsMap.get(dep)!.dep += 1;
    if (arr && want.has(arr)) countsMap.get(arr)!.arr += 1;
  }

  const counts = Array.from(want).map((airport) => {
    const v = countsMap.get(airport) ?? { dep: 0, arr: 0 };
    return { airport, departures: v.dep, arrivals: v.arr };
  });

  trafficCached = { expiresAt: now + TTL_MS, counts };
  return counts;
}
