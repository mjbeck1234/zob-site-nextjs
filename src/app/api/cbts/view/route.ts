import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { sql } from '@/lib/db';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const cbtId = Number(body?.cbtId);
  if (!Number.isFinite(cbtId) || cbtId <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_cbtId' }, { status: 400 });
  }

  const cid = Number(user.cid);
  try {
    const exists: any[] = await sql`SELECT 1 FROM cbt_results WHERE controller_cid = ${cid} AND cbt_id = ${cbtId} LIMIT 1`;
    if (!Array.isArray(exists) || exists.length === 0) {
      await sql`INSERT INTO cbt_results (controller_cid, cbt_id) VALUES (${cid}, ${cbtId})`;
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // If the table doesn't exist yet (or schema differs), don't hard-fail the UI.
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 200 });
  }
}
