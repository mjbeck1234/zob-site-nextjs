import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/getUser';
import { canManageCbts } from '@/lib/auth/permissions';
import { sql } from '@/lib/db';
import { getColumnDataType, tableExists } from '@/lib/schema';

export const dynamic = 'force-dynamic';

async function requireCbtManager() {
  const user = await getUser();
  if (!user) {
    return { user: null as any, res: NextResponse.json({ ok: false, error: 'auth_required' }, { status: 401 }) };
  }
  if (!canManageCbts(user)) {
    return { user: null as any, res: NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 }) };
  }
  return { user, res: null as any };
}

function toSectionId(raw: unknown): number | null {
  const s = String(raw ?? '').trim();
  if (!s || s.toLowerCase() === 'u') return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toSectionKey(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s || s.toLowerCase() === 'u') return 'u';
  const n = Number(s);
  if (Number.isFinite(n) && n > 0) return String(n);
  return 'u';
}

export async function GET() {
  const g = await requireCbtManager();
  if (g.res) return g.res;

  const hasSections = await tableExists('sections');
  const hasCbts = await tableExists('cbts');
  if (!hasSections || !hasCbts) return NextResponse.json({ ok: true, dbOk: false, sections: [], cbts: [] });

  const secRows: any[] = await sql`SELECT id, title, published FROM sections ORDER BY title ASC`;
  const sections = Array.isArray(secRows)
    ? secRows.map((r) => ({ id: r.id, title: String(r.title ?? '').trim(), published: Number(r.published ?? 0) || 0 }))
    : [];

  const cbtRows: any[] = await sql`SELECT id, section_id, title, description, url, published FROM cbts ORDER BY section_id ASC, title ASC`;
  const cbts = Array.isArray(cbtRows)
    ? cbtRows.map((r) => ({
        id: r.id,
        section_id: r.section_id ?? null,
        title: String(r.title ?? '').trim(),
        description: r.description ?? null,
        url: String(r.url ?? '').trim(),
        published: Number(r.published ?? 0) || 0,
      }))
    : [];

  return NextResponse.json({ ok: true, dbOk: true, sections, cbts });
}

export async function POST(req: Request) {
  const g = await requireCbtManager();
  if (g.res) return g.res;

  const hasCbts = await tableExists('cbts');
  if (!hasCbts) {
    return NextResponse.json({ ok: false, error: 'Missing cbts table. Import current tables first.' }, { status: 400 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const title = String(body?.title ?? '').trim();
  const url = String(body?.url ?? '').trim();
  const description = String(body?.description ?? '').trim() || null;
  const published = body?.published === false || body?.published === 0 ? 0 : 1;
  const rawSection = body?.sectionId ?? body?.section_id ?? null;
  const dataType = (await getColumnDataType('cbts', 'section_id')) ?? '';
  const isNumeric = dataType.includes('int') || dataType.includes('decimal') || dataType.includes('numeric');
  const sectionId = isNumeric ? toSectionId(rawSection) : toSectionKey(rawSection);

  if (!title) return NextResponse.json({ ok: false, error: 'title is required' }, { status: 400 });
  if (!url) return NextResponse.json({ ok: false, error: 'url is required' }, { status: 400 });

  await sql`INSERT INTO cbts (section_id, title, description, url, published) VALUES (${sectionId as any}, ${title}, ${description}, ${url}, ${published})`;

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const g = await requireCbtManager();
  if (g.res) return g.res;

  const hasCbts = await tableExists('cbts');
  if (!hasCbts) {
    return NextResponse.json({ ok: false, error: 'Missing cbts table. Import current tables first.' }, { status: 400 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const idRaw = body?.id ?? body?.cbtId ?? null;
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

  if (Object.prototype.hasOwnProperty.call(body ?? {}, 'description')) {
    const description = String(body?.description ?? '').trim() || null;
    sets.push('description = ?');
    params.push(description);
  }

  if (Object.prototype.hasOwnProperty.call(body ?? {}, 'url')) {
    const url = String(body?.url ?? '').trim();
    if (!url) return NextResponse.json({ ok: false, error: 'url is required' }, { status: 400 });
    sets.push('url = ?');
    params.push(url);
  }

  if (Object.prototype.hasOwnProperty.call(body ?? {}, 'published')) {
    const published = body?.published === false || body?.published === 0 ? 0 : 1;
    sets.push('published = ?');
    params.push(published);
  }

  if (Object.prototype.hasOwnProperty.call(body ?? {}, 'sectionId') || Object.prototype.hasOwnProperty.call(body ?? {}, 'section_id')) {
    const rawSection = body?.sectionId ?? body?.section_id ?? null;
    const dataType = (await getColumnDataType('cbts', 'section_id')) ?? '';
    const isNumeric = dataType.includes('int') || dataType.includes('decimal') || dataType.includes('numeric');
    const sectionId = isNumeric ? toSectionId(rawSection) : toSectionKey(rawSection);
    sets.push('section_id = ?');
    params.push(sectionId);
  }

  if (!sets.length) {
    return NextResponse.json({ ok: false, error: 'No fields to update' }, { status: 400 });
  }

  params.push(idNum);
  await sql.unsafe(`UPDATE cbts SET ${sets.join(', ')} WHERE id = ? LIMIT 1`, params);

  return NextResponse.json({ ok: true });
}
