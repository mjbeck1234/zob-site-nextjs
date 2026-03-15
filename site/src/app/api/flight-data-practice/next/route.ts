import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/getUser';
import { isLoggedIn, isZobMember } from '@/lib/auth/permissions';
import { getNextFDPCaseForUser } from '@/lib/flightDataPractice';

export async function GET() {
  const user = await getUser();
  if (!isLoggedIn(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isZobMember(user)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const next = await getNextFDPCaseForUser(user.cid);
  return NextResponse.json({ case: next });
}
