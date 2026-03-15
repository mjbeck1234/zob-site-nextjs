import { sql } from '@/lib/db';
import { tableExists, tableHasColumn } from '@/lib/schema';

export type UserProfileRow = {
  cid: number;
  bio: string | null;
  avatar_url: string | null;
  updated_at: string | null;
};

export async function profilesEnabled(): Promise<boolean> {
  return await tableExists('user_profiles').catch(() => false);
}

export async function profileAvatarSupported(): Promise<boolean> {
  const ok = await profilesEnabled();
  if (!ok) return false;
  return await tableHasColumn('user_profiles', 'avatar_url').catch(() => false);
}

export async function getUserProfile(cid: number): Promise<UserProfileRow | null> {
  const ok = await profilesEnabled();
  if (!ok) return null;
  const hasAvatar = await profileAvatarSupported();
  const rows = hasAvatar
    ? await sql<UserProfileRow[]>`SELECT cid, bio, avatar_url, updated_at FROM user_profiles WHERE cid = ${cid} LIMIT 1`
    : await sql<UserProfileRow[]>`SELECT cid, bio, NULL AS avatar_url, updated_at FROM user_profiles WHERE cid = ${cid} LIMIT 1`;
  return rows?.[0] ?? null;
}

export async function upsertUserProfile(cid: number, bio: string | null, avatar_url: string | null): Promise<void> {
  const ok = await profilesEnabled();
  if (!ok) return;
  const hasAvatar = await profileAvatarSupported();
  if (hasAvatar) {
    await sql`
      INSERT INTO user_profiles (cid, bio, avatar_url, updated_at)
      VALUES (${cid}, ${bio}, ${avatar_url}, NOW())
      ON DUPLICATE KEY UPDATE bio = VALUES(bio), avatar_url = VALUES(avatar_url), updated_at = NOW()
    `;
  } else {
    await sql`
      INSERT INTO user_profiles (cid, bio, updated_at)
      VALUES (${cid}, ${bio}, NOW())
      ON DUPLICATE KEY UPDATE bio = VALUES(bio), updated_at = NOW()
    `;
  }
}
