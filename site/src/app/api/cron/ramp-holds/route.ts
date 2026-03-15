import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { tableExists } from '@/lib/schema';
import { RAMP_AIRPORTS } from '@/lib/ids/rampAirports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(req: Request): boolean {
  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret) return false;

  const url = new URL(req.url);

  const q = (url.searchParams.get('secret') || '').trim();
  if (q && q === secret) return true;

  const auth = (req.headers.get('authorization') || '').trim();
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token === secret) return true;
  }

  return false;
}

const StatusSchema = z.object({
  data: z.object({
    v3: z.array(z.string()).optional(),
    v3_json: z.array(z.string()).optional(),
  }),
});

const DataSchema = z.object({
  pilots: z
    .array(
      z
        .object({
          cid: z.number().optional(),
          latitude: z.number().optional(),
          longitude: z.number().optional(),
          altitude: z.number().optional(),
          groundspeed: z.number().optional(),
          last_updated: z.string().optional(),
        })
        .passthrough()
    )
    .optional(),
});
type PilotState = {
  cid: number;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  groundspeed?: number;
  lastUpdatedMs?: number;
};

async function fetchPilotStates(): Promise<Map<number, PilotState>> {
  const statusRes = await fetch('https://status.vatsim.net/status.json', { cache: 'no-store' });
  if (!statusRes.ok) return new Map();

  const statusParsed = StatusSchema.safeParse(await statusRes.json());
  if (!statusParsed.success) return new Map();

  const urls = statusParsed.data.data.v3 ?? statusParsed.data.data.v3_json ?? [];
  const dataUrl = urls[0];
  if (!dataUrl) return new Map();

  const dataRes = await fetch(dataUrl, { cache: 'no-store' });
  if (!dataRes.ok) return new Map();

  const dataParsed = DataSchema.safeParse(await dataRes.json());
  if (!dataParsed.success) return new Map();

  const map = new Map<number, PilotState>();
  for (const p of dataParsed.data.pilots ?? []) {
    const cid = Number((p as any).cid ?? 0);
    if (!cid) continue;

    const lat = Number((p as any).latitude);
    const lon = Number((p as any).longitude);
    const alt = Number((p as any).altitude);
    const gs = Number((p as any).groundspeed);
    const lu = String((p as any).last_updated ?? '').trim();

    let lastUpdatedMs: number | undefined = undefined;
    if (lu) {
      const t = Date.parse(lu);
      if (Number.isFinite(t)) lastUpdatedMs = t;
    }

    map.set(cid, {
      cid,
      latitude: Number.isFinite(lat) ? lat : undefined,
      longitude: Number.isFinite(lon) ? lon : undefined,
      altitude: Number.isFinite(alt) ? alt : undefined,
      groundspeed: Number.isFinite(gs) ? gs : undefined,
      lastUpdatedMs,
    });
  }

  return map;
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * "Pilot activity" heuristic for auto-extending holds:
 * - still on the VATSIM feed (connected)
 * - still near the airport that the hold is for (within the ramp airport bbox + buffer)
 * - not obviously enroute/departed (altitude cap)
 */
function isPilotActiveForAirport(icao: string, p?: PilotState | null): boolean {
  if (!p) return false;

  const cfg = RAMP_AIRPORTS[String(icao || '').trim().toUpperCase()];
  if (!cfg) return true; // unknown airport => fall back to connected-only behavior

  const lat = p.latitude;
  const lon = p.longitude;

  // If we don't have a position, keep prior connected-only behavior.
  if (!Number.isFinite(lat as any) || !Number.isFinite(lon as any)) return true;

  const alt = Number(p.altitude ?? 0);
  if (Number.isFinite(alt) && alt > 8000) return false; // likely departed/enroute

  // Buffer the bbox slightly (degrees) so pilots on edge of coverage aren't released too eagerly.
  const bufLat = 0.03;
  const bufLon = 0.04;

  const inBox =
    (lat as number) >= cfg.bbox.south - bufLat &&
    (lat as number) <= cfg.bbox.north + bufLat &&
    (lon as number) >= cfg.bbox.west - bufLon &&
    (lon as number) <= cfg.bbox.east + bufLon;

  if (inBox) return true;

  // Fallback distance check to center (helps if bbox is imperfect).
  const d = haversineMeters(lat as number, lon as number, cfg.center.lat, cfg.center.lon);
  return d <= 25_000; // ~13.5nm
}

type HoldRow = {
  icao: string;
  stand_id: string;
  created_by_cid: number | null;
  created_by_mode: string | null;
  created_at_ms: number;
  expires_at_ms: number;
};

const EXTEND_WHEN_WITHIN_MS = 10 * 60 * 1000; // 10 minutes
const EXTEND_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_TOTAL_MS = 3 * 60 * 60 * 1000; // 3 hours

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const exists = await tableExists('ids_ramp_holds');
  if (!exists) {
    return NextResponse.json({
      ok: false,
      error: 'Missing ids_ramp_holds table. Run sql/create_table_ids_ramp_holds.sql first.',
    }, { status: 400 });
  }

  const url = new URL(req.url);
  const icao = String(url.searchParams.get('icao') ?? '').trim().toUpperCase();
  const now = Date.now();

  // Clean up expired holds first.
  let expiredDeleted = 0;
  try {
    const res = await sql<{ affectedRows?: number }[]>`
      DELETE FROM ids_ramp_holds
      WHERE expires_at_ms <= ${now}
      ${icao ? sql`AND icao = ${icao}` : sql``}
    `;
    expiredDeleted = Number((res as any)?.affectedRows ?? 0) || 0;
  } catch {
    // ignore
  }

  const pilotStates = await fetchPilotStates();

  const rows = await sql<HoldRow[]>`
    SELECT icao, stand_id, created_by_cid, created_by_mode, created_at_ms, expires_at_ms
    FROM ids_ramp_holds
    WHERE expires_at_ms > ${now}
    ${icao ? sql`AND icao = ${icao}` : sql``}
    AND (created_by_mode = 'pilot')
    ORDER BY expires_at_ms ASC
    LIMIT 5000
  `;

  let checked = 0;
  let extended = 0;
  let released = 0;
  let releasedInactive = 0;
  let unchanged = 0;

  for (const r of rows ?? []) {
    checked++;

    const cid = Number(r.created_by_cid ?? 0);
    const pState = pilotStates.get(cid) ?? null;
    if (!cid || !pState) {
      // Pilot is no longer connected -> release their hold.
      try {
        await sql`
          DELETE FROM ids_ramp_holds
          WHERE icao = ${r.icao} AND stand_id = ${r.stand_id} AND created_by_mode = 'pilot'
        `;
        released++;
      } catch {
        // ignore
      }
      continue;
    }

    // Pilot is connected but no longer active around this airport -> release their hold.
    if (!isPilotActiveForAirport(r.icao, pState)) {
      try {
        await sql`
          DELETE FROM ids_ramp_holds
          WHERE icao = ${r.icao} AND stand_id = ${r.stand_id} AND created_by_mode = 'pilot'
        `;
        releasedInactive++;
      } catch {
        // ignore
      }
      continue;
    }

    const exp = Number(r.expires_at_ms || 0);
    if (!exp || exp - now > EXTEND_WHEN_WITHIN_MS) {
      unchanged++;
      continue;
    }

    const created = Number(r.created_at_ms || now);
    const cap = created + MAX_TOTAL_MS;
    const next = Math.min(now + EXTEND_TTL_MS, cap);

    if (next <= now) {
      // Cap reached.
      unchanged++;
      continue;
    }

    try {
      await sql`
        UPDATE ids_ramp_holds
        SET expires_at_ms = ${next}, updated_at_ms = ${now}
        WHERE icao = ${r.icao} AND stand_id = ${r.stand_id} AND created_by_mode = 'pilot'
      `;
      extended++;
    } catch {
      // ignore
    }
  }

  return NextResponse.json({
    ok: true,
    scopeIcao: icao || null,
    expiredDeleted,
    checked,
    extended,
    released,
    unchanged,
    connectedPilots: pilotStates.size,
    releasedInactive,
    now,
  });
}
