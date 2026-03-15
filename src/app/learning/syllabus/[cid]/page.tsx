import Link from 'next/link';
import { Fragment } from 'react';

import PageShell from '@/components/PageShell';
import PermissionNotice from '@/components/PermissionNotice';

import { getUser } from '@/lib/auth/getUser';
import { canEditSyllabus, deriveRoles } from '@/lib/auth/permissions';
import { getRoster } from '@/lib/content';
import { rosterDisplayName } from '@/lib/names';

import { getSyllabusDoc, syllabusEnabled, SYLLABUS_TEMPLATES } from '@/lib/syllabus';
import { getStoredSyllabusTree, storedSyllabusEnabled, listStoredSyllabi } from '@/lib/syllabusStore';
import { clearStoredProgressAction, setStoredProgressAction } from '../progressActions';
import { saveSyllabusAction } from '../actions';

function displayRosterNameWithCid(r: any): string {
  const name = rosterDisplayName(r);
  const cid = r?.cid ?? r?.controller_cid ?? r?.id;
  return cid ? `${name} (#${cid})` : name;
}

const PROGRESS = [
  {
    v: 0,
    label: 'IC',
    title: 'Introduced / Covered — taught or demonstrated at least once.',
    cls: 'bg-sky-500/20 text-sky-100 border-sky-500/30',
  },
  {
    v: 1,
    label: 'BKA',
    title: 'Basic — can do it with help (prompts, reminders, slower pace).',
    cls: 'bg-red-500/20 text-red-100 border-red-500/30',
  },
  {
    v: 2,
    label: 'IKA',
    title: 'Intermediate — mostly independent; occasional corrections needed.',
    cls: 'bg-amber-500/20 text-amber-100 border-amber-500/30',
  },
  {
    v: 3,
    label: 'EKA',
    title: 'Expert — consistently proficient, including under higher workload.',
    cls: 'bg-emerald-500/20 text-emerald-100 border-emerald-500/30',
  },
] as const;

function formatUpdatedAt(s: string | null): string {
  if (!s) return '';
  try {
    return new Date(s).toLocaleString();
  } catch {
    return String(s);
  }
}

function splitLines(s: string): string[] {
  const t = String(s ?? '').replace(/\r/g, '');
  return t
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

function StoredSyllabusTable({
  studentCid,
  tree,
  editable,
}: {
  studentCid: number;
  tree: Awaited<ReturnType<typeof getStoredSyllabusTree>>;
  editable: boolean;
}) {
  if (!tree) return null;

  const cols = editable ? 2 + PROGRESS.length + 1 : 2 + PROGRESS.length;

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/10">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 bg-white/5 p-3">
        <div className="text-xs text-white/60">{editable ? 'Mentor progress levels' : 'Progress levels'}</div>

        <details className="group max-w-2xl">
          <summary className="cursor-pointer select-none text-xs font-semibold text-sky-200 hover:text-sky-100">
            What do IC / BKA / IKA / EKA mean?
          </summary>

          <div className="mt-2 space-y-2 text-xs text-white/70">
            <div>
              <span className="font-semibold text-white/90">IC</span> — Introduced / Covered: you’ve taught or
              demonstrated the concept at least once.
            </div>
            <div>
              <span className="font-semibold text-white/90">BKA</span> — Basic Knowledge/Ability: the student can do it
              with help (prompts, reminders, slower pace).
            </div>
            <div>
              <span className="font-semibold text-white/90">IKA</span> — Intermediate Knowledge/Ability: the student can
              do it mostly independently in normal conditions, with occasional corrections.
            </div>
            <div>
              <span className="font-semibold text-white/90">EKA</span> — Expert Knowledge/Ability: the student is
              consistently proficient, even under higher workload, and can self-correct.
            </div>

            <div className="pt-1 text-white/60">
              Suggested: mark <span className="font-semibold text-white/80">IC</span> when first introduced, move to{' '}
              <span className="font-semibold text-white/80">BKA/IKA</span> as performance becomes consistent, and reserve{' '}
              <span className="font-semibold text-white/80">EKA</span> for “they’ve got it cold.” Use{' '}
              <span className="font-semibold text-white/80">Clear (×)</span> to unset a row.
            </div>
          </div>
        </details>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-white/60">
            <th className="p-3">Item</th>
            <th className="p-3">Fields</th>
            {PROGRESS.map((p) => (
              <th key={p.v} className="p-3 text-center" title={p.title}>
                {p.label}
              </th>
            ))}
            {editable ? (
              <th className="p-3 text-center" title="Unset this row (no progress level selected).">
                Clear
              </th>
            ) : null}
          </tr>
        </thead>

        <tbody>
          {tree.sections.map((sec) => (
            <Fragment key={`sec-${tree.syllabus.id}-${sec.id}`}>
              <tr className="bg-white/5">
                <td colSpan={cols} className="p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/70">{sec.name}</div>
                </td>
              </tr>

              {sec.rows.length ? (
                sec.rows.map((row) => {
                  const entry = row.entry;
                  const selected = entry ? Number(entry.progress) : null;

                  const setFormId = `set-${tree.syllabus.id}-${row.id}`;
                  const clrFormId = `clr-${tree.syllabus.id}-${row.id}`;

                  const tooltip = entry
                    ? `Last set ${formatUpdatedAt(entry.updatedAt)}${entry.observerName ? ` by ${entry.observerName}` : entry.observerCid ? ` by CID ${entry.observerCid}` : ''}`
                    : 'Not set yet';

                  return (
                    <tr key={`row-${tree.syllabus.id}-${row.id}`} className="border-t border-white/10">
                      <td className="p-3 align-top">
                        <div className="text-sm font-semibold text-white/90">{row.content}</div>
                      </td>

                      <td className="p-3 align-top text-xs text-white/70">
                        {splitLines(row.fields).map((f) => (
                          <div key={f}>• {f}</div>
                        ))}
                      </td>

                      {editable ? (
                        <form id={setFormId} action={setStoredProgressAction} className="hidden">
                          <input type="hidden" name="studentCid" value={String(studentCid)} />
                          <input type="hidden" name="contentId" value={String(row.id)} />
                        </form>
                      ) : null}

                      {PROGRESS.map((p) => {
                        const isSelected = selected === p.v;
                        const cls = isSelected
                          ? `rounded-xl border ${p.cls}`
                          : 'rounded-xl border border-white/10 bg-white/5 text-white/40 hover:bg-white/10';

                        return (
                          <td
                            key={p.v}
                            className="p-2 text-center align-middle"
                            title={`${p.label}: ${p.title}${tooltip ? ` • ${tooltip}` : ''}`}
                          >
                            {editable ? (
                              <button
                                type="submit"
                                form={setFormId}
                                name="progress"
                                value={String(p.v)}
                                className={`w-full py-2 text-xs font-semibold transition ${cls}`}
                              >
                                {isSelected ? p.label : ''}
                              </button>
                            ) : (
                              <div className={`w-full py-2 text-xs font-semibold ${cls.replace('hover:bg-white/10', '')}`}>
                                {isSelected ? p.label : ''}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {editable ? (
                        <td className="p-2 text-center align-middle">
                          {entry ? (
                            <>
                              <form id={clrFormId} action={clearStoredProgressAction} className="hidden">
                                <input type="hidden" name="studentCid" value={String(studentCid)} />
                                <input type="hidden" name="contentId" value={String(row.id)} />
                              </form>
                              <button
                                type="submit"
                                form={clrFormId}
                                className="w-full py-2 rounded-xl border border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                                title="Clear this row"
                              >
                                ×
                              </button>
                            </>
                          ) : (
                            <div className="w-full py-2 rounded-xl border border-white/10 bg-white/5 text-white/20">—</div>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              ) : (
                <tr className="border-t border-white/10">
                  <td colSpan={cols} className="p-3 text-xs text-white/50">
                    No items.
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function SyllabusDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ cid: string }>;
  searchParams: Promise<{ saved?: string } & Record<string, string>>;
}) {
  const p = await params;
  const sp = await searchParams;
  const user = await getUser();
  const studentCid = Number(p.cid ?? 0);

  if (!user) {
    return (
      <PageShell
        title="Syllabus"
        subtitle="Mentor-fillable training syllabus / progress checklist."
        crumbs={[{ href: '/', label: 'Home' }, { href: '/learning', label: 'Learning' }, { href: '/learning/syllabus', label: 'Syllabus' }, { label: String(studentCid || '') }]}
      >
        <div className="ui-card">
          <div className="ui-card__body">
            <PermissionNotice kind="login" />
          </div>
        </div>
      </PageShell>
    );
  }

  const isSelf = user.cid === studentCid;
  const canEdit = canEditSyllabus(user);
  const roles = deriveRoles(user);
  const isMember = roles.tier !== 'non_member';

  if (!isMember) {
    return (
      <PageShell
        title="Syllabus"
        subtitle="Roster access required"
        crumbs={[{ href: '/', label: 'Home' }, { href: '/learning', label: 'Learning' }, { href: '/learning/syllabus', label: 'Syllabus' }, { label: String(studentCid) }]}
      >
        <div className="ui-card">
          <div className="ui-card__body">
            <PermissionNotice kind="member" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (!studentCid) {
    return (
      <PageShell
        title="Syllabus"
        subtitle="Invalid student CID."
        crumbs={[{ href: '/', label: 'Home' }, { href: '/learning', label: 'Learning' }, { href: '/learning/syllabus', label: 'Syllabus' }, { label: 'Invalid' }]}
      >
        <div className="ui-card">
          <div className="ui-card__body">
            <div className="text-sm text-white/70">Missing or invalid CID.</div>
            <div className="mt-3">
              <Link href="/learning/syllabus" className="ui-btn">
                Back
              </Link>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!canEdit && !isSelf) {
    return (
      <PageShell
        title="Syllabus"
        subtitle="You don't have access to this syllabus."
        crumbs={[{ href: '/', label: 'Home' }, { href: '/learning', label: 'Learning' }, { href: '/learning/syllabus', label: 'Syllabus' }, { label: String(studentCid) }]}
        right={
          <div className="flex items-center gap-2">
            <Link href={`/learning/syllabus/${user.cid}`} className="ui-btn">
              My Syllabus
            </Link>
          </div>
        }
      >
        <div className="ui-card">
          <div className="ui-card__body">
            <PermissionNotice kind="staff" />
            <div className="mt-3 text-sm text-white/70">Only mentors, instructors, and training staff can open another controller's syllabus.</div>
          </div>
        </div>
      </PageShell>
    );
  }

  const rosterRows = (await getRoster().catch(() => [])) as any[];
  const rosterByCid = new Map<string, string>(
    (Array.isArray(rosterRows) ? rosterRows : []).map((r) => [String(r.cid ?? r.controller_cid ?? r.id ?? ''), displayRosterNameWithCid(r)])
  );
  const studentName = rosterByCid.get(String(studentCid)) ?? `CID ${studentCid}`;

  const existingOk = await storedSyllabusEnabled();

  if (existingOk) {
    const syllabi = await listStoredSyllabi({ includeAdmin: canEdit });
    const trees = await Promise.all(syllabi.map((s) => getStoredSyllabusTree(s.id, studentCid)));

    return (
      <PageShell
        title="Syllabus"
        subtitle={studentName}
        crumbs={[{ href: '/', label: 'Home' }, { href: '/learning', label: 'Learning' }, { href: '/learning/syllabus', label: 'Syllabus' }, { label: String(studentCid) }]}
        right={
          <div className="flex items-center gap-2">
            <Link href="/learning/syllabus" className="ui-btn">
              Back
            </Link>
            {isSelf ? (
              <Link href="/profile" className="ui-btn">
                Profile
              </Link>
            ) : null}
          </div>
        }
      >
        <div className="ui-card">
          <div className="ui-card__header">
            <div>
              <div className="text-sm font-semibold">Syllabus</div>
</div>
            <div className="text-xs text-white/60 text-right">{canEdit ? 'Click IC/BKA/IKA/EKA to update.' : 'Read-only view.'}</div>
          </div>
          <div className="ui-card__body">
            {!trees.length ? (
              <div className="text-sm text-white/70">No syllabi found.</div>
            ) : (
              <div className="space-y-3">
                {trees.map((tree, idx) => {
                  if (!tree) return null;
                  return (
                    <details key={`syll-${tree.syllabus.id}-${idx}`} className="rounded-2xl border border-white/10 bg-white/5">
                      <summary className="cursor-pointer select-none p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">{tree.syllabus.name}</div>
                            <div className="mt-0.5 text-xs text-white/60">Rating: {tree.syllabus.rating}</div>
                          </div>
                          <div className="text-xs text-white/50">Expand</div>
                        </div>
                      </summary>
                      <div className="px-4 pb-4">
                        <StoredSyllabusTable studentCid={studentCid} tree={tree} editable={canEdit} />
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </PageShell>
    );
  }

  // Fallback: new checklist template (v70) if current tables are not present.
  const enabled = await syllabusEnabled();
  const { doc, meta } = await getSyllabusDoc(studentCid);

  const updatedByName = meta?.updated_by ? rosterByCid.get(String(meta.updated_by)) ?? `CID ${meta.updated_by}` : null;
  const updatedAt = meta?.updated_at ? new Date(String(meta.updated_at)).toLocaleString() : null;

  const readOnly = !canEdit;

  return (
    <PageShell
      title="Syllabus"
      subtitle={studentName}
      crumbs={[{ href: '/', label: 'Home' }, { href: '/learning', label: 'Learning' }, { href: '/learning/syllabus', label: 'Syllabus' }, { label: String(studentCid) }]}
      right={
        <div className="flex items-center gap-2">
          <Link href="/learning/syllabus" className="ui-btn">
            Back
          </Link>
          {isSelf ? (
            <Link href="/profile" className="ui-btn">
              Profile
            </Link>
          ) : null}
        </div>
      }
    >
      {!enabled ? (
        <div className="mb-4 ui-card">
          <div className="ui-card__body">
            <div className="text-sm text-white/80">
              The <code className="text-white/80">training_syllabus</code> table is not present in your DB.
            </div>
            <div className="mt-2 text-xs text-white/60">
              Run <code className="text-white/80">sql/create_tables_training_syllabus.sql</code> to enable saving.
            </div>
          </div>
        </div>
      ) : null}

      {sp.saved === '1' ? (
        <div className="mb-4 ui-card">
          <div className="ui-card__body">
            <div className="text-sm text-white/80">Saved.</div>
          </div>
        </div>
      ) : null}

      <div className="ui-card">
        <div className="ui-card__header">
          <div>
            <div className="text-sm font-semibold">Checklist</div>
            <div className="text-xs text-white/60">Mark items complete and keep notes in one place.</div>
          </div>
          <div className="text-xs text-white/60 text-right">
            {updatedAt ? (
              <div>
                Last updated {updatedAt}
                {updatedByName ? ` by ${updatedByName}` : ''}
              </div>
            ) : (
              <div>No updates yet</div>
            )}
            {readOnly ? <div className="mt-1">Read-only view</div> : null}
          </div>
        </div>

        <div className="ui-card__body">
          <form action={saveSyllabusAction}>
            <input type="hidden" name="studentCid" value={String(studentCid)} />

            <div className="space-y-6">
              {SYLLABUS_TEMPLATES.map((track) => (
                <div key={track.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold text-white">{track.title}</div>
                  <div className="mt-3 space-y-4">
                    {track.sections.map((section) => (
                      <div key={section.id}>
                        <div className="text-xs font-semibold uppercase tracking-wide text-white/60">{section.title}</div>
                        <div className="mt-2 space-y-2">
                          {section.items.map((item) => {
                            const st = doc.statuses[item.id] ?? { done: false, doneAt: null, notes: '' };
                            const doneLabel = st.doneAt ? `Completed ${new Date(st.doneAt).toLocaleDateString()}` : st.done ? 'Completed' : '';
                            return (
                              <div key={item.id} className="rounded-xl border border-white/10 bg-black/10 p-3">
                                <input type="hidden" name={`done_${item.id}`} value="0" />
                                <label className="flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    name={`done_${item.id}`}
                                    value="1"
                                    defaultChecked={Boolean(st.done)}
                                    disabled={readOnly || !enabled}
                                    className="mt-1"
                                  />
                                  <div className="flex-1">
                                    <div className="text-sm text-white/90 font-semibold">{item.title}</div>
                                    {item.description ? <div className="mt-0.5 text-xs text-white/60">{item.description}</div> : null}
                                    {doneLabel ? <div className="mt-1 text-xs text-white/50">{doneLabel}</div> : null}
                                  </div>
                                </label>

                                <div className="mt-2">
                                  <label className="grid gap-1">
                                    <span className="text-xs text-white/60">Notes</span>
                                    <textarea
                                      name={`notes_${item.id}`}
                                      className="ui-input min-h-[70px]"
                                      defaultValue={st.notes ?? ''}
                                      disabled={readOnly || !enabled}
                                      placeholder="What was covered? Any follow-ups for next time?"
                                    />
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold text-white">General notes</div>
                <div className="mt-1 text-xs text-white/60">Student-visible notes (keep private notes in training tickets).</div>
                <textarea
                  name="generalNotes"
                  className="ui-input mt-3 min-h-[140px]"
                  defaultValue={doc.generalNotes ?? ''}
                  disabled={readOnly || !enabled}
                  placeholder="Overall progress, strengths, focus areas, and next steps..."
                />
              </div>
            </div>

            {!readOnly && enabled ? (
              <div className="mt-6 flex items-center gap-3">
                <button className="ui-btn ui-btn--primary" type="submit">
                  Save
                </button>
                <div className="text-xs text-white/60">Saved changes will appear immediately.</div>
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </PageShell>
  );
}
