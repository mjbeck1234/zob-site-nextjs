'use server';

import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { sql } from '@/lib/db';
import { tableExists } from '@/lib/schema';
import { requireRosterManager, requireRosterCertEditor, requireSoloCertIssuer } from '@/lib/auth/guards';
import { deriveRoles } from '@/lib/auth/permissions';
import { upsertRosterOverride, type MemberStatusOverride, type MemberTypeOverride } from '@/lib/auth/rosterOverrides';
import { issueVatusaSoloCert } from '@/lib/vatusa';
import { ZOB_FACILITIES } from '@/config/zobFacilities';

function toInt(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : 0;
}

function cleanText(v: FormDataEntryValue | null): string {
  return String(v ?? '').replace(/\r\n/g, '\n').trim();
}

function normalizeCode(v: unknown): string {
  return String(v ?? '').trim().toUpperCase();
}

const ALLOWED_MEMBER_STATUS: MemberStatusOverride[] = ['auto', 'member', 'non_member'];
const ALLOWED_MEMBER_TYPE: MemberTypeOverride[] = ['auto', 'home', 'visiting'];

function formatYmdInTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function addMonthsYmd(ymd: string, months: number): string {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  let y = p.y;
  let m = p.m + months;
  while (m > 12) {
    y += 1;
    m -= 12;
  }
  while (m < 1) {
    y -= 1;
    m += 12;
  }
  const dim = daysInMonth(y, m);
  const d = Math.min(p.d, dim);
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function zobFacilityPrefixes(): Set<string> {
  const facilities = (process.env.ZOB_FACILITIES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const list = facilities.length ? facilities : ZOB_FACILITIES;
  return new Set(list.map((s) => String(s).toUpperCase()));
}

// NOTE: This file is a Server Actions module (`'use server'`).
// It must ONLY export async functions. Keep constants/helpers unexported,
// and move any exported constants to a non-`use server` module.

function parseRoleCodes(formData: FormData): string[] {
  const picked = (formData.getAll('role_code') ?? []).map(normalizeCode).filter(Boolean);

  const customRaw = cleanText(formData.get('custom_roles'));
  const custom = customRaw
    ? customRaw
        .split(/[\s,]+/g)
        .map(normalizeCode)
        .filter(Boolean)
    : [];

  // Dedup, preserve order (picked first).
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of [...picked, ...custom]) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

export async function saveRosterOverrideAction(formData: FormData) {
  const actor = await requireRosterManager();

  const cid = toInt(formData.get('cid'));
  if (!cid) redirect('/admin/roster?error=bad_cid');

  const memberStatus = cleanText(formData.get('member_status_override')) as MemberStatusOverride;
  const memberType = cleanText(formData.get('member_type_override')) as MemberTypeOverride;
  const notes = cleanText(formData.get('notes'));

  const ms: MemberStatusOverride = ALLOWED_MEMBER_STATUS.includes(memberStatus) ? memberStatus : 'auto';
  const mt: MemberTypeOverride = ALLOWED_MEMBER_TYPE.includes(memberType) ? memberType : 'auto';

  await upsertRosterOverride({
    cid,
    memberStatus: ms,
    memberType: mt,
    notes: notes ? notes : null,
    updatedByCid: actor.cid,
  });

  redirect(`/admin/roster/${cid}?saved=override`);
}

type EndorseOverride = 'auto' | 'full' | 'none';
type TriOverride = 'auto' | 'yes' | 'no';

const ALLOWED_ENDORSE: EndorseOverride[] = ['auto', 'full', 'none'];
const ALLOWED_TRI: TriOverride[] = ['auto', 'yes', 'no'];

function parseEndorse(v: FormDataEntryValue | null): EndorseOverride {
  const t = cleanText(v).toLowerCase() as EndorseOverride;
  return ALLOWED_ENDORSE.includes(t) ? t : 'auto';
}

function parseTri(v: FormDataEntryValue | null): TriOverride {
  const t = cleanText(v).toLowerCase() as TriOverride;
  return ALLOWED_TRI.includes(t) ? t : 'auto';
}

/**
 * Save roster "Manage Controller" fields.
 * - Staff can only edit endorsement/certifications (S1/S2/S3/C1).
 * - Senior staff/admin can edit additional metadata (preferred name, active, initials, event/training eligibility, comments).
 */
export async function saveRosterManageAction(formData: FormData) {
  const actor = await requireRosterCertEditor();

  const cid = toInt(formData.get('cid'));
  if (!cid) redirect('/admin/roster?error=bad_cid');

  const actorTier = deriveRoles(actor).tier;
  const canFull = actorTier === 'admin' || actorTier === 'senior_staff';

  const hasTable = await tableExists('roster_overrides').catch(() => false);
  if (!hasTable) throw new Error('Missing roster_overrides table. Run sql/create_tables_extra.sql');


  const s1 = parseEndorse(formData.get('s1_override'));
  const s2 = parseEndorse(formData.get('s2_override'));
  const s3 = parseEndorse(formData.get('s3_override'));
  const c1 = parseEndorse(formData.get('c1_override'));

  // Optional fields (full editors only)
  const prefName = canFull ? cleanText(formData.get('pref_name_override')) : '';
  const active = canFull ? parseTri(formData.get('active_override')) : 'auto';
  const ableEvents = canFull ? parseTri(formData.get('able_event_signups_override')) : 'auto';
  const ableTraining = canFull ? parseTri(formData.get('able_training_sessions_override')) : 'auto';
  const initials = canFull ? cleanText(formData.get('operating_initials_override')) : '';
  const comments = canFull ? cleanText(formData.get('notes')) : '';

  await sql`
    INSERT INTO roster_overrides (
      cid,
      s1_override,
      s2_override,
      s3_override,
      c1_override,
      pref_name_override,
      active_override,
      able_event_signups_override,
      able_training_sessions_override,
      operating_initials_override,
      notes,
      updated_by,
      updated_at
    )
    VALUES (
      ${cid},
      ${s1},
      ${s2},
      ${s3},
      ${c1},
      ${canFull ? (prefName || null) : null},
      ${canFull ? active : 'auto'},
      ${canFull ? ableEvents : 'auto'},
      ${canFull ? ableTraining : 'auto'},
      ${canFull ? (initials || null) : null},
      ${canFull ? (comments || null) : null},
      ${actor.cid},
      NOW()
    )
    ON DUPLICATE KEY UPDATE
      s1_override = VALUES(s1_override),
      s2_override = VALUES(s2_override),
      s3_override = VALUES(s3_override),
      c1_override = VALUES(c1_override),
      pref_name_override = CASE WHEN ${canFull} THEN VALUES(pref_name_override) ELSE roster_overrides.pref_name_override END,
      active_override = CASE WHEN ${canFull} THEN VALUES(active_override) ELSE roster_overrides.active_override END,
      able_event_signups_override = CASE WHEN ${canFull} THEN VALUES(able_event_signups_override) ELSE roster_overrides.able_event_signups_override END,
      able_training_sessions_override = CASE WHEN ${canFull} THEN VALUES(able_training_sessions_override) ELSE roster_overrides.able_training_sessions_override END,
      operating_initials_override = CASE WHEN ${canFull} THEN VALUES(operating_initials_override) ELSE roster_overrides.operating_initials_override END,
      notes = CASE WHEN ${canFull} THEN VALUES(notes) ELSE roster_overrides.notes END,
      updated_by = VALUES(updated_by),
      updated_at = NOW()
  `;

  redirect(`/admin/roster?saved=${cid}`);
}

export async function saveManualRolesAction(formData: FormData) {
  const actor = await requireRosterManager();

  const cid = toInt(formData.get('cid'));
  if (!cid) redirect('/admin/roster?error=bad_cid');

  const actorTier = deriveRoles(actor).tier;

  const roleCodes = parseRoleCodes(formData);

  // Senior staff can manage roles, but not grant admin-tier.
  if (actorTier === 'senior_staff') {
    const forbidden = roleCodes.filter((c) => c === 'ATM' || c === 'WM' || c === 'ADMIN');
    if (forbidden.length) {
      redirect(`/admin/roster/${cid}?error=forbidden_role`);
    }
  }

  const hasUserRoles = await tableExists('user_roles').catch(() => false);
  if (!hasUserRoles) {
    throw new Error('Missing user_roles table. Run sql/create_tables_extra.sql');
  }

  await sql.begin(async (tx) => {
    await tx`DELETE FROM user_roles WHERE cid = ${cid}`;
    for (const code of roleCodes) {
      if (!code) continue;
      await tx`
        INSERT INTO user_roles (cid, role, updated_at)
        VALUES (${cid}, ${code}, NOW())
        ON DUPLICATE KEY UPDATE updated_at = NOW()
      `;
    }
  });

  redirect(`/admin/roster/${cid}?saved=roles`);
}

export async function issueSoloCertAction(formData: FormData) {
  await requireSoloCertIssuer();

  const cid = toInt(formData.get('cid'));
  if (!cid) redirect('/admin/roster?error=bad_cid');

  const position = cleanText(formData.get('position')).toUpperCase();
  const expDate = cleanText(formData.get('expDate'));

  if (!position || !position.includes('_') || position.length < 4) {
    redirect(`/admin/roster?error=solo_bad_position`);
  }

  const prefixes = zobFacilityPrefixes();
  const prefix4 = position.slice(0, 4).toUpperCase();
  if (!prefixes.has(prefix4)) {
    redirect(`/admin/roster?error=solo_not_zob`);
  }

  // Enforce expDate: today .. (today + 1 month) in America/New_York.
  const tz = 'America/New_York';
  const today = formatYmdInTz(new Date(), tz);
  const max = addMonthsYmd(today, 1);

  const p = parseYmd(expDate);
  if (!p) redirect(`/admin/roster?error=solo_bad_date`);
  if (expDate < today) redirect(`/admin/roster?error=solo_past_date`);
  if (expDate > max) redirect(`/admin/roster?error=solo_too_far`);

  await issueVatusaSoloCert({ cid, position, expDate });

  // Bust cached solo list + refresh roster page.
  revalidateTag('vatusa-solo', 'max');
  revalidatePath('/admin/roster');

  redirect(`/admin/roster?savedSolo=${cid}`);
}

// (Intentionally no non-async exports from this file.)
