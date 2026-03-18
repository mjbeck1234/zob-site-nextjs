import Link from 'next/link';
import { sql } from '@/lib/db';
import { FACILITY } from '@/lib/config';
import { requireRosterCertEditor } from '@/lib/auth/guards';
import { canIssueSoloCert, deriveRoles } from '@/lib/auth/permissions';
import { getRoster } from '@/lib/content';
import { tableExists } from '@/lib/schema';
import { getActiveZobSoloCertsByCid } from '@/lib/vatusa';
import AdminRosterClient from './AdminRosterClient';

export default async function AdminRosterPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const actor = await requireRosterCertEditor();
  const d = deriveRoles(actor);
  const canFullEdit = d.tier === 'admin' || d.tier === 'senior_staff';
  const canIssueSolo = canIssueSoloCert(actor);

  const rowsAll = await getRoster();
  // Admin roster view should focus on current controller membership (Home + Visiting).
  // The public roster UI keys off roster.type:
  //   prim => home, vis => visiting. Any other type is typically non-member/archived.
  const rows = (rowsAll as any[]).filter((r) => {
    const t = String((r as any)?.type ?? '').trim().toLowerCase();
    if (!t) return true;
    return t === 'prim' || t === 'vis' || t === 'home' || t === 'visitor';
  });

  const hasOverrides = await tableExists('roster_overrides').catch(() => false);
  const overridesRows: any[] = hasOverrides ? await sql<any[]>`SELECT * FROM roster_overrides` : [];
  const overridesByCid: Record<string, any> = {};
  for (const r of overridesRows) {
    overridesByCid[String(r.cid)] = r;
  }

  const rolesByCid: Record<string, string[]> = {};
  const hasVatusaRoles = await tableExists('vatusa_facility_roles').catch(() => false);
  if (hasVatusaRoles) {
    const vrs = await sql<any[]>`SELECT cid, role FROM vatusa_facility_roles WHERE facility = ${FACILITY}`;
    for (const vr of vrs) {
      const key = String(vr.cid);
      rolesByCid[key] ??= [];
      rolesByCid[key].push(String(vr.role));
    }
  }
  const hasUserRoles = await tableExists('user_roles').catch(() => false);
  if (hasUserRoles) {
    const urs = await sql<any[]>`SELECT cid, role FROM user_roles`;
    for (const ur of urs) {
      const key = String(ur.cid);
      rolesByCid[key] ??= [];
      rolesByCid[key].push(String(ur.role));
    }
  }
  // Dedup roles per cid
  for (const [cid, rs] of Object.entries(rolesByCid)) {
    const seen = new Set<string>();
    rolesByCid[cid] = rs.filter((x) => {
      const c = String(x).toUpperCase();
      if (seen.has(c)) return false;
      seen.add(c);
      return true;
    });
  }

  const savedCidRaw = typeof searchParams?.saved === 'string' ? searchParams?.saved : Array.isArray(searchParams?.saved) ? searchParams?.saved[0] : undefined;
  const savedCid = savedCidRaw && /^[0-9]+$/.test(savedCidRaw) ? savedCidRaw : undefined;

  const savedSoloRaw = typeof searchParams?.savedSolo === 'string' ? searchParams?.savedSolo : Array.isArray(searchParams?.savedSolo) ? searchParams?.savedSolo[0] : undefined;
  const savedSolo = savedSoloRaw && /^[0-9]+$/.test(savedSoloRaw) ? savedSoloRaw : undefined;

  const hasCertColumns = hasOverrides;

  const soloByCid = await getActiveZobSoloCertsByCid().catch(() => ({}));

  return (
    <div className="ui-container py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Manage Roster</h1>
          <p className="text-white/60 mt-1">
            {canFullEdit
              ? 'Senior staff/admin can edit certifications and roster metadata. Staff can edit certifications only.'
              : 'Staff: you can update controller certifications (endorsements) here.'}
          </p>
        </div>
        <Link href="/admin" className="ui-btn">
          Back
        </Link>
      </div>

      <div className="mt-6">
        <AdminRosterClient
          facility={FACILITY}
          actorTier={d.tier as any}
          canFullEdit={canFullEdit}
          rows={rows as any}
          overridesByCid={overridesByCid}
          rolesByCid={rolesByCid}
          soloByCid={soloByCid}
          savedCid={savedCid}
          savedSolo={savedSolo}
          hasCertColumns={hasCertColumns}
          canIssueSolo={canIssueSolo}
        />
      </div>
    </div>
  );
}
