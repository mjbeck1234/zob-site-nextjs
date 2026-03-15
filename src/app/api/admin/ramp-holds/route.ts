import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/guards';
import { sql } from '@/lib/db';
import { tableExists } from '@/lib/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function up(v: unknown): string {
  return String(v ?? '').trim().toUpperCase();
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
      z.object({
        cid: z.number().optional(),
      }).passthrough()
    )
    .optional(),
});

async function fetchConnectedPilotCids(): Promise<Set<number>> {
  const statusRes = await fetch('https://status.vatsim.net/status.json', { cache: 'no-store' });
  if (!statusRes.ok) return new Set();

  const statusParsed = StatusSchema.safeParse(await statusRes.json());
  if (!statusParsed.success) return new Set();

  const urls = statusParsed.data.data.v3 ?? statusParsed.data.data.v3_json ?? [];
  const dataUrl = urls[0];
  if (!dataUrl) return new Set();

  const dataRes = await fetch(dataUrl, { cache: 'no-store' });
  if (!dataRes.ok) return new Set();

  const dataParsed = DataSchema.safeParse(await dataRes.json());
  if (!dataParsed.success) return new Set();

  const set = new Set<number>();
  for (const p of dataParsed.data.pilots ?? []) {
    const cid = Number((p as any).cid ?? 0);
    if (cid > 0) set.add(cid);
  }
  return set;
}

type HoldRow = {
  icao: string;
  stand_id: string;
  stand_ref: string | null;
  note: string | null;
  created_by_cid: number | null;
  created_by_mode: string | null;
  created_at_ms: number;
  expires_at_ms: number;
  updated_at_ms: number;
};

export async function GET(req: Request) {
  await requireStaff();
  const { searchParams } = new URL(req.url);
  const icao = up(searchParams.get('icao') ?? 'KDTW');
  const includeConnected = (searchParams.get('includeConnected') ?? '') === '1';
  const activeOnly = (searchParams.get('activeOnly') ?? '1') !== '0';
  const now = Date.now();

  const exists = await tableExists('ids_ramp_holds');
  if (!exists) {
    return NextResponse.json({ ok: true, icao, tableExists: false, holds: [] });
  }

  // Opportunistically delete expired rows to keep the table clean.
  try {
    await sql`DELETE FROM ids_ramp_holds WHERE expires_at_ms <= ${now} AND icao = ${icao}`;
  } catch {
    // ignore
  }

  const rows = await sql<HoldRow[]>`
    SELECT icao, stand_id, stand_ref, note, created_by_cid, created_by_mode, created_at_ms, expires_at_ms, updated_at_ms
    FROM ids_ramp_holds
    WHERE icao = ${icao}
    ${activeOnly ? sql`AND expires_at_ms > ${now}` : sql``}
    ORDER BY expires_at_ms ASC
    LIMIT 2000
  `;

  let connectedSet: Set<number> | null = null;
  if (includeConnected) {
    connectedSet = await fetchConnectedPilotCids();
  }

  const holds = (rows ?? []).map((r) => {
    const cid = r.created_by_cid ? Number(r.created_by_cid) : null;
    return {
      icao: r.icao,
      standId: r.stand_id,
      standRef: r.stand_ref,
      note: r.note,
      createdByCid: cid,
      createdByMode: r.created_by_mode,
      createdAtMs: Number(r.created_at_ms || 0),
      expiresAtMs: Number(r.expires_at_ms || 0),
      updatedAtMs: Number(r.updated_at_ms || 0),
      pilotConnected: includeConnected && cid ? Boolean(connectedSet?.has(cid)) : null,
    };
  });

  return NextResponse.json({ ok: true, icao, tableExists: true, holds, now });
}

export async function POST(req: Request) {
  await requireStaff();

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const action = String(body?.action ?? 'clear').trim().toLowerCase();
  const icao = up(body?.icao ?? 'KDTW');
  const standId = String(body?.standId ?? body?.stand_id ?? '').trim();

  if (action !== 'clear') {
    return NextResponse.json({ ok: false, error: 'action must be clear' }, { status: 400 });
  }
  if (!standId) {
    return NextResponse.json({ ok: false, error: 'standId is required' }, { status: 400 });
  }

  const exists = await tableExists('ids_ramp_holds');
  if (!exists) {
    return NextResponse.json(
      { ok: false, error: 'Missing ids_ramp_holds table. Run sql/create_table_ids_ramp_holds.sql first.' },
      { status: 400 }
    );
  }

  const now = Date.now();
  try {
    await sql`DELETE FROM ids_ramp_holds WHERE icao = ${icao} AND stand_id = ${standId}`;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, icao, standId, clearedAt: now });
}
