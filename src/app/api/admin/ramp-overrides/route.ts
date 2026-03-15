import { NextResponse } from 'next/server';
import { requireAdmin, requireSiteAdminOnly } from '@/lib/auth/admin';
import { sql } from '@/lib/db';
import { tableExists } from '@/lib/schema';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

function up(v: unknown): string {
  return String(v ?? '').trim().toUpperCase();
}

type OverrideRow = {
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
  created_by_cid: number | null;
  created_at_ms: number;
  updated_at_ms: number;
};

export async function GET(req: Request) {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const icao = up(searchParams.get('icao') ?? 'KDTW');

  const exists = await tableExists('ids_ramp_stand_overrides');
  if (!exists) {
    return NextResponse.json({ ok: true, icao, tableExists: false, overrides: [] });
  }

  const rows = await sql<OverrideRow[]>`
    SELECT id, icao, type, stand_id, stand_ref, lat, lon, name, airline, area_id, active, created_by_cid, created_at_ms, updated_at_ms
    FROM ids_ramp_stand_overrides
    WHERE icao = ${icao}
    ORDER BY id DESC
    LIMIT 2000
  `;

  return NextResponse.json({ ok: true, icao, tableExists: true, overrides: rows ?? [] });
}

export async function POST(req: Request) {
  const user = await requireSiteAdminOnly();
  const exists = await tableExists('ids_ramp_stand_overrides');
  if (!exists) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Missing ids_ramp_stand_overrides table. Run sql/create_table_ids_ramp_stand_overrides.sql first.',
      },
      { status: 400 }
    );
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const icao = up(body?.icao ?? 'KDTW');
  const type = String(body?.type ?? '').trim().toLowerCase();
  const now = Date.now();

  if (type !== 'add' && type !== 'hide') {
    return NextResponse.json({ ok: false, error: 'type must be add|hide' }, { status: 400 });
  }

  if (type === 'hide') {
    const standId = String(body?.standId ?? body?.stand_id ?? '').trim();
    if (!standId) return NextResponse.json({ ok: false, error: 'standId is required for hide' }, { status: 400 });

    await sql`
      INSERT INTO ids_ramp_stand_overrides (icao, type, stand_id, stand_ref, lat, lon, name, airline, area_id, active, created_by_cid, created_at_ms, updated_at_ms)
      VALUES (${icao}, 'hide', ${standId}, NULL, NULL, NULL, NULL, NULL, NULL, 1, ${Number(user?.cid ?? 0) || null}, ${now}, ${now})
      ON DUPLICATE KEY UPDATE active=1, updated_at_ms=${now}
    `;

    return NextResponse.json({ ok: true });
  }

  // add
  const standRef = String(body?.standRef ?? body?.stand_ref ?? '').trim();
  const lat = Number(body?.lat);
  const lon = Number(body?.lon);
  const areaId = String(body?.areaId ?? body?.area_id ?? '').trim() || null;
  const airline = String(body?.airline ?? '').trim() || null;
  const name = String(body?.name ?? '').trim() || null;

  if (!standRef) return NextResponse.json({ ok: false, error: 'standRef is required for add' }, { status: 400 });
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ ok: false, error: 'lat and lon are required for add' }, { status: 400 });
  }

  const standId = String(body?.standId ?? body?.stand_id ?? '').trim() || `manual:${randomUUID()}`;

  await sql`
    INSERT INTO ids_ramp_stand_overrides (icao, type, stand_id, stand_ref, lat, lon, name, airline, area_id, active, created_by_cid, created_at_ms, updated_at_ms)
    VALUES (${icao}, 'add', ${standId}, ${standRef}, ${lat}, ${lon}, ${name}, ${airline}, ${areaId}, 1, ${Number(user?.cid ?? 0) || null}, ${now}, ${now})
    ON DUPLICATE KEY UPDATE stand_ref=${standRef}, lat=${lat}, lon=${lon}, name=${name}, airline=${airline}, area_id=${areaId}, active=1, updated_at_ms=${now}
  `;

  return NextResponse.json({ ok: true, standId });
}

export async function PATCH(req: Request) {
  await requireSiteAdminOnly();
  const exists = await tableExists('ids_ramp_stand_overrides');
  if (!exists) {
    return NextResponse.json({ ok: false, error: 'Missing ids_ramp_stand_overrides table' }, { status: 400 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ ok: false, error: 'id is required' }, { status: 400 });

  const hasActive = body?.active !== undefined;
  const active = body?.active === false ? 0 : 1;

  const lat = Number(body?.lat);
  const lon = Number(body?.lon);
  const hasLatLon = Number.isFinite(lat) && Number.isFinite(lon);

  if (!hasActive && !hasLatLon) {
    return NextResponse.json({ ok: false, error: 'Provide active and/or lat/lon' }, { status: 400 });
  }

  const now = Date.now();

  if (hasActive && hasLatLon) {
    await sql`UPDATE ids_ramp_stand_overrides SET active=${active}, lat=${lat}, lon=${lon}, updated_at_ms=${now} WHERE id=${id} LIMIT 1`;
  } else if (hasActive) {
    await sql`UPDATE ids_ramp_stand_overrides SET active=${active}, updated_at_ms=${now} WHERE id=${id} LIMIT 1`;
  } else {
    await sql`UPDATE ids_ramp_stand_overrides SET lat=${lat}, lon=${lon}, updated_at_ms=${now} WHERE id=${id} LIMIT 1`;
  }

  return NextResponse.json({ ok: true });
}

