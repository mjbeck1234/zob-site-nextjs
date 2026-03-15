'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { issueSoloCertAction, saveRosterManageAction } from './actions';

type RoleTier = 'non_member' | 'member' | 'staff' | 'senior_staff' | 'admin';

type RosterRow = {
  cid: string;
  first_name?: string;
  last_name?: string;
  pref_name?: string;
  name?: string;
  email?: string;
  rating?: string;
  status?: string;
  type?: string;
  staff?: string;
  ins?: any;
  mentor?: any;
  active?: boolean;
  events?: any;
  training?: any;
  able_training?: any;
  s1?: any;
  s2?: any;
  s3?: any;
  c1?: any;
  [key: string]: any;
};

type OverrideRow = {
  cid: number;
  notes?: string | null;
  pref_name_override?: string | null;
  s1_override?: string | null;
  s2_override?: string | null;
  s3_override?: string | null;
  c1_override?: string | null;
  active_override?: string | null;
  able_event_signups_override?: string | null;
  able_training_sessions_override?: string | null;
  operating_initials_override?: string | null;
  [key: string]: any;
};

function asText(v: any): string {
  return String(v ?? '').trim();
}

function fullName(r: RosterRow): string {
  const pref = asText(r.pref_name);
  const first = asText(r.first_name);
  const last = asText(r.last_name);
  const name = asText(r.name);
  if (pref && last) return `${pref} ${last}`;
  if (first && last) return `${first} ${last}`;
  return name || `CID ${r.cid}`;
}

type Endorse = 'full' | 'none';
type EndorseOverride = 'auto' | 'full' | 'none';
type Tri = 'yes' | 'no';
type TriOverride = 'auto' | 'yes' | 'no';

function effectiveEndorse(rowVal: any, ov: any): Endorse {
  const o = asText(ov).toLowerCase();
  if (o === 'full') return 'full';
  if (o === 'none') return 'none';
  return rowVal ? 'full' : 'none';
}

function effectiveTri(rowVal: any, ov: any): Tri {
  const o = asText(ov).toLowerCase();
  if (o === 'yes') return 'yes';
  if (o === 'no') return 'no';
  return rowVal ? 'yes' : 'no';
}

function formatRolePills(roles: string[]): string {
  if (!roles.length) return '—';
  return roles.join(', ');
}

function formatSoloPills(solos: Array<{ position: string; expDate: string | null }>): string {
  if (!solos.length) return '—';
  const positions = solos
    .map((s) => asText(s.position).toUpperCase())
    .filter(Boolean);

  // Keep the roster list compact. Show up to 2 positions, then “+N”.
  const shown = positions.slice(0, 2);
  const more = positions.length - shown.length;
  return more > 0 ? `${shown.join(', ')} +${more}` : shown.join(', ');
}

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

export default function AdminRosterClient({
  facility,
  actorTier,
  canFullEdit,
  rows,
  overridesByCid,
  rolesByCid,
  soloByCid,
  savedCid,
  savedSolo,
  hasCertColumns,
  canIssueSolo,
}: {
  facility: string;
  actorTier: RoleTier;
  canFullEdit: boolean;
  rows: RosterRow[];
  overridesByCid: Record<string, OverrideRow | undefined>;
  rolesByCid: Record<string, string[] | undefined>;
  soloByCid: Record<string, Array<{ position: string; expDate: string | null }> | undefined>;
  savedCid?: string;
  savedSolo?: string;
  hasCertColumns: boolean;
  canIssueSolo: boolean;
}) {
  const [q, setQ] = useState('');
  const [selectedCid, setSelectedCid] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) => {
      const name = fullName(r).toLowerCase();
      const cid = asText(r.cid);
      const email = asText((r as any).email).toLowerCase();
      return name.includes(query) || cid.includes(query) || email.includes(query);
    });
  }, [q, rows]);

  const selectedRow = useMemo(() => (selectedCid ? rows.find((r) => asText(r.cid) === asText(selectedCid)) ?? null : null), [selectedCid, rows]);
  const selectedOverride = useMemo(() => (selectedCid ? overridesByCid[asText(selectedCid)] : undefined), [selectedCid, overridesByCid]);
  const selectedRoles = useMemo(() => (selectedCid ? rolesByCid[asText(selectedCid)] ?? [] : []), [selectedCid, rolesByCid]);

  const canEditOnlyCerts = actorTier === 'staff' && !canFullEdit;

  return (
    <>
      {savedCid ? <div className="ui-alert success mb-4">Saved roster changes for CID {savedCid}.</div> : null}
      {savedSolo ? <div className="ui-alert success mb-4">Issued solo cert for CID {savedSolo}.</div> : null}
      {!hasCertColumns ? (
        <div className="ui-alert danger mb-4">
          Roster management columns are missing. Run <span className="text-white/90 font-semibold">sql/create_tables_extra.sql</span> (it adds the
          roster_overrides columns needed for certifications).
        </div>
      ) : null}

      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="text-sm text-white/65">
          Facility: <span className="text-white/85 font-semibold">{facility}</span>
          <span className="mx-2">•</span>
          Access: <span className="text-white/85 font-semibold">{canFullEdit ? 'Full editor' : 'Certifications only'}</span>
        </div>
        <input
          className="ui-input md:w-[420px]"
          placeholder="Search by name, CID, or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="ui-card mt-4">
        <div className="ui-card__header">
          <div className="text-sm font-semibold text-white">Manage roster</div>
          <span className="ui-badge">{filtered.length} controllers</span>
        </div>
        <div className="ui-card__body">
          <div className="overflow-x-auto">
            <table className="ui-table w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>CID</th>
                  <th>Rating</th>
                  <th>Type</th>
                  <th>Roles</th>
                  <th>Solo</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const cid = asText(r.cid);
                  const roles = rolesByCid[cid] ?? [];
                  const solos = soloByCid[cid] ?? [];
                  return (
                    <tr key={cid}>
                      <td className="font-semibold">{fullName(r)}</td>
                      <td className="text-white/80">{cid}</td>
                      <td className="text-white/80">{asText((r as any).rating) || '—'}</td>
                      <td className="text-white/80">{asText((r as any).type) || asText((r as any).status) || '—'}</td>
                      <td className="text-white/70 text-xs">{formatRolePills(roles)}</td>
                      <td className="text-white/70 text-xs">{formatSoloPills(solos)}</td>
                      <td className="text-right">
                        <button className="ui-btn ui-btn-sm" onClick={() => setSelectedCid(cid)} type="button">
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedRow ? (
        <ManageModal
          row={selectedRow}
          override={selectedOverride}
          roleCodes={selectedRoles}
          soloCerts={soloByCid[asText(selectedRow.cid)] ?? []}
          canFullEdit={canFullEdit}
          canEditOnlyCerts={canEditOnlyCerts}
          canIssueSolo={canIssueSolo}
          onClose={() => setSelectedCid(null)}
        />
      ) : null}
    </>
  );
}

function ManageModal({
  row,
  override,
  roleCodes,
  soloCerts,
  canFullEdit,
  canEditOnlyCerts,
  canIssueSolo,
  onClose,
}: {
  row: RosterRow;
  override?: OverrideRow;
  roleCodes: string[];
  soloCerts: Array<{ position: string; expDate: string | null }>;
  canFullEdit: boolean;
  canEditOnlyCerts: boolean;
  canIssueSolo: boolean;
  onClose: () => void;
}) {
  const cid = asText(row.cid);

  const prefName = asText(override?.pref_name_override) || asText((row as any).pref_name) || asText((row as any).first_name);
  const lastName = asText((row as any).last_name);
  const email = asText((row as any).email);

  const s1 = effectiveEndorse((row as any).s1, override?.s1_override);
  const s2 = effectiveEndorse((row as any).s2, override?.s2_override);
  const s3 = effectiveEndorse((row as any).s3, override?.s3_override);
  const c1 = effectiveEndorse((row as any).c1, override?.c1_override);

  const isMentor = roleCodes.map((r) => r.toUpperCase()).includes('MTR') || !!(row as any).mentor;
  const isInstructor = roleCodes.map((r) => r.toUpperCase()).includes('INS') || !!(row as any).ins;

  const active = effectiveTri((row as any).active, override?.active_override);
  const ableEvents = effectiveTri((row as any).events, override?.able_event_signups_override);
  const ableTraining = effectiveTri((row as any).training ?? (row as any).able_training, override?.able_training_sessions_override);

  const initials = asText(override?.operating_initials_override) || asText((row as any).operating_initials) || '';
  const comments = asText(override?.notes);

  const staffPos = roleCodes.length ? roleCodes.join(', ') : asText((row as any).staff) || '';

  const soloLines = (soloCerts || []).map((s) => {
    const pos = asText(s.position).toUpperCase();
    const exp = asText(s.expDate);
    if (!exp) return pos;
    const d = new Date(exp);
    const when = Number.isFinite(d.getTime()) ? d.toLocaleString() : exp;
    return `${pos} (expires ${when})`;
  });

  return (
    <div className="ui-modal-backdrop" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="ui-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ui-modal__header">
          <div>
            <div className="text-lg font-semibold">Manage Controller</div>
            <div className="text-sm opacity-70">{fullName(row)} ({cid})</div>
          </div>
          <button type="button" className="ui-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="ui-modal__body">
          {canIssueSolo ? <SoloIssueForm cid={cid} defaultPosition={soloCerts?.[0]?.position ? asText(soloCerts[0].position) : ''} /> : null}
          {soloLines.length ? (
            <div className="ui-alert mb-4">
              <div className="font-semibold">Active ZOB solo certs</div>
              <div className="mt-1 text-white/80 text-sm">{soloLines.join(' • ')}</div>
            </div>
          ) : null}
          <form action={saveRosterManageAction} className="grid gap-4">
            <input type="hidden" name="cid" value={cid} />

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm font-semibold">Preferred Name</span>
                <input
                  name="pref_name_override"
                  className="ui-input"
                  defaultValue={prefName}
                  disabled={canEditOnlyCerts}
                  placeholder="Preferred name"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-semibold">Email</span>
                <input className="ui-input" defaultValue={email} disabled placeholder="Email" />
              </label>
            </div>

            <hr className="border-white/10" />

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm font-semibold">S1 Certification</span>
                <select name="s1_override" className="ui-input" defaultValue={s1}>
                  {canFullEdit ? <option value="auto">Auto</option> : null}
                  <option value="full">Full Endorsement</option>
                  <option value="none">No Endorsement</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-semibold">S2 Certification</span>
                <select name="s2_override" className="ui-input" defaultValue={s2}>
                  {canFullEdit ? <option value="auto">Auto</option> : null}
                  <option value="full">Full Endorsement</option>
                  <option value="none">No Endorsement</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-semibold">S3 Certification</span>
                <select name="s3_override" className="ui-input" defaultValue={s3}>
                  {canFullEdit ? <option value="auto">Auto</option> : null}
                  <option value="full">Full Endorsement</option>
                  <option value="none">No Endorsement</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-semibold">C1 Certification</span>
                <select name="c1_override" className="ui-input" defaultValue={c1}>
                  {canFullEdit ? <option value="auto">Auto</option> : null}
                  <option value="full">Full Endorsement</option>
                  <option value="none">No Endorsement</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <label className="grid gap-1">
                <span className="text-sm font-semibold">Is Mentor</span>
                <input className="ui-input" value={isMentor ? 'Yes' : 'No'} disabled readOnly />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-semibold">Mentor Title</span>
                <input className="ui-input" value={isMentor ? 'Mentor' : ''} disabled readOnly />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-semibold">Is Instructor</span>
                <input className="ui-input" value={isInstructor ? 'Yes' : 'No'} disabled readOnly />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-semibold">Staff Position</span>
                <input className="ui-input" value={staffPos} disabled readOnly />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm font-semibold">Is Active</span>
                <select name="active_override" className="ui-input" defaultValue={active as any} disabled={canEditOnlyCerts}>
                  {canFullEdit ? <option value="auto">Auto</option> : null}
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-semibold">Operating Initials</span>
                <input
                  name="operating_initials_override"
                  className="ui-input"
                  defaultValue={initials}
                  disabled={canEditOnlyCerts}
                  placeholder="e.g., MB"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-semibold">Able Event Signups</span>
                <select
                  name="able_event_signups_override"
                  className="ui-input"
                  defaultValue={ableEvents as any}
                  disabled={canEditOnlyCerts}
                >
                  {canFullEdit ? <option value="auto">Auto</option> : null}
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-semibold">Able Training Sessions</span>
                <select
                  name="able_training_sessions_override"
                  className="ui-input"
                  defaultValue={ableTraining as any}
                  disabled={canEditOnlyCerts}
                >
                  {canFullEdit ? <option value="auto">Auto</option> : null}
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
            </div>

            <label className="grid gap-1">
              <span className="text-sm font-semibold">Staff Comments</span>
              <textarea
                name="notes"
                className="ui-textarea"
                rows={5}
                defaultValue={comments}
                disabled={canEditOnlyCerts}
                placeholder="Internal staff-only comments"
              />
            </label>

            <div className="flex flex-wrap gap-2 items-center justify-between">
              <button type="submit" className="ui-button">
                Save
              </button>

              <div className="flex gap-2 items-center">
                {canFullEdit ? (
                  <Link className="ui-link text-sm" href={`/admin/roster/${cid}`}>
                    Advanced role overrides
                  </Link>
                ) : null}
                <button type="button" className="ui-btn" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>

            {/* Cosmetic spacer to mimic old modal layout */}
            {lastName ? <input type="hidden" value={lastName} readOnly /> : null}
          </form>
        </div>
      </div>
    </div>
  );
}

function SoloIssueForm({
  cid,
  defaultPosition,
}: {
  cid: string;
  defaultPosition?: string;
}) {
  const tz = 'America/New_York';
  const today = formatYmdInTz(new Date(), tz);
  const max = addMonthsYmd(today, 1);

  return (
    <div className="ui-card mb-4">
      <div className="ui-card__header">
        <div className="text-sm font-semibold text-white">Issue Solo Cert</div>
      </div>
      <div className="ui-card__body">
        <form action={issueSoloCertAction} className="grid gap-3 md:grid-cols-3 items-end">
          <input type="hidden" name="cid" value={cid} />

          <label className="grid gap-1">
            <span className="text-sm font-semibold">Position</span>
            <input
              name="position"
              className="ui-input"
              placeholder="CLE_GND"
              defaultValue={(defaultPosition || '').toUpperCase()}
              required
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold">Expiration Date</span>
            <input
              type="date"
              name="expDate"
              className="ui-input"
              min={today}
              max={max}
              defaultValue={max}
              required
            />
          </label>

          <button type="submit" className="ui-button">
            Issue
          </button>
        </form>
        <div className="text-xs text-white/60 mt-2">Max expiration is 1 month from today.</div>
      </div>
    </div>
  );
}
