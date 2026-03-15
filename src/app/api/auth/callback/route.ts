import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { resolveEffectiveRoles } from '@/lib/auth/roles';
import { ensureLimitedRosterEntryOnLogin } from '@/lib/auth/autoProvision';

// Allow dev vs prod auth hosts via env.
// Example dev: VATSIM_AUTH_BASE_URL=https://auth-dev.vatsim.net
const AUTH_BASE = (process.env.VATSIM_AUTH_BASE_URL ?? 'https://auth.vatsim.net').replace(/\/+$/g, '');
const TOKEN_URL = `${AUTH_BASE}/oauth/token`;
const USER_URL = `${AUTH_BASE}/api/user`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const session = await getSession();

  // Capture any requested post-login redirect path, defaulting to home.
  const returnTo = (session.returnTo && session.returnTo.startsWith('/') && !session.returnTo.startsWith('//'))
    ? session.returnTo
    : '/';
  session.returnTo = undefined;

  if (!code || !state || !session.oauthState || state !== session.oauthState) {
    session.oauthState = undefined;
    await session.save();
    return NextResponse.redirect(new URL(`${returnTo}?auth=error`, request.url));
  }

  session.oauthState = undefined;

  const clientId = process.env.VATSIM_CLIENT_ID;
  const clientSecret = process.env.VATSIM_CLIENT_SECRET;
  const redirectUri = process.env.VATSIM_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: 'Server misconfigured: missing VATSIM OAuth env vars' },
      { status: 500 }
    );
  }

  // Exchange code -> access token
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });

  if (!tokenRes.ok) {
    await session.save();
    return NextResponse.redirect(new URL(`${returnTo}?auth=error`, request.url));
  }

  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  const accessToken = tokenJson.access_token;
  if (!accessToken) {
    await session.save();
    return NextResponse.redirect(new URL(`${returnTo}?auth=error`, request.url));
  }

  // Fetch user
  const userRes = await fetch(USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (!userRes.ok) {
    await session.save();
    return NextResponse.redirect(new URL(`${returnTo}?auth=error`, request.url));
  }

  const userJson = (await userRes.json()) as any;

  const cid = Number(userJson?.data?.cid ?? userJson?.cid ?? 0);
  const firstName = String(userJson?.data?.personal?.name_first ?? userJson?.name_first ?? '');
  const lastName = String(userJson?.data?.personal?.name_last ?? userJson?.name_last ?? '');
  const fullName = `${firstName} ${lastName}`.trim();
  const email = userJson?.data?.personal?.email ?? userJson?.email;
  const ratingShort = userJson?.data?.vatsim?.rating?.short ?? userJson?.vatsim?.rating?.short;

  // If they are not a HOME or VISITING roster member, insert a limited roster stub
  // so admins can see that they've logged in. This should never block login.
  await ensureLimitedRosterEntryOnLogin({
    cid: Number.isFinite(cid) ? cid : 0,
    firstName,
    lastName,
    email,
  });

  const roles = await resolveEffectiveRoles({ cid: Number.isFinite(cid) ? cid : undefined, firstName, lastName });

  session.user = {
    cid: Number.isFinite(cid) ? cid : 0,
    firstName,
    lastName,
    fullName,
    email,
    ratingShort,
    roles,
  };

  await session.save();

  // Redirect back to the page that initiated login (if provided).
  return NextResponse.redirect(new URL(`${returnTo}?auth=success`, request.url));
}
