import { NextResponse } from 'next/server';

import { getUser } from '@/lib/auth/getUser';
import { isAdminRoles } from '@/lib/auth/admin';
import { canAccessAdmin } from '@/lib/auth/permissions';

import { getIdsCycleInfo, getLiveCacheMeta, loadIdsDataset } from '@/lib/idsStaticData';
import { getCurrentDtppCycle, buildFaaDtppResultsUrl } from '@/lib/dtpp/resolveChartLink';
import { toFaaIdent } from '@/lib/dtpp/zobFields';

export const dynamic = 'force-dynamic';

type StatusCheck = {
  id: string;
  label: string;
  ok: boolean;
  severity: 'critical' | 'warning' | 'info';
  latencyMs: number;
  detail?: string;
};

function nowMs() {
  return Date.now();
}

async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ac.signal, cache: 'no-store' });
  } finally {
    clearTimeout(t);
  }
}

async function checkJson(url: string, timeoutMs: number): Promise<{ ok: boolean; status: number; json: any | null; latencyMs: number }>
{
  const t0 = nowMs();
  try {
    const res = await fetchWithTimeout(url, timeoutMs);
    const latencyMs = nowMs() - t0;
    if (!res.ok) return { ok: false, status: res.status, json: null, latencyMs };
    const json = await res.json().catch(() => null);
    return { ok: true, status: res.status, json, latencyMs };
  } catch {
    return { ok: false, status: 0, json: null, latencyMs: nowMs() - t0 };
  }
}

async function mysqlPing(): Promise<{ ok: boolean; latencyMs: number; detail?: string }>
{
  const t0 = nowMs();
  try {
    const url = process.env.DATABASE_URL;
    if (!url) return { ok: false, latencyMs: nowMs() - t0, detail: 'Missing DATABASE_URL' };

    const mysql = await import('mysql2/promise');
    const u = new URL(url);
    const database = u.pathname.replace(/^\//, '');

    const conn = await mysql.createConnection({
      host: u.hostname,
      port: u.port ? Number(u.port) : 3306,
      user: decodeURIComponent(u.username || ''),
      password: decodeURIComponent(u.password || ''),
      database,
      connectTimeout: 2500,
      timezone: 'Z',
      dateStrings: true,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    } as any);

    await conn.execute('SELECT 1');
    await conn.end();
    return { ok: true, latencyMs: nowMs() - t0, detail: 'SELECT 1' };
  } catch (e: any) {
    return { ok: false, latencyMs: nowMs() - t0, detail: e?.message ? String(e.message) : 'Connection failed' };
  }
}

function summarizeLiveCache(key: string): string | undefined {
  const meta = getLiveCacheMeta(key);
  if (!meta) return undefined;
  const ageSec = Math.max(0, Math.round((Date.now() - meta.createdAt) / 1000));
  const ttlSec = Math.max(0, Math.round((meta.expiresAt - meta.createdAt) / 1000));
  return `cache age ${ageSec}s (ttl ${ttlSec}s)`;
}

export async function GET(req: Request) {
  // Staff-only endpoint.
  const user = await getUser().catch(() => null);
  const allowed = Boolean(user && (canAccessAdmin(user) || isAdminRoles((user as any)?.roles)));
  if (!allowed) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

  const base = new URL(req.url);
  const mkLocal = (path: string) => {
    const u = new URL(base.toString());
    u.pathname = path;
    u.search = '';
    return u.toString();
  };

  const checks: StatusCheck[] = [];

  // DB connectivity
  {
    const r = await mysqlPing();
    checks.push({
      id: 'db',
      label: 'Database connectivity',
      ok: r.ok,
      severity: 'critical',
      latencyMs: r.latencyMs,
      detail: r.detail,
    });
  }

  // IDS cycle + datasets
  {
    const t0 = nowMs();
    try {
      const info = await getIdsCycleInfo(null);
      checks.push({
        id: 'ids.cycle',
        label: 'IDS cycle directory',
        ok: true,
        severity: 'info',
        latencyMs: nowMs() - t0,
        detail: info.cycle ? `${info.cycle} (${info.rootDir})` : info.rootDir,
      });
    } catch (e: any) {
      checks.push({
        id: 'ids.cycle',
        label: 'IDS cycle directory',
        ok: false,
        severity: 'warning',
        latencyMs: nowMs() - t0,
        detail: e?.message ?? 'Failed to resolve IDS cycle directory',
      });
    }
  }

  for (const dataset of ['apt', 'sid', 'star'] as const) {
    const t0 = nowMs();
    try {
      const out = await loadIdsDataset<any>(dataset);
      const data = out.data;
      const keys = data && typeof data === 'object' ? Object.keys(data).length : 0;
      checks.push({
        id: `ids.dataset.${dataset}`,
        label: `IDS dataset: ${dataset.toUpperCase()}`,
        ok: true,
        severity: 'critical',
        latencyMs: nowMs() - t0,
        detail: `${out.source} · cycle ${out.cycle ?? 'unknown'} · ${keys.toLocaleString()} top-level keys`,
      });
    } catch (e: any) {
      checks.push({
        id: `ids.dataset.${dataset}`,
        label: `IDS dataset: ${dataset.toUpperCase()}`,
        ok: false,
        severity: 'critical',
        latencyMs: nowMs() - t0,
        detail: e?.message ?? 'Failed to load',
      });
    }
  }

  // VATSIM status (URL discovery)
  {
    const r = await checkJson('https://status.vatsim.net/status.json', 8000);
    const v3 = Array.isArray(r.json?.data?.v3) ? r.json.data.v3.length : 0;
    checks.push({
      id: 'vatsim.status',
      label: 'VATSIM status.json',
      ok: r.ok && v3 > 0,
      severity: 'critical',
      latencyMs: r.latencyMs,
      detail: r.ok ? `v3 endpoints: ${v3}` : `HTTP ${r.status || 'ERR'}`,
    });
  }

  // vNAS status
  {
    const r = await checkJson('https://vnas.vatsim.net/api/v2/controller', 9000);
    const artccCount = r.ok && r.json?.artccs ? Object.keys(r.json.artccs).length : 0;
    checks.push({
      id: 'vnas.controllers',
      label: 'vNAS controller feed',
      ok: r.ok && artccCount > 0,
      severity: 'warning',
      latencyMs: r.latencyMs,
      detail: r.ok ? `artccs: ${artccCount}` : `HTTP ${r.status || 'ERR'}`,
    });
  }

  // IDS live endpoints (local)
  {
    const u = mkLocal('/api/ids/controllers');
    const r = await checkJson(u, 12000);
    const count = Number(r.json?.controllers?.length ?? 0);
    checks.push({
      id: 'ids.controllers',
      label: 'IDS: controllers feed',
      ok: r.ok,
      severity: 'critical',
      latencyMs: r.latencyMs,
      detail: r.ok ? `${count.toLocaleString()} controllers · ${summarizeLiveCache('ids.controllers') ?? 'no cache info'}` : `HTTP ${r.status || 'ERR'}`,
    });
  }
  {
    const u = mkLocal('/api/ids/aircraft');
    const r = await checkJson(u, 12000);
    const count = Number(r.json?.count ?? r.json?.aircraft?.length ?? 0);
    checks.push({
      id: 'ids.aircraft',
      label: 'IDS: aircraft feed',
      ok: r.ok,
      severity: 'warning',
      latencyMs: r.latencyMs,
      detail: r.ok ? `${count.toLocaleString()} nearby · ${summarizeLiveCache('ids.aircraft') ?? 'no cache info'}` : `HTTP ${r.status || 'ERR'}`,
    });
  }

  // Ramp sources (DTW as reference airport)
  {
    const u = mkLocal('/api/ids/ramp/stands') + '?icao=KDTW';
    const r = await checkJson(u, 12000);
    const count = Array.isArray(r.json?.stands) ? r.json.stands.length : 0;
    checks.push({
      id: 'ramp.stands',
      label: 'Ramp: gate/stand points (OSM/Overpass)',
      ok: r.ok && count > 0,
      severity: 'warning',
      latencyMs: r.latencyMs,
      detail: r.ok ? `${count.toLocaleString()} stands · ${summarizeLiveCache('ramp.stands.v4.KDTW') ?? 'no cache info'}` : `HTTP ${r.status || 'ERR'}`,
    });
  }
  {
    const u = mkLocal('/api/ids/ramp/background') + '?icao=KDTW';
    const r = await checkJson(u, 12000);
    const count = Array.isArray(r.json?.features) ? r.json.features.length : 0;
    checks.push({
      id: 'ramp.background',
      label: 'Ramp: background geometry (OSM/Overpass)',
      ok: r.ok,
      severity: 'info',
      latencyMs: r.latencyMs,
      detail: r.ok ? `${count.toLocaleString()} features · ${summarizeLiveCache('ramp.bg.v1.KDTW') ?? 'no cache info'}` : `HTTP ${r.status || 'ERR'}`,
    });
  }

  // Tile provider availability (used by ramp map)
  {
    const t0 = nowMs();
    try {
      const res = await fetchWithTimeout('https://a.basemaps.cartocdn.com/dark_all/0/0/0.png', 8000, { method: 'GET' });
      checks.push({
        id: 'tiles.carto',
        label: 'Map tiles (CARTO basemaps)',
        ok: res.ok,
        severity: 'info',
        latencyMs: nowMs() - t0,
        detail: res.ok ? `HTTP ${res.status}` : `HTTP ${res.status}`,
      });
    } catch {
      checks.push({
        id: 'tiles.carto',
        label: 'Map tiles (CARTO basemaps)',
        ok: false,
        severity: 'info',
        latencyMs: nowMs() - t0,
        detail: 'Request failed',
      });
    }
  }

  // FAA d-TPP cycle + results page availability
  {
    const t0 = nowMs();
    try {
      const cycle = await getCurrentDtppCycle();
      const dtwIdent = toFaaIdent('KDTW');
      const url = buildFaaDtppResultsUrl(cycle, dtwIdent);
      const res = await fetchWithTimeout(url, 12000, { method: 'GET' });
      const ok = res.ok;
      let detail = `cycle ${cycle}`;
      if (!ok) detail += ` · HTTP ${res.status}`;
      checks.push({
        id: 'faa.dtpp',
        label: 'FAA d-TPP (chart index)',
        ok,
        severity: 'warning',
        latencyMs: nowMs() - t0,
        detail,
      });
    } catch (e: any) {
      checks.push({
        id: 'faa.dtpp',
        label: 'FAA d-TPP (chart index)',
        ok: false,
        severity: 'warning',
        latencyMs: nowMs() - t0,
        detail: e?.message ?? 'Failed to check',
      });
    }
  }

  const overallOk = checks.every((c) => c.ok || c.severity !== 'critical');

  return NextResponse.json({
    ok: overallOk,
    generatedAtIso: new Date().toISOString(),
    checks,
  });
}
