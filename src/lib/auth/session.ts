import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

export type SessionUser = {
  cid: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  ratingShort?: string;
  roles: string[];
  /** Derived each request; not required to exist in cookie */
  isZobMember?: boolean;
  /** Derived each request; not required to exist in cookie */
  memberType?: 'prim' | 'vis' | null;
  /** Derived each request; not required to exist in cookie */
  roleTier?: 'non_member' | 'member' | 'staff' | 'senior_staff' | 'admin';
  /** Derived each request; not required to exist in cookie */
  subRoles?: string[];
};

export type SessionData = {
  user?: SessionUser;
  oauthState?: string;
  /** Optional post-login redirect path (set by /api/auth/login?next=...) */
  returnTo?: string;
};

/**
 * iron-session requires a password >= 32 chars.
 * - In production: enforce strictly.
 * - In development: auto-pad / generate a fallback so the app can boot.
 */
function resolveSessionPassword(): string {
  const isProd = process.env.NODE_ENV === 'production';
  const raw = (process.env.SESSION_SECRET ?? '').trim();

  if (!raw) {
    if (isProd) {
      throw new Error('Missing SESSION_SECRET environment variable (must be at least 32 characters).');
    }
    console.warn('[auth] SESSION_SECRET missing; generating an insecure dev secret. Set SESSION_SECRET in .env');
    // 32 bytes -> 64 hex chars
    return randomBytes(32).toString('hex');
  }

  if (raw.length < 32) {
    if (isProd) {
      throw new Error('SESSION_SECRET must be at least 32 characters long.');
    }
    console.warn(
      `[auth] SESSION_SECRET is only ${raw.length} chars; padding to 32 for dev. Please set a 32+ char SESSION_SECRET in .env`
    );
    return raw.padEnd(32, '0');
  }

  return raw;
}

export const sessionOptions: SessionOptions = {
  password: resolveSessionPassword(),
  cookieName: 'zob_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    httpOnly: true,
    path: '/',
  },
};

/**
 * Next.js 16+ `cookies()` is async. Centralize that here so callers don't
 * accidentally pass a Promise (which breaks iron-session at runtime).
 */
export async function getSession() {
  const cookieStore = await cookies();
  // iron-session expects a CookieStore-like interface. Next's cookie store matches at runtime.
  return getIronSession<SessionData>(cookieStore as any, sessionOptions);
}

/**
 * Back-compat helper (older pages import getSessionUser).
 * Returns the session user or null.
 */
export async function getSessionUser() {
  const session = await getSession();
  return session?.user ?? null;
}
