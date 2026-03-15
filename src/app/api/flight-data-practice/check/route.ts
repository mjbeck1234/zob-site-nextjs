import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/getUser';
import { isLoggedIn, isZobMember } from '@/lib/auth/permissions';
import { getFDPCaseById, checkFDPAnswer, markFDPComplete, getNextFDPCaseForUser } from '@/lib/flightDataPractice';

export async function POST(req: Request) {
  const user = await getUser();
  if (!isLoggedIn(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isZobMember(user)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as any;
  const caseId = Number(body?.caseId);
  if (!caseId || Number.isNaN(caseId)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const row = await getFDPCaseById(caseId);
  if (!row || !row.published) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const result = await checkFDPAnswer(row, {
    cruise_alt: body?.cruiseAlt,
    route: body?.route,
    remarks: body?.remarks,
  });

  if (result.ok) {
    await markFDPComplete(user.cid, row.id);
    const next = await getNextFDPCaseForUser(user.cid);
    return NextResponse.json({ ok: true, result, nextCase: next });
  }

  return NextResponse.json({ ok: false, result });
}
