import 'server-only';
import { RAMP_AIRPORTS, type RampAirportConfig } from '@/lib/ids/rampAirports';

import { withLiveCache } from '@/lib/idsStaticData';
import { sql } from '@/lib/db';

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};

export type RampArea = {
  id: string;
  label: string;
  bbox: { south: number; west: number; north: number; east: number };
  standCount: number;
};

export type RampStand = {
  id: string;
  lat: number;
  lon: number;
  kind: 'parking_position' | 'gate';
  ref?: string; // normalized (uppercase)
  name?: string;
  terminal?: string;
  airline?: string;
  /** Area grouping used by the Ramp UI (McNamara / Evans / Cargo / etc). */
  areaId?: string;
  /** True if this stand is occupied via a manual (controller) assignment override. */
  manual?: boolean;
  /** True if this stand is held/reserved (controller hold). */
  held?: boolean;
  holdNote?: string;
  /** Epoch ms when the hold expires (if held). */
  holdExpiresAt?: number;
  /** CID of the user who created the hold (if known). */
  holdCreatedByCid?: number;
  /** Mode of the user who created the hold (pilot|controller|ids|admin|staff). */
  holdCreatedByMode?: string;
  occupied?: boolean;
  aircraft?: {
    callsign: string;
    aircraftType?: string;
    groundspeed?: number;
  };
};

export type RampOccupancyResponse = {
  ok: boolean;
  icao: string;
  center: { lat: number; lon: number };
  bbox: { south: number; west: number; north: number; east: number };
  areas?: RampArea[];
  stands: RampStand[];
  occupiedList: { standId: string; ref?: string; callsign: string; groundspeed?: number; aircraftType?: string }[];
  unassigned: { callsign: string; latitude: number; longitude: number; aircraftType?: string; groundspeed?: number }[];
  summary: {
    totalStands: number;
    occupied: number;
    open: number; // open & not held
    held: number;
    // Note: these are "on-ground" aircraft that weren't snapped to a stand.
    unassignedParked: number;
    updatedAtIso: string;
  };
};

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

function normRef(v?: string) {
  const s = (v ?? '').toString().trim().toUpperCase();
  if (!s) return '';
  // Common OSM patterns: "Gate A12", "A12", "DTW A12" etc.
  return s
    .replace(/^GATE\s+/i, '')
    .replace(/^STAND\s+/i, '')
    .replace(/^DTW\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function fetchJson(url: string, body: string, timeoutMs: number): Promise<any | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body,
      signal: ac.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function configFor(icao: string): RampAirportConfig {
  const up = String(icao || '').trim().toUpperCase();
  const cfg = RAMP_AIRPORTS[up];
  if (!cfg) {
    // fallback to DTW parameters if unknown; caller should validate at API boundary.
    return RAMP_AIRPORTS.KDTW;
  }
  return cfg;
}

function standScore(s: RampStand): number {
  // Prefer higher-quality stand points when OSM contains both "gate" and "parking_position" at the same location.
  // We strongly prefer something with a usable ref.
  const hasRef = !!normRef(s.ref ?? s.name);
  const hasTerminal = !!s.terminal;
  const hasName = !!s.name;
  const kindScore = s.kind === 'parking_position' ? 20 : 10;
  const idPrefix = (s.id || '').split(':')[0];
  // Manual overrides should win deduping when they share a ref with an OSM element.
  const typeScore = idPrefix === 'manual' ? 6 : idPrefix === 'node' ? 5 : 1;
  return (hasRef ? 100 : 0) + kindScore + typeScore + (hasTerminal ? 2 : 0) + (hasName ? 1 : 0);
}

function dedupeStands(stands: RampStand[]): RampStand[] {
  const byRef = new Map<string, RampStand>();
  const byLatLon = new Map<string, RampStand>();

  for (const s of stands) {
    const refKey = normRef(s.ref ?? s.name);

    if (refKey) {
      const prev = byRef.get(refKey);
      if (!prev || standScore(s) > standScore(prev)) {
        byRef.set(refKey, s);
      }
      continue;
    }

    // No ref; fall back to coordinates. Round to ~1m so we collapse node vs way-center duplicates.
    // IMPORTANT: do NOT include kind in the key; airports frequently have both "gate" and "parking_position"
    // at the same coordinate.
    const key = `${s.lat.toFixed(5)}:${s.lon.toFixed(5)}`;
    const prev = byLatLon.get(key);
    if (!prev || standScore(s) > standScore(prev)) {
      byLatLon.set(key, s);
    }
  }

  return [...byRef.values(), ...byLatLon.values()];
}

const AREA_LABELS: Record<string, string> = {
  mcn_a: 'McNamara – Concourse A',
  mcn_bc: 'McNamara – Concourse B/C',
  evans_d: 'Evans – Concourse D',
  cargo_fdx: 'Cargo – FedEx',
  cargo_other: 'Cargo – Other',
  other: 'Other',
};

function classifyStandArea(icao: string, s: RampStand): string {
  const up = String(icao).toUpperCase();
  const ref = normRef(s.ref ?? s.name);
  const blob = `${(s.airline ?? '')} ${(s.name ?? '')} ${ref}`.toLowerCase();

  if (up === 'KDTW') {
    // Cargo first
    if (/(fedex|fdx)/i.test(blob)) return 'cargo_fdx';
    if (/(ups|cargo|freight)/i.test(blob)) return 'cargo_other';

    // Concourse inference by stand/gate ref
    if (/^A\s*\d+/i.test(ref)) return 'mcn_a';
    if (/^[BC]\s*\d+/i.test(ref)) return 'mcn_bc';
    if (/^D\s*\d+/i.test(ref)) return 'evans_d';

    return 'other';
  }

  return 'other';
}

type RampStandOverrideRow = {
  id: number;
  icao: string;
  type: 'add' | 'hide';
  stand_id: string;
  stand_ref: string | null;
  lat: number | null;
  lon: number | null;
  name: string | null;
  airline: string | null;
  area_id: string | null;
  active: number;
  created_at_ms: number;
  updated_at_ms: number;
};

async function fetchRampStandOverrides(icao: string): Promise<{ adds: RampStand[]; hiddenStandIds: Set<string> }> {
  const up = String(icao || '').trim().toUpperCase();

  // Keep overrides optional; on deployments without the table, just return empty.
  try {
    const rows = await sql<RampStandOverrideRow[]>`
      SELECT id, icao, type, stand_id, stand_ref, lat, lon, name, airline, area_id, active, created_at_ms, updated_at_ms
      FROM ids_ramp_stand_overrides
      WHERE icao = ${up} AND active = 1
      ORDER BY id DESC
    `;

    const hiddenStandIds = new Set<string>();
    const adds: RampStand[] = [];

    for (const r of rows ?? []) {
      if (String(r.type) === 'hide') {
        if (r.stand_id) hiddenStandIds.add(String(r.stand_id));
        continue;
      }

      const lat = Number(r.lat);
      const lon = Number(r.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const ref = normRef(r.stand_ref ?? r.name ?? '') || undefined;
      const name = (r.name ?? '').toString().trim() || undefined;
      const airline = (r.airline ?? '').toString().trim() || undefined;
      const areaId = (r.area_id ?? '').toString().trim() || undefined;

      adds.push({
        id: String(r.stand_id || `manual:${r.id}`),
        lat,
        lon,
        kind: 'parking_position',
        ref,
        name,
        airline,
        areaId,
      });
    }

    return { adds, hiddenStandIds };
  } catch {
    return { adds: [], hiddenStandIds: new Set() };
  }
}

function bboxFromPoints(points: { lat: number; lon: number }[]): { south: number; west: number; north: number; east: number } {
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity;
  for (const p of points) {
    south = Math.min(south, p.lat);
    west = Math.min(west, p.lon);
    north = Math.max(north, p.lat);
    east = Math.max(east, p.lon);
  }
  if (!Number.isFinite(south) || !Number.isFinite(west) || !Number.isFinite(north) || !Number.isFinite(east)) {
    return { south: 0, west: 0, north: 0, east: 0 };
  }
  return { south, west, north, east };
}

function padBbox(b: { south: number; west: number; north: number; east: number }, padDeg: number) {
  return {
    south: b.south - padDeg,
    west: b.west - padDeg,
    north: b.north + padDeg,
    east: b.east + padDeg,
  };
}

function computeAreasFromStands(stands: RampStand[]): RampArea[] {
  const groups = new Map<string, RampStand[]>();
  for (const s of stands) {
    const id = s.areaId || 'other';
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(s);
  }

  const areas: RampArea[] = [];
  for (const [id, list] of groups.entries()) {
    const pts = list.map((x) => ({ lat: x.lat, lon: x.lon }));
    const bbox = padBbox(bboxFromPoints(pts), 0.0015); // small pad ~150m-ish
    areas.push({
      id,
      label: AREA_LABELS[id] ?? id.toUpperCase(),
      bbox,
      standCount: list.length,
    });
  }

  // Stable order
  const order = ['mcn_a', 'mcn_bc', 'evans_d', 'cargo_fdx', 'cargo_other', 'other'];
  areas.sort((a, b) => {
    const ai = order.indexOf(a.id);
    const bi = order.indexOf(b.id);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.label.localeCompare(b.label);
  });

  return areas;
}

export async function getRampStands(
  icao: string
): Promise<{
  stands: RampStand[];
  center: { lat: number; lon: number };
  bbox: RampAirportConfig['bbox'];
  areas: RampArea[];
}> {
  const cfg = configFor(icao);

  // OSM stands rarely change; cache the OSM fetch for 24h, but apply manual overrides on every request
  // so admin edits take effect immediately.
  const base = await withLiveCache(`ramp.stands.osm.v1.${cfg.icao}`, 24 * 60 * 60, async () => {
    const { south, west, north, east } = cfg.bbox;

    // Prefer querying within the airport "aerodrome" area when possible.
    const areaQuery = cfg.iata
      ? `
[out:json][timeout:25];
area["aeroway"="aerodrome"]["iata"="${cfg.iata}"]->.a;
(
  node(area.a)["aeroway"="parking_position"];
  way(area.a)["aeroway"="parking_position"];
  node(area.a)["aeroway"="gate"];
  way(area.a)["aeroway"="gate"];
);
out center;
`.trim()
      : null;

    const bboxQuery = `
[out:json][timeout:25];
(
  node["aeroway"="parking_position"](${south},${west},${north},${east});
  way["aeroway"="parking_position"](${south},${west},${north},${east});
  node["aeroway"="gate"](${south},${west},${north},${east});
  way["aeroway"="gate"](${south},${west},${north},${east});
);
out center;
`.trim();

    // NOTE: Do NOT rely solely on the aerodrome "area" query.
    // Many airports have incomplete/partial aerodrome boundaries in OSM (cargo ramps can fall outside),
    // which would cause stands to disappear. We always merge an airport-area query (when available)
    // with a generous bbox query, then dedupe.
    const byId = new Map<string, OverpassElement>();

    const run = async (q: string) => {
      const payload = `data=${encodeURIComponent(q)}`;
      let json: any | null = null;
      for (const endpoint of OVERPASS_ENDPOINTS) {
        json = await fetchJson(endpoint, payload, 12_000);
        if (json) break;
      }
      const els: OverpassElement[] = Array.isArray(json?.elements) ? json.elements : [];
      for (const el of els) {
        const key = `${el.type}:${el.id}`;
        if (!byId.has(key)) byId.set(key, el);
      }
    };

    if (areaQuery) await run(areaQuery);
    await run(bboxQuery);

    const elements: OverpassElement[] = [...byId.values()];

    const stands: RampStand[] = [];
    for (const el of elements) {
      const tags = el.tags ?? {};
      const aeroway = String(tags.aeroway ?? '').toLowerCase();
      const kind: RampStand['kind'] = aeroway === 'gate' ? 'gate' : 'parking_position';

      const lat = Number(el.lat ?? el.center?.lat);
      const lon = Number(el.lon ?? el.center?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const rawRef = (tags.ref || tags['ref:airport'] || tags.gate || '').toString().trim();
      const rawName = (tags.name || '').toString().trim();
      const terminal = (tags.terminal || tags['addr:terminal'] || '').toString().trim() || undefined;
      const airline = (
        tags.airline ||
        tags.operator ||
        tags['operator:short'] ||
        tags['operator:name'] ||
        tags['operator:en'] ||
        tags.brand ||
        ''
      )
        .toString()
        .trim() || undefined;

      // Normalize what we display as the "gate label" so it's always uppercase and consistent.
      const ref = normRef(rawRef || rawName) || undefined;
      const name = rawName || undefined;

      // Unlabelled gate points are usually duplicate noise alongside parking_position stands.
      if (kind === 'gate' && !ref && !name) continue;

      stands.push({
        id: `${el.type}:${el.id}`,
        lat,
        lon,
        kind,
        ref,
        name,
        terminal,
        airline,
      });
    }

    const deduped: RampStand[] = dedupeStands(stands);

    // Assign areaId (cached) so the client can filter without recomputing.
    for (const s of deduped) {
      s.areaId = classifyStandArea(cfg.icao, s);
    }

    // Stable sort so markers don't flicker.
    deduped.sort((a, b) => normRef(a.ref || a.name).localeCompare(normRef(b.ref || b.name)) || a.id.localeCompare(b.id));

    const areas = computeAreasFromStands(deduped);

    // Use configured center to keep the view stable.
    const center = cfg.center;

    return { stands: deduped, center, bbox: cfg.bbox, areas };
  });

  const { adds, hiddenStandIds } = await fetchRampStandOverrides(cfg.icao);

  // 1) Remove hidden stands
  let stands = base.stands.filter((s) => !hiddenStandIds.has(String(s.id)));

  // 2) Add manual stands
  if (adds.length) {
    for (const s of adds) {
      // Ensure added stands have an areaId (explicit override wins, otherwise infer).
      if (!s.areaId) s.areaId = classifyStandArea(cfg.icao, s);
    }
    stands = dedupeStands([...stands, ...adds]);
  }

  // 3) Ensure all stands are area-classified.
  for (const s of stands) {
    if (!s.areaId) s.areaId = classifyStandArea(cfg.icao, s);
  }

  // Stable sort so markers don't flicker.
  stands.sort((a, b) => normRef(a.ref || a.name).localeCompare(normRef(b.ref || b.name)) || a.id.localeCompare(b.id));

  const areas = computeAreasFromStands(stands);

  return { stands, center: base.center, bbox: base.bbox, areas };
}

const jsonOrNull = async (url: string) => {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

async function fetchVatsimData(): Promise<any | null> {
  return await withLiveCache('ramp.vatsimData', 15, async () => {
    let vatsimUrl: string | null = null;
    const status = await jsonOrNull('https://status.vatsim.net/status.json');
    if (status?.data?.v3 && Array.isArray(status.data.v3) && status.data.v3.length) {
      vatsimUrl = status.data.v3[0];
    }
    return vatsimUrl ? await jsonOrNull(vatsimUrl) : null;
  });
}

async function fetchVatsimPilots(): Promise<any[]> {
  const vatsim = await fetchVatsimData();
  return Array.isArray(vatsim?.pilots) ? vatsim.pilots : [];
}

async function fetchVatsimPrefiles(): Promise<any[]> {
  const vatsim = await fetchVatsimData();
  return Array.isArray(vatsim?.prefiles) ? vatsim.prefiles : [];
}

/**
 * Find the user's currently-connected *pilot* callsign on the VATSIM network.
 * Returns null if the user is not connected as a pilot.
 */
export async function getVatsimPilotCallsignByCid(cid: number): Promise<string | null> {
  const c = Number(cid);
  if (!Number.isFinite(c) || c <= 0) return null;

  const pilots = await fetchVatsimPilots();
  const p = pilots.find((x) => Number(x?.cid) === c);
  const cs = String(p?.callsign ?? '').trim().toUpperCase();
  return cs || null;
}

export type VatsimPilotIdentity = {
  cid: number;
  callsign: string;
  source: 'pilot' | 'prefile';
  connected: boolean;
  flightPlan?: { departure?: string | null; arrival?: string | null } | null;
  lastUpdated?: string | null;
};

function upIcao(v: unknown): string {
  return String(v ?? '').trim().toUpperCase();
}

/**
 * Returns ARR if the flight plan arrival matches the airport.
 * Returns DEP if the departure matches (and arrival does not).
 * If both match, ARR wins.
 */
export function deriveRampRoleForAirport(
  airportIcao: string,
  fp?: { departure?: string | null; arrival?: string | null } | null
): 'ARR' | 'DEP' | null {
  const apt = upIcao(airportIcao);
  if (!apt) return null;
  const dep = upIcao(fp?.departure);
  const arr = upIcao(fp?.arrival);
  if (arr && arr === apt) return 'ARR';
  if (dep && dep === apt) return 'DEP';
  return null;
}

/**
 * Find the user's callsign from the VATSIM feed by CID.
 * Prefer a connected pilot match; otherwise fall back to a prefile.
 */
export async function getVatsimPilotIdentityByCid(cid: number): Promise<VatsimPilotIdentity | null> {
  const c = Number(cid);
  if (!Number.isFinite(c) || c <= 0) return null;

  const pilots = await fetchVatsimPilots();
  const p = pilots.find((x) => Number(x?.cid) === c);
  if (p) {
    const cs = upIcao(p?.callsign);
    if (!cs) return null;
    const fp = p?.flight_plan ?? null;
    return {
      cid: c,
      callsign: cs,
      source: 'pilot',
      connected: true,
      flightPlan: {
        departure: fp?.departure ?? null,
        arrival: fp?.arrival ?? null,
      },
      lastUpdated: String(p?.last_updated ?? '') || null,
    };
  }

  const prefiles = await fetchVatsimPrefiles();
  const matches = prefiles.filter((x) => Number(x?.cid) === c);
  if (!matches.length) return null;
  // If there are multiple prefiles, prefer the newest.
  matches.sort((a, b) => String(b?.last_updated ?? '').localeCompare(String(a?.last_updated ?? '')));
  const pr = matches[0];
  const cs = upIcao(pr?.callsign);
  if (!cs) return null;
  const fp = pr?.flight_plan ?? null;
  return {
    cid: c,
    callsign: cs,
    source: 'prefile',
    connected: false,
    flightPlan: {
      departure: fp?.departure ?? null,
      arrival: fp?.arrival ?? null,
    },
    lastUpdated: String(pr?.last_updated ?? '') || null,
  };
}

export type PilotRampReservation = {
  icao: string;
  standId: string;
  standRef?: string | null;
  note?: string;
  createdAtMs?: number;
  expiresAtMs: number;
};

/**
 * Fetch the active pilot reservation (hold) for a CID at an airport.
 * Uses DB-backed holds when enabled; falls back to in-memory holds in dev.
 */
export async function getPilotRampReservation(icao: string, cid: number): Promise<PilotRampReservation | null> {
  const up = String(icao || '').trim().toUpperCase();
  const cidNum = Number(cid);
  if (!up || !Number.isFinite(cidNum) || cidNum <= 0) return null;

  const nowMs = Date.now();

  if (rampHoldDbEnabled()) {
    try {
      // Keep reads small.
      await sql`DELETE FROM ids_ramp_holds WHERE icao = ${up} AND expires_at_ms <= ${nowMs}`;
      const rows: any = await sql`
        SELECT stand_id AS standId, stand_ref AS standRef, note, created_at_ms AS createdAtMs, expires_at_ms AS expiresAtMs
        FROM ids_ramp_holds
        WHERE icao = ${up}
          AND created_by_mode = 'pilot'
          AND created_by_cid = ${cidNum}
          AND expires_at_ms > ${nowMs}
        ORDER BY expires_at_ms DESC
        LIMIT 1
      `;
      const r = (rows as any)?.[0];
      if (!r) return null;
      const standId = String((r as any).standId ?? '').trim();
      const standRefRaw = (r as any).standRef ?? (r as any).stand_ref ?? null;
      const standRef = standRefRaw ? String(standRefRaw).trim().toUpperCase() : null;
      const ex = Number((r as any).expiresAtMs ?? (r as any).expires_at_ms ?? 0);
      const ca = Number((r as any).createdAtMs ?? (r as any).created_at_ms ?? 0);
      if (!standId || !Number.isFinite(ex) || ex <= nowMs) return null;
      const note = (r as any).note ? String((r as any).note) : undefined;
      return {
        icao: up,
        standId,
        ...(standRef ? { standRef } : {}),
        note,
        createdAtMs: Number.isFinite(ca) && ca > 0 ? ca : undefined,
        expiresAtMs: ex,
      };
    } catch {
      // If DB read fails, fall back to memory below.
    }
  }

  // In-memory fallback (local dev / DB disabled).
  let best: any = null;
  for (const v of rampHolds.values()) {
    if (!v) continue;
    if (v.icao !== up) continue;
    if ((v.createdByMode || '').toString().toLowerCase() !== 'pilot') continue;
    if (Number(v.createdByCid ?? 0) !== cidNum) continue;
    if (Number(v.expiresAt ?? 0) <= nowMs) continue;
    if (!best || Number(v.expiresAt ?? 0) > Number(best.expiresAt ?? 0)) best = v;
  }
  if (!best) return null;
  return {
    icao: up,
    standId: String(best.standId ?? '').trim(),
    ...(best.standRef ? { standRef: String(best.standRef).trim().toUpperCase() } : {}),
    note: best.note ? String(best.note) : undefined,
    createdAtMs: Number(best.createdAt ?? 0) > 0 ? Number(best.createdAt) : undefined,
    expiresAtMs: Number(best.expiresAt ?? 0),
  };
}

type ParkState = { since: number; lastSeen: number };
type HoldState = {
  icao: string;
  standId: string;
  standRef?: string;
  note?: string;
  createdAt: number;
  expiresAt: number;
  createdByCid?: number;
  createdByMode?: string;
};
type RampClaim = { icao: string; standId: string; callsign: string; createdAt: number; expiresAt: number; offline?: boolean };
type CoordEntry = { icao: string; callsign: string; status: string; note?: string; updatedAt: number; expiresAt: number };

const g = globalThis as any;
if (!g.__rampParkState) g.__rampParkState = new Map<string, ParkState>();
if (!g.__rampClaims) g.__rampClaims = new Map<string, RampClaim>();
if (!g.__rampClaimRev) g.__rampClaimRev = new Map<string, number>();
if (!g.__rampHolds) g.__rampHolds = new Map<string, HoldState>();
if (!g.__rampHoldRev) g.__rampHoldRev = new Map<string, number>();
if (!g.__rampCoord) g.__rampCoord = new Map<string, CoordEntry>();

const parkState: Map<string, ParkState> = g.__rampParkState;
const rampClaims: Map<string, RampClaim> = g.__rampClaims;
const rampClaimRev: Map<string, number> = g.__rampClaimRev;

const rampHolds: Map<string, HoldState> = g.__rampHolds;
const rampHoldRev: Map<string, number> = g.__rampHoldRev;

const rampCoord: Map<string, CoordEntry> = g.__rampCoord;

function claimKey(icao: string, standId: string) {
  return `${icao}:${standId}`;
}
function holdKey(icao: string, standId: string) {
  return `${icao}:${standId}`;
}
function coordKey(icao: string, callsign: string) {
  return `${icao}:${callsign}`;
}

function bumpRev(icao: string) {
  const k = String(icao).toUpperCase();
  rampClaimRev.set(k, (rampClaimRev.get(k) ?? 0) + 1);
}
function bumpHoldRev(icao: string) {
  const k = String(icao).toUpperCase();
  rampHoldRev.set(k, (rampHoldRev.get(k) ?? 0) + 1);
}

function rampHoldDbEnabled(): boolean {
  // Default to enabled when DATABASE_URL is configured.
  // You can disable explicitly with RAMP_HOLDS_DB=false.
  return process.env.RAMP_HOLDS_DB !== 'false' && !!process.env.DATABASE_URL;
}

async function cleanupExpiredHoldsDb(icao: string, nowMs: number): Promise<void> {
  if (!rampHoldDbEnabled()) return;
  const up = String(icao).trim().toUpperCase();
  try {
    // Keep the table tidy so reads stay small.
    await sql`DELETE FROM ids_ramp_holds WHERE icao = ${up} AND expires_at_ms <= ${nowMs}`;
  } catch (err: any) {
    if (process.env.DB_DEBUG === 'true') {
      console.error('cleanupExpiredHoldsDb failed', { icao: up, message: err?.message, code: err?.code });
    }
  }
}

async function getActiveHoldsDb(icao: string, nowMs: number): Promise<HoldState[]> {
  if (!rampHoldDbEnabled()) return [];
  const up = String(icao).trim().toUpperCase();
  try {
    const rows = await sql<
      Array<{ stand_id: string; stand_ref: string | null; note: string | null; created_at_ms: any; expires_at_ms: any; created_by_cid: any; created_by_mode: any }>
    >`
      SELECT stand_id, stand_ref, note, created_at_ms, expires_at_ms, created_by_cid, created_by_mode
      FROM ids_ramp_holds
      WHERE icao = ${up} AND expires_at_ms > ${nowMs}
    `;
    return (rows ?? []).map((r) => ({
      icao: up,
      standId: String((r as any).stand_id),
      ...(String((r as any).stand_ref ?? '').trim() ? { standRef: String((r as any).stand_ref).trim().toUpperCase() } : {}),
      note: (r as any).note ?? undefined,
      createdAt: Number((r as any).created_at_ms ?? 0),
      expiresAt: Number((r as any).expires_at_ms ?? 0),
      createdByCid: Number((r as any).created_by_cid ?? 0) || undefined,
      createdByMode: (r as any).created_by_mode ? String((r as any).created_by_mode).slice(0, 16) : undefined,
    })).filter((h) => !!h.standId && Number.isFinite(h.expiresAt) && h.expiresAt > nowMs);
  } catch (err: any) {
    if (process.env.DB_DEBUG === 'true') {
      console.error('getActiveHoldsDb failed', { icao: up, message: err?.message, code: err?.code });
    }
    return [];
  }
}

async function upsertHoldDb(args: {
  icao: string;
  standId: string;
  standRef?: string | null;
  note?: string;
  createdByCid?: number;
  createdByMode?: string;
  createdAtMs: number;
  expiresAtMs: number;
}): Promise<boolean> {
  if (!rampHoldDbEnabled()) return false;
  const up = String(args.icao).trim().toUpperCase();
  const st = String(args.standId).trim();
  const now = Date.now();
  try {
    await sql`
      INSERT INTO ids_ramp_holds (
        icao, stand_id, stand_ref, note, created_by_cid, created_by_mode,
        created_at_ms, expires_at_ms, updated_at_ms
      ) VALUES (
        ${up}, ${st}, ${args.standRef ?? null}, ${args.note ?? null}, ${args.createdByCid ?? null}, ${args.createdByMode ?? null},
        ${args.createdAtMs}, ${args.expiresAtMs}, ${now}
      )
      ON DUPLICATE KEY UPDATE
        stand_ref = VALUES(stand_ref),
        note = VALUES(note),
        created_by_cid = VALUES(created_by_cid),
        created_by_mode = VALUES(created_by_mode),
        expires_at_ms = VALUES(expires_at_ms),
        updated_at_ms = VALUES(updated_at_ms)
    `;


    // Sanity check: if the table was created with INT columns, epoch-ms will overflow/truncate
    // and the row will be treated as already-expired (and get cleaned up immediately).
    try {
      const chk: any = await sql`SELECT expires_at_ms AS ex FROM ids_ramp_holds WHERE icao = ${up} AND stand_id = ${st} LIMIT 1`;
      const ex = Number((chk as any)?.[0]?.ex ?? 0);
      const exp = Number(args.expiresAtMs ?? 0);
      // ex should be in the future and close to what we just wrote (within 5 minutes).
      if (!Number.isFinite(ex) || !Number.isFinite(exp) || ex <= Date.now() || Math.abs(ex - exp) > 5 * 60_000) {
        if (process.env.DB_DEBUG === 'true') {
          console.error('upsertHoldDb sanity check failed (schema/unit mismatch)', {
            icao: up,
            standId: st,
            wrote: exp,
            read: ex,
          });
        }
        return false;
      }
    } catch {
      // If we can't validate, still treat as DB failure so we fall back to memory (better UX in dev).
      return false;
    }

    return true;
  } catch (err: any) {
    if (process.env.DB_DEBUG === 'true') {
      console.error('upsertHoldDb failed', { icao: up, standId: st, message: err?.message, code: err?.code });
    }
    return false;
  }
}

async function upsertPilotHoldDbUnique(args: {
  icao: string;
  standId: string;
  standRef?: string | null;
  note?: string;
  createdByCid: number;
  createdByMode?: string;
  createdAtMs: number;
  expiresAtMs: number;
}): Promise<{ saved: boolean; error?: string }> {
  if (!rampHoldDbEnabled()) return { saved: false };

  const up = String(args.icao).trim().toUpperCase();
  const st = String(args.standId).trim();
  const cid = Number(args.createdByCid ?? 0);
  const mode = args.createdByMode ? String(args.createdByMode).slice(0, 16) : 'pilot';
  const nowMs = Number(args.createdAtMs ?? Date.now());

  if (!st || !Number.isFinite(cid) || cid <= 0) return { saved: false };

  try {
    const out = await sql.begin(async (tx) => {
      // Keep the table tidy so reads stay small.
      await tx`DELETE FROM ids_ramp_holds WHERE icao = ${up} AND expires_at_ms <= ${nowMs}`;

      // Prevent pilots from overwriting another active hold on the same stand.
      const tgt: any = await tx`
        SELECT created_by_cid AS cid, created_by_mode AS mode
        FROM ids_ramp_holds
        WHERE icao = ${up} AND stand_id = ${st} AND expires_at_ms > ${nowMs}
        LIMIT 1
      `;
      const tr = (tgt as any)?.[0];
      if (tr) {
        const tcid = Number((tr as any).cid ?? 0) || 0;
        // If we can't attribute the existing row, treat it as held by someone else.
        if (!tcid || tcid !== cid) return { saved: false, error: 'stand_already_held' };
      }

      // Enforce: a pilot may only have ONE active hold at a time (per airport).
      const existing: any = await tx`
        SELECT stand_id AS standId
        FROM ids_ramp_holds
        WHERE icao = ${up} AND created_by_mode = 'pilot' AND created_by_cid = ${cid} AND expires_at_ms > ${nowMs}
      `;
      for (const r of (existing as any) ?? []) {
        const sid = String((r as any).standId ?? (r as any).stand_id ?? '').trim();
        if (sid && sid !== st) {
          await tx`DELETE FROM ids_ramp_holds WHERE icao = ${up} AND stand_id = ${sid}`;
        }
      }

      const writeNow = Date.now();
      await tx`
        INSERT INTO ids_ramp_holds (
          icao, stand_id, stand_ref, note, created_by_cid, created_by_mode,
          created_at_ms, expires_at_ms, updated_at_ms
        ) VALUES (
          ${up}, ${st}, ${args.standRef ?? null}, ${args.note ?? null}, ${cid}, ${mode},
          ${args.createdAtMs}, ${args.expiresAtMs}, ${writeNow}
        )
        ON DUPLICATE KEY UPDATE
          stand_id = VALUES(stand_id),
          stand_ref = VALUES(stand_ref),
          note = VALUES(note),
          created_by_cid = VALUES(created_by_cid),
          created_by_mode = VALUES(created_by_mode),
          expires_at_ms = VALUES(expires_at_ms),
          updated_at_ms = VALUES(updated_at_ms)
      `;

      // Sanity check: if the table was created with INT columns, epoch-ms will overflow/truncate.
      const chk: any = await tx`
        SELECT expires_at_ms AS ex
        FROM ids_ramp_holds
        WHERE icao = ${up} AND stand_id = ${st}
        LIMIT 1
      `;
      const ex = Number((chk as any)?.[0]?.ex ?? 0);
      const exp = Number(args.expiresAtMs ?? 0);

      if (!Number.isFinite(ex) || !Number.isFinite(exp) || ex <= Date.now() || Math.abs(ex - exp) > 5 * 60_000) {
        if (process.env.DB_DEBUG === 'true') {
          console.error('upsertPilotHoldDbUnique sanity check failed (schema/unit mismatch)', {
            icao: up,
            standId: st,
            wrote: exp,
            read: ex,
          });
        }
        return { saved: false, error: 'schema_mismatch' };
      }

      return { saved: true };
    });

    return out as any;
  } catch (err: any) {
    if (process.env.DB_DEBUG === 'true') {
      console.error('upsertPilotHoldDbUnique failed', { icao: up, standId: st, message: err?.message, code: err?.code });
    }
    return { saved: false };
  }
}

async function deleteHoldDb(icao: string, standId: string): Promise<boolean> {
  if (!rampHoldDbEnabled()) return false;
  const up = String(icao).trim().toUpperCase();
  const st = String(standId).trim();
  try {
    await sql`DELETE FROM ids_ramp_holds WHERE icao = ${up} AND stand_id = ${st}`;
    return true;
  } catch (err: any) {
    if (process.env.DB_DEBUG === 'true') {
      console.error('deleteHoldDb failed', { icao: up, standId: st, message: err?.message, code: err?.code });
    }
    return false;
  }
}

function cleanupClaims(now: number) {
  for (const [k, v] of rampClaims.entries()) {
    if (v.expiresAt <= now) rampClaims.delete(k);
  }
}
function cleanupHolds(now: number) {
  for (const [k, v] of rampHolds.entries()) {
    if (v.expiresAt <= now) rampHolds.delete(k);
  }
}
function cleanupCoord(now: number) {
  for (const [k, v] of rampCoord.entries()) {
    if (v.expiresAt <= now) rampCoord.delete(k);
  }
}

function parkKey(icao: string, callsign: string) {
  return `${icao}:${callsign}`;
}

function cleanupParkState(now: number) {
  const cutoff = now - 2 * 60_000;
  for (const [k, v] of parkState.entries()) {
    if (v.lastSeen < cutoff) parkState.delete(k);
  }
}

function pilotAircraftType(p: any): string | undefined {
  const fp = p?.flight_plan ?? {};
  const t = fp?.aircraft_short ?? fp?.aircraft_faa ?? fp?.aircraft ?? fp?.remarks;
  const s = t ? String(t).trim() : '';
  return s ? s.slice(0, 20) : undefined;
}

function normalizeCallsign(v: string) {
  return String(v || '').trim().toUpperCase().replace(/\s+/g, '');
}

function inferAreaForPosition(
  lat: number,
  lon: number,
  stands: RampStand[],
  areas: RampArea[]
): string {
  // 1) Nearest-stand inference (fast enough for the typical on-ground list size)
  let bestArea = 'other';
  let bestD = Infinity;

  // Only scan stands with an areaId to reduce work.
  for (const s of stands) {
    const d = haversineMeters(lat, lon, s.lat, s.lon);
    if (d < bestD) {
      bestD = d;
      bestArea = s.areaId || 'other';
    }
  }

  if (Number.isFinite(bestD) && bestD <= 250) return bestArea;

  // 2) Fallback: if inside an area bbox, use that.
  for (const a of areas) {
    if (lat >= a.bbox.south && lat <= a.bbox.north && lon >= a.bbox.west && lon <= a.bbox.east) return a.id;
  }

  return 'other';
}

export async function getRampOccupancy(icao: string): Promise<RampOccupancyResponse> {
  const cfg = configFor(icao);
  const up = cfg.icao;

  // Keep this lightly cached; map UI refreshes every ~15s.
  const rev = (rampClaimRev.get(up) ?? 0) + (rampHoldRev.get(up) ?? 0);
  return await withLiveCache(`ramp.occ.v2.${up}.${rev}`, 8, async () => {
    const { stands, center, bbox, areas } = await getRampStands(up);

    const pilots = await fetchVatsimPilots();

    const now = Date.now();
    cleanupParkState(now);
    cleanupClaims(now);
    cleanupHolds(now);

    // If DB-backed holds are enabled, keep the table tidy and pull active holds.
    // We still keep the in-memory holds map as a fallback when DB isn't configured.
    await cleanupExpiredHoldsDb(up, now);
    const dbHolds = await getActiveHoldsDb(up, now);

    const inBbox = (lat: number, lon: number) =>
      lat >= bbox.south && lat <= bbox.north && lon >= bbox.west && lon <= bbox.east;

    // Ground/park heuristics.
    const ON_GROUND_MAX_KTS = 60;
    const ON_GROUND_MAX_ALT_FT = 5000;
    const ASSIGN_MAX_KTS = 12;
    const ASSIGN_MAX_ALT_FT = 2500;

    const groundCandidates: any[] = [];
    const pilotsInBbox = new Map<string, any>();
    for (const p of pilots) {
      const lat = Number(p?.latitude);
      const lon = Number(p?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (!inBbox(lat, lon)) continue;

      const gs = Number(p?.groundspeed ?? 0);
      const alt = Number(p?.altitude ?? p?.alt ?? NaN);
      const callsign = String(p?.callsign ?? '').trim();
      if (!callsign) continue;

      pilotsInBbox.set(callsign.toUpperCase(), p);

      // Keep only aircraft that look like they are on/near the ground at the airport.
      if (Number.isFinite(gs) && gs > ON_GROUND_MAX_KTS) continue;
      if (Number.isFinite(alt) && alt > ON_GROUND_MAX_ALT_FT) continue;

      groundCandidates.push(p);
    }

    // Copy stands into a working map so we can annotate occupancy/holds.
    const standById = new Map<string, RampStand>();
    for (const s of stands) standById.set(s.id, { ...s, occupied: false, manual: false, held: false });

    // Apply holds (DB-backed first, then in-memory fallback).
    let heldCount = 0;
    const activeHolds: HoldState[] = [
      ...(dbHolds ?? []),
      ...[...rampHolds.values()].filter((h) => h.icao === up),
    ];
    for (const h of activeHolds) {
      const s = standById.get(h.standId);
      if (!s) continue;
      if (!s.occupied && !s.manual) {
        s.held = true;
        s.holdNote = h.note;
        s.holdExpiresAt = h.expiresAt;
        s.holdCreatedByCid = (h as any).createdByCid;
        s.holdCreatedByMode = (h as any).createdByMode;
        heldCount++;
        standById.set(s.id, s);
      }
    }

    const occupiedList: RampOccupancyResponse['occupiedList'] = [];
    const unassigned: RampOccupancyResponse['unassigned'] = [];

    // Apply manual claim overrides first.
    const claimedCallsigns = new Set<string>();
    for (const [k, c] of rampClaims.entries()) {
      if (c.icao !== up) continue;
      const s = standById.get(c.standId);
      if (!s) {
        rampClaims.delete(k);
        continue;
      }
      const csUp = String(c.callsign).toUpperCase();
      const p = pilotsInBbox.get(csUp);
      if (!p) {
        if (c.offline) {
          // Offline (prefile) claim: keep it even if the aircraft is not yet connected.
          s.occupied = true;
          s.manual = true;
          s.held = false;
          s.holdNote = undefined;
          s.aircraft = { callsign: csUp };
          standById.set(s.id, s);
          claimedCallsigns.add(csUp);
          continue;
        }
        // Aircraft no longer present; drop the claim.
        rampClaims.delete(k);
        continue;
      }
      const gs = Number(p?.groundspeed ?? 0);
      // If they're clearly moving fast, treat as no longer "at the stand" and drop the claim.
      if (Number.isFinite(gs) && gs > 40) {
        rampClaims.delete(k);
        continue;
      }
      s.occupied = true;
      s.manual = true;
      s.held = false;
      s.holdNote = undefined;
      s.aircraft = { callsign: csUp, aircraftType: pilotAircraftType(p), groundspeed: gs };
      standById.set(s.id, s);
      claimedCallsigns.add(csUp);
    }

    // Keep track of best (closest) assignment per stand.
    const assignedDist = new Map<string, number>();

    for (const p of groundCandidates) {
      const lat = Number(p.latitude);
      const lon = Number(p.longitude);
      const callsign = String(p.callsign ?? '').trim();
      if (claimedCallsigns.has(callsign.toUpperCase())) continue;
      const gs = Number(p.groundspeed ?? 0);
      const alt = Number(p?.altitude ?? p?.alt ?? NaN);

      // If the aircraft is moving quickly (taxiing out / rolling) we still show it as "on ground"
      // but we don't try to snap it into a stand.
      const assignEligible =
        (!Number.isFinite(gs) || gs <= ASSIGN_MAX_KTS) && (!Number.isFinite(alt) || alt <= ASSIGN_MAX_ALT_FT);

      let bestId: string | null = null;
      let bestD = Infinity;

      for (const s of standById.values()) {
        if (s.manual) continue; // don't auto-assign into a manually claimed spot
        if (s.held) continue; // held = not assignable by auto-snap
        const d = haversineMeters(lat, lon, s.lat, s.lon);
        if (d < bestD) {
          bestD = d;
          bestId = s.id;
        }
      }

      if (assignEligible && bestId && Number.isFinite(bestD) && bestD <= cfg.snapMeters) {
        const prevBest = assignedDist.get(bestId);
        if (prevBest == null || bestD < prevBest) {
          assignedDist.set(bestId, bestD);
          const stand = standById.get(bestId)!;
          stand.occupied = true;
          stand.aircraft = { callsign, aircraftType: pilotAircraftType(p), groundspeed: gs };
          standById.set(bestId, stand);
        }
      } else {
        unassigned.push({
          callsign: callsign.toUpperCase(),
          latitude: lat,
          longitude: lon,
          aircraftType: pilotAircraftType(p),
          groundspeed: gs,
        });
      }
    }

    const standsOut = Array.from(standById.values());

    for (const s of standsOut) {
      if (!s.occupied || !s.aircraft) continue;
      occupiedList.push({
        standId: s.id,
        ref: s.ref ?? s.name,
        callsign: s.aircraft.callsign,
        groundspeed: s.aircraft.groundspeed,
        aircraftType: s.aircraft.aircraftType,
      });
    }

    // sort occupied by ref then callsign
    occupiedList.sort(
      (a, b) => String(a.ref ?? '').localeCompare(String(b.ref ?? '')) || a.callsign.localeCompare(b.callsign)
    );

    const occupied = occupiedList.length;
    const total = standsOut.length;
    // "Open" means available (not occupied and not held)
    const open = standsOut.filter((s) => !s.occupied && !s.held).length;

    return {
      ok: true,
      icao: up,
      center,
      bbox,
      areas,
      stands: standsOut,
      occupiedList,
      unassigned,
      summary: {
        totalStands: total,
        occupied,
        open,
        held: heldCount,
        // Note: these are "on-ground" aircraft that weren't snapped to a stand.
        unassignedParked: unassigned.length,
        updatedAtIso: new Date().toISOString(),
      },
    };
  });
}

export type RampGroundTrafficItem = {
  callsign: string;
  latitude: number;
  longitude: number;
  groundspeed?: number;
  altitude?: number;
  heading?: number;
  aircraftType?: string;
  parked?: boolean;
  stoppedSeconds?: number;
  state?: 'parked' | 'taxi' | 'ground';
  intent?: 'arriving' | 'departing';
  areaId?: string;
  departure?: string;
  arrival?: string;
};

/**
 * Returns a lightweight list of aircraft that appear to be on (or very near) the ground at the given airport.
 * Used by the Ramp UI (list + claim dialog).
 */
export async function getRampGroundTraffic(icao: string): Promise<RampGroundTrafficItem[]> {
  const cfg = configFor(icao);
  const up = cfg.icao;

  return await withLiveCache(`ramp.ground.v2.${up}`, 8, async () => {
    const { bbox, stands, areas } = await getRampStands(up);
    const pilots = await fetchVatsimPilots();
    const now = Date.now();

    cleanupParkState(now);

    const inBbox = (lat: number, lon: number) =>
      lat >= bbox.south && lat <= bbox.north && lon >= bbox.west && lon <= bbox.east;

    const stableKnots = 2.0;
    const stableMs = 45_000;

    const out: RampGroundTrafficItem[] = [];

    for (const p of pilots) {
      const lat = Number(p?.latitude);
      const lon = Number(p?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (!inBbox(lat, lon)) continue;

      const callsign = String(p?.callsign ?? '').trim();
      if (!callsign) continue;

      const gs = Number(p?.groundspeed ?? 0);
      const alt = Number(p?.altitude ?? p?.alt ?? NaN);

      // Heuristic "on ground" filter:
      if (Number.isFinite(gs) && gs > 60) continue;
      if (Number.isFinite(alt) && alt > 5000) continue;

      const key = parkKey(up, callsign.toUpperCase());
      if (gs <= stableKnots) {
        const prev = parkState.get(key);
        if (!prev) parkState.set(key, { since: now, lastSeen: now });
        else parkState.set(key, { since: prev.since, lastSeen: now });
      } else {
        // still on the ground, just not "stopped"
        parkState.set(key, { since: now, lastSeen: now });
      }

      const st = parkState.get(key);
      const parked = !!st && now - st.since >= stableMs && gs <= stableKnots;
      const stoppedSeconds = !!st && gs <= stableKnots ? Math.floor((now - st.since) / 1000) : 0;

      const fp = p?.flight_plan ?? {};
      const dep = fp?.departure ? String(fp.departure).trim().toUpperCase() : undefined;
      const arr = fp?.arrival ? String(fp.arrival).trim().toUpperCase() : undefined;

      const intent: RampGroundTrafficItem['intent'] =
        dep === up ? 'departing' : arr === up ? 'arriving' : undefined;

      const state: RampGroundTrafficItem['state'] = parked ? 'parked' : gs > 12 ? 'taxi' : 'ground';

      const areaId = inferAreaForPosition(lat, lon, stands, areas);

      out.push({
        callsign: callsign.toUpperCase(),
        latitude: lat,
        longitude: lon,
        groundspeed: Number.isFinite(gs) ? gs : undefined,
        altitude: Number.isFinite(alt) ? alt : undefined,
        heading: Number.isFinite(Number(p?.heading ?? p?.true_track ?? p?.track ?? NaN))
          ? Number(p?.heading ?? p?.true_track ?? p?.track)
          : undefined,
        aircraftType: pilotAircraftType(p),
        parked,
        stoppedSeconds,
        state,
        intent,
        areaId,
        departure: dep,
        arrival: arr,
      });
    }

    out.sort((a, b) => {
      const ap = a.parked ? 1 : 0;
      const bp = b.parked ? 1 : 0;
      if (bp !== ap) return bp - ap; // parked first
      const ag = a.groundspeed ?? 0;
      const bg = b.groundspeed ?? 0;
      if (ag !== bg) return ag - bg;
      return a.callsign.localeCompare(b.callsign);
    });

    return out;
  });
}

export async function claimRampStand(
  icao: string,
  standId: string,
  callsign: string
): Promise<{ ok: boolean; error?: string }> {
  const cfg = configFor(icao);
  const up = cfg.icao;
  const stId = String(standId || '').trim();
  const cs = normalizeCallsign(callsign);
  if (!stId) return { ok: false, error: 'Missing standId' };
  if (!cs) return { ok: false, error: 'Missing callsign' };
  if (!/^[A-Z0-9]{2,12}$/.test(cs)) return { ok: false, error: 'Invalid callsign format' };

  const { stands, bbox } = await getRampStands(up);
  const stand = stands.find((s) => s.id === stId);
  if (!stand) return { ok: false, error: 'Stand not found' };

  // If the stand is held, treat as unavailable (unless the user is explicitly overriding by assigning here).
  // We choose the simple rule: claiming clears any hold on that stand.
  const hk = holdKey(up, stId);
  if (rampHolds.has(hk)) {
    rampHolds.delete(hk);
    bumpHoldRev(up);
  }

  // Validate that the aircraft is currently at/near the airport.
  const pilots = await fetchVatsimPilots();
  const p = pilots.find((x) => normalizeCallsign(x?.callsign) === cs);
  if (!p) return { ok: false, error: 'Callsign not found on network' };
  const lat = Number(p?.latitude);
  const lon = Number(p?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { ok: false, error: 'No position available for that callsign' };
  const inBbox = lat >= bbox.south && lat <= bbox.north && lon >= bbox.west && lon <= bbox.east;
  if (!inBbox) return { ok: false, error: 'That aircraft is not near this airport' };
  const gs = Number(p?.groundspeed ?? 0);
  if (Number.isFinite(gs) && gs > 60) return { ok: false, error: 'That aircraft appears to be moving too fast to assign to a gate' };

  // Remove any existing claim for this callsign at this airport (avoid double-claiming).
  for (const [k, v] of rampClaims.entries()) {
    if (v.icao === up && normalizeCallsign(v.callsign) === cs) rampClaims.delete(k);
  }

  const now = Date.now();
  // TTL: 6h by default; it will auto-drop if the aircraft disappears/moves fast.
  const expiresAt = now + 6 * 60 * 60_000;
  rampClaims.set(claimKey(up, stId), { icao: up, standId: stId, callsign: cs, createdAt: now, expiresAt });
  bumpRev(up);
  return { ok: true };
}

export async function claimRampStandOffline(
  icao: string,
  standId: string,
  callsign: string
): Promise<{ ok: boolean; error?: string }> {
  const cfg = configFor(icao);
  const up = cfg.icao;
  const stId = String(standId || '').trim();
  const cs = normalizeCallsign(callsign);
  if (!stId) return { ok: false, error: 'Missing standId' };
  if (!cs) return { ok: false, error: 'Missing callsign' };
  if (!/^[A-Z0-9]{2,12}$/.test(cs)) return { ok: false, error: 'Invalid callsign format' };

  const { stands } = await getRampStands(up);
  const stand = stands.find((s) => s.id === stId);
  if (!stand) return { ok: false, error: 'Stand not found' };

  // Clear any hold on this stand (claiming implies intent to occupy).
  const hk = holdKey(up, stId);
  if (rampHolds.has(hk)) {
    rampHolds.delete(hk);
    bumpHoldRev(up);
  }

  // Remove any existing claim for this callsign at this airport (avoid double-claiming).
  for (const [k, v] of rampClaims.entries()) {
    if (v.icao === up && normalizeCallsign(v.callsign) === cs) rampClaims.delete(k);
  }

  const now = Date.now();
  // Offline claims are intended for prefiled departures. TTL: 6h (same as connected claims).
  const expiresAt = now + 6 * 60 * 60_000;
  rampClaims.set(claimKey(up, stId), { icao: up, standId: stId, callsign: cs, createdAt: now, expiresAt, offline: true });
  bumpRev(up);
  return { ok: true };
}

export async function unclaimRampStand(icao: string, standId: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = configFor(icao);
  const up = cfg.icao;
  const stId = String(standId || '').trim();
  if (!stId) return { ok: false, error: 'Missing standId' };
  rampClaims.delete(claimKey(up, stId));
  bumpRev(up);
  return { ok: true };
}

export async function setRampStandHold(
  icao: string,
  standId: string,
  hold: boolean,
  note?: string,
  ttlMinutes?: number,
  createdByCid?: number,
  createdByMode?: string
): Promise<{ ok: boolean; expiresAt?: number; persisted?: boolean; dbEnabled?: boolean; error?: string }> {
  const cfg = configFor(icao);
  const up = cfg.icao;
  const stId = String(standId || '').trim();
  if (!stId) return { ok: false, error: 'Missing standId' };

  const { stands } = await getRampStands(up);
  const stand = stands.find((s) => s.id === stId);
  if (!stand) return { ok: false, error: 'Stand not found' };

  // Store a human-friendly label (e.g. C27 / A56) alongside the OSM stand id.
  // This is what we show on the Pilot page as "Your reserved gate".
  const standRef = String(stand.ref ?? stand.name ?? '').trim();
  const standRefNorm = standRef ? standRef.toUpperCase() : null;

  const k = holdKey(up, stId);

  const dbOn = rampHoldDbEnabled();

  const cidNum = Number.isFinite(Number(createdByCid)) ? Number(createdByCid) : undefined;
  const modeLower = String(createdByMode ?? '').trim().toLowerCase();



  if (!hold) {
    // Remove from DB (if enabled) and from in-memory fallback.
    const deleted = await deleteHoldDb(up, stId);
    rampHolds.delete(k);
    bumpHoldRev(up);
    return { ok: true, persisted: dbOn ? deleted : false, dbEnabled: dbOn };
  }

  const n = (note ?? '').toString().trim();
  const now = Date.now();
  // TTL: 2 hours by default (enough for an inbound or gate planning); can be re-applied.
  // Pilot reservations may pass a shorter TTL.
  const ttlMin = Number.isFinite(Number(ttlMinutes)) && Number(ttlMinutes) > 0 ? Number(ttlMinutes) : 120;
  const expiresAt = now + ttlMin * 60_000;
  // Prefer DB-backed persistence (survives restarts / multiple instances).
  let saved = false;

  // Pilot reservations: enforce ONE active reservation per pilot and prevent overwriting someone else's hold.
  if (dbOn && hold && modeLower === 'pilot' && cidNum) {
    const r = await upsertPilotHoldDbUnique({
      icao: up,
      standId: stId,
      standRef: standRefNorm,
      note: n || undefined,
      createdByCid: cidNum,
      createdByMode: 'pilot',
      createdAtMs: now,
      expiresAtMs: expiresAt,
    });

    if (r?.error === 'stand_already_held') {
      return { ok: false, error: 'stand_already_held', dbEnabled: dbOn };
    }

    saved = !!r?.saved;
  } else {
    saved = await upsertHoldDb({
      icao: up,
      standId: stId,
      standRef: standRefNorm,
      note: n || undefined,
      createdByCid: cidNum,
      createdByMode: createdByMode ? String(createdByMode).slice(0, 16) : undefined,
      createdAtMs: now,
      expiresAtMs: expiresAt,
    });
  }

  if (saved) {
    // If we previously fell back to memory, clear it to avoid duplicate sources.
    rampHolds.delete(k);
  } else {
    // Fallback to in-memory holds for local dev if DB/table isn't available (or schema mismatch).
    // Enforce the same pilot uniqueness rule in memory mode.
    if (hold && modeLower === 'pilot' && cidNum) {
      const existing = rampHolds.get(k);
      if (existing && existing.expiresAt > now && existing.createdByCid && existing.createdByCid !== cidNum) {
        return { ok: false, error: 'stand_already_held', dbEnabled: dbOn };
      }
      for (const [hk, hv] of rampHolds.entries()) {
        if (hk === k) continue;
        if (hv.icao === up && hv.expiresAt > now && hv.createdByMode === 'pilot' && hv.createdByCid === cidNum) {
          rampHolds.delete(hk);
        }
      }
    }

    rampHolds.set(k, {
      icao: up,
      standId: stId,
      ...(standRefNorm ? { standRef: standRefNorm } : {}),
      note: n || undefined,
      createdAt: now,
      expiresAt,
      createdByCid: cidNum,
      createdByMode: modeLower || undefined,
    });
  }

  bumpHoldRev(up);
  return { ok: true, expiresAt, persisted: saved, dbEnabled: dbOn };
}

export async function smartAssignRampStand(
  icao: string,
  callsign: string,
  preferredAreaId?: string
): Promise<{ ok: boolean; standId?: string; ref?: string; areaId?: string; error?: string }> {
  const cfg = configFor(icao);
  const up = cfg.icao;
  const cs = normalizeCallsign(callsign);
  if (!cs) return { ok: false, error: 'Missing callsign' };

  cleanupClaims(Date.now());
  cleanupHolds(Date.now());

  const occ = await getRampOccupancy(up);
  if (!occ.ok) return { ok: false, error: 'Ramp occupancy unavailable' };

  const stands = occ.stands ?? [];
  const areas = occ.areas ?? [];

  // Validate pilot exists + get current position
  const pilots = await fetchVatsimPilots();
  const p = pilots.find((x) => normalizeCallsign(x?.callsign) === cs);
  if (!p) return { ok: false, error: 'Callsign not found on network' };
  const lat = Number(p?.latitude);
  const lon = Number(p?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { ok: false, error: 'No position available for that callsign' };

  // Pick area: (1) explicit selection overrides everything. (2) infer from position. (3) all.
  let targetArea: string | undefined;
  const pref = (preferredAreaId ?? '').toString().trim();
  if (pref && pref !== 'all') {
    targetArea = pref;
  } else {
    targetArea = inferAreaForPosition(lat, lon, stands, areas);
  }

  const candidatesInArea = stands.filter((s) => !s.occupied && !s.manual && !s.held && (targetArea ? (s.areaId || 'other') === targetArea : true));
  const candidatesAny = stands.filter((s) => !s.occupied && !s.manual && !s.held);

  const pickBest = (list: RampStand[]) => {
    let best: RampStand | null = null;
    let bestD = Infinity;
    for (const s of list) {
      const d = haversineMeters(lat, lon, s.lat, s.lon);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  };

  const best = (candidatesInArea.length ? pickBest(candidatesInArea) : null) ?? (candidatesAny.length ? pickBest(candidatesAny) : null);

  if (!best) return { ok: false, error: 'No open stands available' };

  const res = await claimRampStand(up, best.id, cs);
  if (!res.ok) return { ok: false, error: res.error ?? 'Failed to assign stand' };

  return { ok: true, standId: best.id, ref: best.ref ?? best.name, areaId: best.areaId ?? targetArea };
}

export type RampBackgroundFeatureCollection = {
  type: 'FeatureCollection';
  features: any[];
};

export async function getRampBackground(icao: string): Promise<RampBackgroundFeatureCollection> {
  const cfg = configFor(icao);
  const up = cfg.icao;

  // Background changes rarely; cache 24h.
  return await withLiveCache(`ramp.bg.v1.${up}`, 24 * 60 * 60, async () => {
    if (!cfg.iata) return { type: 'FeatureCollection', features: [] };

    const q = `
[out:json][timeout:25];
area["aeroway"="aerodrome"]["iata"="${cfg.iata}"]->.a;
(
  way(area.a)["aeroway"="taxiway"];
  way(area.a)["aeroway"="taxilane"];
  way(area.a)["aeroway"="runway"];
  way(area.a)["aeroway"="apron"];
);
out geom;
`.trim();

    let json: any | null = null;
    for (const endpoint of OVERPASS_ENDPOINTS) {
      json = await fetchJson(endpoint, `data=${encodeURIComponent(q)}`, 12_000);
      if (json) break;
    }
    const elements: OverpassElement[] = Array.isArray(json?.elements) ? json.elements : [];

    const features: any[] = [];

    for (const el of elements) {
      if (el.type !== 'way') continue;
      const geom = Array.isArray(el.geometry) ? el.geometry : [];
      if (!geom.length) continue;
      const tags = el.tags ?? {};
      const kind = String(tags.aeroway ?? '').toLowerCase();
      const coords = geom.map((p) => [p.lon, p.lat]);

      // If it's a closed ring, render polygon; else render line.
      const isClosed = coords.length > 3 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1];

      if (kind === 'apron' && isClosed) {
        features.push({
          type: 'Feature',
          properties: { kind },
          geometry: { type: 'Polygon', coordinates: [coords] },
        });
      } else {
        features.push({
          type: 'Feature',
          properties: { kind },
          geometry: { type: 'LineString', coordinates: coords },
        });
      }
    }

    return { type: 'FeatureCollection', features };
  });
}

export async function getRampCoordQueue(icao: string): Promise<CoordEntry[]> {
  const cfg = configFor(icao);
  const up = cfg.icao;
  cleanupCoord(Date.now());
  return Array.from(rampCoord.values()).filter((x) => x.icao === up).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function upsertRampCoordEntry(
  icao: string,
  callsign: string,
  status: string,
  note?: string
): Promise<{ ok: boolean; error?: string }> {
  const cfg = configFor(icao);
  const up = cfg.icao;
  const cs = normalizeCallsign(callsign);
  if (!cs) return { ok: false, error: 'Missing callsign' };

  cleanupCoord(Date.now());

  const st = String(status || '').trim() || 'ready_taxi';
  const n = (note ?? '').toString().trim();

  const now = Date.now();
  // TTL: 12h
  const expiresAt = now + 12 * 60 * 60_000;
  rampCoord.set(coordKey(up, cs), { icao: up, callsign: cs, status: st, note: n || undefined, updatedAt: now, expiresAt });
  return { ok: true };
}

export async function deleteRampCoordEntry(
  icao: string,
  callsign: string
): Promise<{ ok: boolean; error?: string }> {
  const cfg = configFor(icao);
  const up = cfg.icao;
  const cs = normalizeCallsign(callsign);
  if (!cs) return { ok: false, error: 'Missing callsign' };

  rampCoord.delete(coordKey(up, cs));
  return { ok: true };
}