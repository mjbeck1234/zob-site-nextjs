import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { buildDevUser, isDevLoginEnabled } from '@/lib/auth/devUser';

export async function GET(req: Request) {
  if (!isDevLoginEnabled()) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const session = await getSession();
  session.user = buildDevUser();
  await session.save();

  const url = new URL('/profile', req.url);
  return NextResponse.redirect(url);
}
