import { NextResponse } from 'next/server';
import { getFacilityCode, syncVatusaFacilityRolesToDb } from '@/lib/vatusa';

export const runtime = 'nodejs';

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

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const facility = getFacilityCode();
  try {
    const { count } = await syncVatusaFacilityRolesToDb(facility);
    return NextResponse.json({ ok: true, facility, count });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, facility, error: String(e?.message ?? e ?? 'sync failed') },
      { status: 500 }
    );
  }
}
