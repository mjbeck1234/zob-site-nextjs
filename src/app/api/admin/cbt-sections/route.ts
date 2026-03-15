import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/getUser';
import { canManageCbts } from '@/lib/auth/permissions';
import { sql } from '@/lib/db';
import { tableExists } from '@/lib/schema';

export const dynamic = 'force-dynamic';

async function requireCbtManager() {
  const user = await getUser();
  if (!user) return { user: null as any, res: NextResponse.json({ ok: false, error: 'auth_required' }, { status: 401 }) };
  if (!canManageCbts(user)) return { user: null as any, res: NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 }) };
  return { user, res: null as any };
}

export async function GET() {
  const g = await requireCbtManager();
  if (g.res) return g.res;

  const hasSections = await tableExists('sections');
  if (!hasSections) return NextResponse.json({ ok: true, dbOk: false, sections: [] });

  const rows: any[] = await sql`SELECT id, title, published FROM sections ORDER BY title ASC`;
  const sections = Array.isArray(rows)
    ? rows.map((r) => ({ id: r.id, title: String(r.title ?? '').trim(), published: Number(r.published ?? 0) || 0 }))
    : [];
  return NextResponse.json({ ok: true, dbOk: true, sections });
}

export async function POST(req: Request) {
  const g = await requireCbtManager();
  if (g.res) return g.res;

  const hasSections = await tableExists('sections');
  if (!hasSections) {
    return NextResponse.json({ ok: false, error: 'Missing sections table. Import current tables first.' }, { status: 400 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const title = String(body?.title ?? '').trim();
  const published = body?.published === false || body?.published === 0 ? 0 : 1;

  if (!title) return NextResponse.json({ ok: false, error: 'title is required' }, { status: 400 });

  await sql`INSERT INTO sections (title, published) VALUES (${title}, ${published})`;

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const g = await requireCbtManager();
  if (g.res) return g.res;

  const hasSections = await tableExists('sections');
  if (!hasSections) {
    return NextResponse.json({ ok: false, error: 'Missing sections table. Import current tables first.' }, { status: 400 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const idRaw = body?.id ?? body?.sectionId ?? null;
  const idNum = Number(idRaw);
  if (!Number.isFinite(idNum) || idNum <= 0) {
    return NextResponse.json({ ok: false, error: 'id is required' }, { status: 400 });
  }

  const sets: string[] = [];
  const params: any[] = [];

  if (Object.prototype.hasOwnProperty.call(body ?? {}, 'title')) {
    const title = String(body?.title ?? '').trim();
    if (!title) return NextResponse.json({ ok: false, error: 'title is required' }, { status: 400 });
    sets.push('title = ?');
    params.push(title);
  }

  if (Object.prototype.hasOwnProperty.call(body ?? {}, 'published')) {
    const published = body?.published === false || body?.published === 0 ? 0 : 1;
    sets.push('published = ?');
    params.push(published);
  }

  if (!sets.length) {
    return NextResponse.json({ ok: false, error: 'No fields to update' }, { status: 400 });
  }

  params.push(idNum);
  await sql.unsafe(`UPDATE sections SET ${sets.join(', ')} WHERE id = ? LIMIT 1`, params);

  return NextResponse.json({ ok: true });
}
