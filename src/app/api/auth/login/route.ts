import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

// Allow dev vs prod auth hosts via env.
// Example dev: VATSIM_AUTH_BASE_URL=https://auth-dev.vatsim.net
const AUTH_BASE = (process.env.VATSIM_AUTH_BASE_URL ?? 'https://auth.vatsim.net').replace(/\/+$/g, '');
const AUTHORIZE_URL = `${AUTH_BASE}/oauth/authorize`;

export async function GET(request: Request) {
  const clientId = process.env.VATSIM_CLIENT_ID;
  const redirectUri = process.env.VATSIM_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Server misconfigured: missing VATSIM_CLIENT_ID or VATSIM_REDIRECT_URI' },
      { status: 500 }
    );
  }

  const session = await getSession();

  // Optional post-login redirect path.
  // Example: /api/auth/login?next=/staffing
  try {
    const { searchParams } = new URL(request.url);
    const next = String(searchParams.get('next') ?? '').trim();
    // Only allow relative paths within this site.
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      session.returnTo = next;
    } else {
      session.returnTo = undefined;
    }
  } catch {
    session.returnTo = undefined;
  }
  const state = crypto.randomUUID();
  session.oauthState = state;
  await session.save();

  const scope = encodeURIComponent(
    (process.env.VATSIM_SCOPES ?? 'full_name email vatsim_details country').trim()
  );

  const url = `${AUTHORIZE_URL}?response_type=code&client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(url);
}
