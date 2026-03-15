import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSiteAdminOnly } from '@/lib/auth/admin';
import { sql } from '@/lib/db';
import { tableExists } from '@/lib/schema';

const RowSchema = z.object({
  type: z.enum(['add', 'hide']),
  icao: z.string().optional(),
  standId: z.string().optional(),
  standRef: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  areaId: z.string().optional(),
  airline: z.string().optional(),
  name: z.string().optional(),
  active: z.boolean().optional(),
});

const BodySchema = z.object({
  icao: z.string().optional(),
  rows: z.array(RowSchema).min(1),
});

function normalizeIcao(s: any): string {
  return String(s || '').trim().toUpperCase();
}

export async function POST(req: Request) {
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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }

  const baseIcao = normalizeIcao(parsed.data.icao);
  const now = Date.now();

  const errors: Array<{ row: number; error: string }> = [];
  let processed = 0;

  await sql.begin(async (tx) => {
    for (let i = 0; i < parsed.data.rows.length; i++) {
      const r = parsed.data.rows[i];
      const rowNum = i + 2; // 1-based + header row
      const icao = normalizeIcao(r.icao || baseIcao);
      if (!icao) {
        errors.push({ row: rowNum, error: 'Missing icao' });
        continue;
      }

      if (r.type === 'hide') {
        const standId = String(r.standId || '').trim();
        if (!standId) {
          errors.push({ row: rowNum, error: 'hide requires standId' });
          continue;
        }
        const active = r.active === false ? 0 : 1;
        try {
          await tx`
            INSERT INTO ids_ramp_stand_overrides
              (icao, type, stand_id, stand_ref, lat, lon, name, airline, area_id, active, created_by_cid, created_at_ms, updated_at_ms)
            VALUES
              (${icao}, 'hide', ${standId}, NULL, NULL, NULL, NULL, NULL, NULL, ${active}, NULL, ${now}, ${now})
            ON DUPLICATE KEY UPDATE
              active = VALUES(active),
              updated_at_ms = VALUES(updated_at_ms)
          `;
          processed++;
        } catch (e: any) {
          errors.push({ row: rowNum, error: e?.message ? String(e.message) : 'insert failed' });
        }
        continue;
      }

      // add
      const standRef = String(r.standRef || '').trim();
      const lat = Number(r.lat);
      const lon = Number(r.lon);
      if (!standRef) {
        errors.push({ row: rowNum, error: 'add requires standRef' });
        continue;
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        errors.push({ row: rowNum, error: 'add requires lat/lon' });
        continue;
      }

      const active = r.active === false ? 0 : 1;
      const areaId = r.areaId ? String(r.areaId).trim() : null;
      const airline = r.airline ? String(r.airline).trim() : null;
      const name = r.name ? String(r.name).trim() : null;

      // For CSV imports we treat stand_id as "manual:{standRef}" unless explicitly provided.
      const standId = String(r.standId || `manual:${standRef}`).trim();

      try {
        await tx`
          INSERT INTO ids_ramp_stand_overrides
            (icao, type, stand_id, stand_ref, lat, lon, name, airline, area_id, active, created_by_cid, created_at_ms, updated_at_ms)
          VALUES
            (${icao}, 'add', ${standId}, ${standRef}, ${lat}, ${lon}, ${name}, ${airline}, ${areaId}, ${active}, NULL, ${now}, ${now})
          ON DUPLICATE KEY UPDATE
            stand_ref = VALUES(stand_ref),
            lat = VALUES(lat),
            lon = VALUES(lon),
            name = VALUES(name),
            airline = VALUES(airline),
            area_id = VALUES(area_id),
            active = VALUES(active),
            updated_at_ms = VALUES(updated_at_ms)
        `;
        processed++;
      } catch (e: any) {
        errors.push({ row: rowNum, error: e?.message ? String(e.message) : 'insert failed' });
      }
    }
  });

  return NextResponse.json({
    ok: true,
    processed,
    errors,
    now,
  });
}
