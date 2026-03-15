import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireRosterManager } from '@/lib/auth/guards';
import { getRosterEntryByCid } from '@/lib/content';
import { sql } from '@/lib/db';
import { tableExists } from '@/lib/schema';
import { getRosterOverride } from '@/lib/auth/rosterOverrides';
import { saveManualRolesAction, saveRosterOverrideAction } from '../actions';
import { ROLE_HELP } from '../roleHelp';

function asText(v: unknown): string {
  return String(v ?? '').trim();
}

function normalizeCode(v: unknown): string {
  return String(v ?? '').trim().toUpperCase();
}

export default async function AdminRosterEditPage({ params, searchParams }: { params: Promise<{ cid: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireRosterManager();
  const p = await params;
  const sp = await searchParams;
  const cid = Number(p.cid);
  if (!Number.isFinite(cid) || cid <= 0) {
    return (
      <PageShell title="Admin • Roster" subtitle="Invalid CID" crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { href: '/admin/roster', label: 'Roster' }, { label: 'Invalid' }]}>
        <div className="ui-card">
          <div className="ui-card__body">Invalid CID.</div>
        </div>
      </PageShell>
    );
  }

  const roster = await getRosterEntryByCid(cid);
  const override = await getRosterOverride(cid);

  // Manual site roles
  let manualRoles: string[] = [];
  if (await tableExists('user_roles').catch(() => false)) {
    const rows = await sql<{ role: string }[]>`SELECT role FROM user_roles WHERE cid = ${cid} ORDER BY role ASC`;
    manualRoles = rows.map((r) => normalizeCode(r.role)).filter(Boolean);
  }

  // VATUSA roles (informational)
  let vatusaRoles: string[] = [];
  if (await tableExists('vatusa_facility_roles').catch(() => false)) {
    const facility = (process.env.NEXT_PUBLIC_FACILITY_CODE ?? 'ZOB').toUpperCase();
    const rows = await sql<{ role: string }[]>`
      SELECT role FROM vatusa_facility_roles WHERE facility = ${facility} AND cid = ${cid} ORDER BY role ASC
    `;
    vatusaRoles = rows.map((r) => normalizeCode(r.role)).filter(Boolean);
  }

  const name = roster
    ? asText((roster as any).pref_name && (roster as any).last_name ? `${(roster as any).pref_name} ${(roster as any).last_name}` : '') ||
      asText((roster as any).first_name && (roster as any).last_name ? `${(roster as any).first_name} ${(roster as any).last_name}` : '') ||
      asText((roster as any).name) ||
      `CID ${cid}`
    : `CID ${cid}`;

  const saved = asText((sp as any).saved);
  const error = asText((sp as any).error);

  return (
    <PageShell
      title="Admin • Roster"
      subtitle="Edit manual roles and internal notes. VATUSA roles are synced daily; manual roles live in user_roles."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { href: '/admin/roster', label: 'Roster' }, { label: name }]}
      right={
        <Link className="ui-button" href="/admin/roster">
          Back
        </Link>
      }
    >
      {saved ? (
        <div className="ui-alert success mb-4">Saved: {saved}</div>
      ) : null}
      {error ? (
        <div className="ui-alert danger mb-4">Error: {error}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="ui-card">
          <div className="ui-card__header">
            <div className="text-sm font-semibold text-white">Controller</div>
            <span className="ui-badge">CID {cid}</span>
          </div>
          <div className="ui-card__body grid gap-2">
            <div className="text-white/90 font-semibold">{name}</div>
            <div className="text-xs text-white/70">Email: {asText((roster as any)?.email) || '—'}</div>
            <div className="text-xs text-white/70">Roster status: {asText((roster as any)?.status) || asText((roster as any)?.type) || '—'}</div>

            <div className="mt-2 text-xs text-white/65">
              <div className="font-semibold text-white/80">VATUSA roles (read-only)</div>
              <div>{vatusaRoles.length ? vatusaRoles.join(', ') : '—'}</div>
            </div>
          </div>
        </div>

        <div className="ui-card">
          <div className="ui-card__header">
            <div className="text-sm font-semibold text-white">Roster overrides</div>
            <span className="ui-badge">Access</span>
          </div>
          <div className="ui-card__body">
            <form action={saveRosterOverrideAction} className="grid gap-3">
              <input type="hidden" name="cid" value={cid} />

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs text-white/70">Member status override</span>
                  <select className="ui-select" name="member_status_override" defaultValue={override?.member_status_override ?? 'auto'}>
                    <option value="auto">Auto (roster-driven)</option>
                    <option value="member">Force member</option>
                    <option value="non_member">Force non-member</option>
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-white/70">Member type override</span>
                  <select className="ui-select" name="member_type_override" defaultValue={override?.member_type_override ?? 'auto'}>
                    <option value="auto">Auto</option>
                    <option value="home">Home</option>
                    <option value="visiting">Visiting</option>
                  </select>
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-xs text-white/70">Internal notes (staff-only)</span>
                <textarea
                  className="ui-textarea"
                  name="notes"
                  rows={5}
                  defaultValue={override?.notes ?? ''}
                  placeholder="Add internal notes about this controller (e.g., LOA status, training notes, temp access reasons, etc.)"
                />
              </label>

              <div className="flex gap-2">
                <button className="ui-button" type="submit">
                  Save overrides
                </button>
                <div className="text-xs text-white/60 self-center">Updated by: {override?.updated_by ?? '—'}</div>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="ui-card mt-4">
        <div className="ui-card__header">
          <div className="text-sm font-semibold text-white">Manual roles</div>
          <span className="ui-badge">user_roles</span>
        </div>
        <div className="ui-card__body">
          <form action={saveManualRolesAction} className="grid gap-4">
            <input type="hidden" name="cid" value={cid} />

            <div className="grid gap-4 md:grid-cols-3">
              <RoleGroup title="Staff" roles={ROLE_HELP.staff} current={manualRoles} />
              <RoleGroup title="Senior staff" roles={ROLE_HELP.senior} current={manualRoles} />
              <RoleGroup title="Admin" roles={ROLE_HELP.admin} current={manualRoles} />
            </div>

            <label className="grid gap-1">
              <span className="text-xs text-white/70">Custom role codes (optional)</span>
              <input
                name="custom_roles"
                className="ui-input"
                placeholder="Example: FACCBT, EMAIL"
                defaultValue={manualRoles.filter((c) => !isInHelp(c)).join(', ')}
              />
            </label>

            <div className="flex flex-wrap gap-2 items-center">
              <button className="ui-button" type="submit">
                Save manual roles
              </button>
              <div className="text-xs text-white/60">
                Current manual roles: <span className="text-white/80 font-semibold">{manualRoles.length ? manualRoles.join(', ') : '—'}</span>
              </div>
            </div>

            <div className="text-xs text-white/60">
              Note: senior staff can edit roles, but cannot grant admin-tier roles (ATM/WM). Logged in as{' '}
              <span className="text-white/80 font-semibold">{actor.fullName ?? `CID ${actor.cid}`}</span>.
            </div>
          </form>
        </div>
      </div>
    </PageShell>
  );
}

function isInHelp(code: string): boolean {
  const all = [...ROLE_HELP.staff, ...ROLE_HELP.senior, ...ROLE_HELP.admin].map((r) => normalizeCode(r.code));
  return all.includes(normalizeCode(code));
}

function RoleGroup({
  title,
  roles,
  current,
}: {
  title: string;
  roles: ReadonlyArray<{ code: string; label: string }>;
  current: string[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold text-white mb-2">{title}</div>
      <div className="grid gap-2">
        {roles.map((r) => {
          const code = normalizeCode(r.code);
          const checked = current.includes(code);
          return (
            <label key={code} className="flex items-center gap-2 text-sm text-white/80">
              <input name="role_code" type="checkbox" value={code} defaultChecked={checked} />
              <span>{r.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
