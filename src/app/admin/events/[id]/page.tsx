import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageShell from '@/components/PageShell';
import ConfirmSubmitButton from '@/components/ConfirmSubmitButton';
import RosterCidPicker from '@/components/RosterCidPicker';
import { requireEventsManager } from '@/lib/auth/guards';
import { getRoster } from '@/lib/content';
import { getEventById, getEventPositions, getEventSignups } from '@/lib/events';
import { updateEventAction, deleteEventAction, addEventPositionAction, deleteEventPositionAction, setEventPositionAssignmentsAction, deleteEventSignupAction, assignFromSignupAction } from '../actions';

function rosterFullName(r: any) {
  const pref = String(r?.pref_name ?? r?.prefName ?? r?.preferred_name ?? r?.preferredName ?? '').trim();
  const first =
    String(
      r?.first_name ??
        r?.firstName ??
        r?.first ??
        r?.firstname ??
        r?.fname ??
        r?.given_name ??
        r?.givenName ??
        ''
    ).trim();
  const last = String(r?.last_name ?? r?.lastName ?? r?.last ?? r?.lastname ?? r?.lname ?? r?.surname ?? '').trim();

  // If a preferred name is provided, some rosters store it as the full name (including last name),
  // while others store it as just the preferred first name. Avoid "Last Last" duplication.
  if (pref) {
    if (last) {
      const prefNorm = pref.toLowerCase();
      const lastNorm = last.toLowerCase();
      if (prefNorm.includes(lastNorm)) return pref;
      return `${pref} ${last}`.trim();
    }
    return pref;
  }

  const full = `${first} ${last}`.trim();
  return full;
}

function rosterRating(r: any) {
  const raw =
    (r as any)?.rating ??
    (r as any)?.ratingShort ??
    (r as any)?.rating_short ??
    (r as any)?.rating_short_code ??
    (r as any)?.vatsim_rating ??
    '';
  const s = String(raw ?? '').trim();
  return s;
}

function shiftsLabel(storedValue: any, shift1Label: string, shift2Label: string) {
  const v = Number(storedValue);
  if (!Number.isFinite(v) || v === 0) return 'Both';
  if (v === 1) return shift1Label;
  if (v === 2) return shift2Label;
  const a = (v & 1) ? shift1Label : '';
  const b = (v & 2) ? shift2Label : '';
  return [a, b].filter(Boolean).join(' + ') || 'Both';
}

function fmtDT(v: string | null) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  // datetime-local wants YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function AdminEventEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireEventsManager();
  const { id } = await params;
  const sp = await searchParams;

  const eventId = Number(id);
  if (!Number.isFinite(eventId)) notFound();

  const event = await getEventById(eventId);
  if (!event) notFound();

  const hasShift2 = Boolean(String(event.shift_2_label ?? '').trim());

  const positions = await getEventPositions(eventId);
  const signups = await getEventSignups(eventId);

  // Used for assignment dropdowns. We keep this defensive because roster schemas vary.
  const rosterRows = await getRoster().catch(() => [] as any[]);
  const rosterOptions = (Array.isArray(rosterRows) ? rosterRows : [])
    // Only allow Home + Visiting controllers for assignments.
    // Stored roster schema uses: prim (home) and vis (visitor). Some installs store blank/NULL for home.
    .filter((r: any) => {
      const t = String((r as any)?.type ?? '').trim().toLowerCase();
      const isHomeOrVis = t === '' || t === 'prim' || t === 'vis';
      if (!isHomeOrVis) return false;
      if ((r as any)?.active === false) return false;
      if ((r as any)?.roster_exempt === true) return false;
      return true;
    })
    .map((r: any) => {
      const cid = Number((r as any).cid ?? (r as any).controller_cid ?? (r as any).id ?? NaN);
      if (!Number.isFinite(cid)) return null;
      const full = rosterFullName(r);
      if (!full) return null;
      const rating = rosterRating(r);
      return { cid: String(cid), fullName: full, rating };
    })
    .filter(Boolean) as Array<{ cid: string; fullName: string; rating?: string }>;

  const groupedSignups = (() => {
    const m = new Map<string, { controller_cid: string; controller_full_name: string; items: any[] }>();
    for (const s of Array.isArray(signups) ? signups : []) {
      const cid = String((s as any).controller_cid ?? '');
      if (!cid) continue;
      const g = m.get(cid) ?? { controller_cid: cid, controller_full_name: String((s as any).controller_full_name ?? ''), items: [] };
      g.items.push(s);
      m.set(cid, g);
    }
    return Array.from(m.values()).sort((a, b) => {
      const an = String(a.controller_full_name || '');
      const bn = String(b.controller_full_name || '');
      return an.localeCompare(bn);
    });
  })();

  const flash =
    (sp.saved === '1' && 'Saved.') ||
    (sp.pos_added === '1' && 'Position added.') ||
    (sp.pos_deleted === '1' && 'Position deleted.') ||
    (sp.pos_exists === '1' && 'That position already exists for this event.') ||
    (sp.max_assigned === '1' && 'That controller is already assigned to the maximum number of shifts allowed for this event.') ||
    (sp.shift2_disabled === '1' && 'Shift 2 is disabled for this event.') ||
    (sp.assigned === '1' && 'Assignments saved.') ||
    (sp.signup_deleted === '1' && 'Signup removed.') ||
    (sp.deleted === '1' && 'Event deleted.') ||
    '';

  return (
    <PageShell
      title="Edit Event"
      subtitle="Update the event details, manage positions, and assign controllers."
      crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Events', href: '/admin/events' }, { label: event.name || `Event #${eventId}` }]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/events" className="ui-btn">Back</Link>
          <form action={deleteEventAction}>
            <input type="hidden" name="id" value={eventId} />
            <ConfirmSubmitButton className="ui-btn ui-btn-danger" type="submit" confirmMessage="Delete this event?">Delete</ConfirmSubmitButton>
          </form>
        </div>
      }
    >
      {flash ? <div className="ui-alert ui-alert-ok">{flash}</div> : null}

      {/* Event form */}
      <div className="ui-card p-6">
        <div className="ui-card-title">Event Details</div>
        <form action={updateEventAction} className="grid gap-4 mt-4">
          <input type="hidden" name="id" value={eventId} />

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <div className="text-xs text-white/60 mb-1">Name</div>
              <input name="name" className="ui-input" defaultValue={event.name ?? ''} />
            </label>
            <label className="block">
              <div className="text-xs text-white/60 mb-1">Host (e.g. ZNY)</div>
              <input name="host" className="ui-input" defaultValue={event.host ?? ''} />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <div className="text-xs text-white/60 mb-1">Start (local)</div>
              <input name="start_at" type="datetime-local" className="ui-input" defaultValue={fmtDT(event.start_at)} />
            </label>
            <label className="block">
              <div className="text-xs text-white/60 mb-1">End (local)</div>
              <input name="end_at" type="datetime-local" className="ui-input" defaultValue={fmtDT(event.end_at)} />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <label className="block">
              <div className="text-xs text-white/60 mb-1">Shift 1 label</div>
              <input name="shift_1_label" className="ui-input" placeholder="Shift 1" defaultValue={event.shift_1_label ?? ''} />
            </label>
            <label className="block">
              <div className="text-xs text-white/60 mb-1">Shift 2 label</div>
              <input name="shift_2_label" className="ui-input" placeholder="(leave blank for single shift)" defaultValue={event.shift_2_label ?? ''} />
            </label>

            <label className="block">
              <div className="text-xs text-white/60 mb-1">Max shifts per controller</div>
              <input name="max_shifts_per_user" type="number" min={1} className="ui-input" defaultValue={(event as any).max_shifts_per_user ?? 1} />
            </label>

            <label className="block">
              <div className="text-xs text-white/60 mb-1">Banner path / URL</div>
              <input name="banner_path" className="ui-input" defaultValue={event.banner_path ?? ''} />
            </label>
          </div>

          <label className="block">
            <div className="text-xs text-white/60 mb-1">Description (Markdown ok)</div>
            <textarea name="description" className="ui-textarea" rows={8} defaultValue={event.description ?? ''} />
          </label>

          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" name="published" defaultChecked={!!event.published} /> Published
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" name="assignments_published" defaultChecked={!!event.assignments_published} /> Assignments Published
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" name="archived" defaultChecked={!!event.archived} /> Archived
            </label>
          </div>

          <div>
            <button className="ui-btn" type="submit">Save Event</button>
          </div>
        </form>
      </div>

      {/* Positions */}
      <div className="ui-card p-6">
        <div className="ui-card-title">Positions</div>
        <p className="mt-1 text-sm text-white/65">
          Add positions, then assign controllers (stored as CIDs). By default events have a single shift; add a Shift 2 label above to enable an additional shift.
        </p>

        <form action={addEventPositionAction} className="mt-4 grid gap-3 md:grid-cols-3">
          <input type="hidden" name="event_id" value={eventId} />
          <label className="block">
            <div className="text-xs text-white/60 mb-1">Position Name</div>
            <input name="position_name" className="ui-input" placeholder="DTW_APP" required />
          </label>
          <label className="block">
            <div className="text-xs text-white/60 mb-1">Shift 1 CID</div>
            <RosterCidPicker name="shift_1" options={rosterOptions} defaultCid="" />
          </label>
          {hasShift2 ? (
            <label className="block">
              <div className="text-xs text-white/60 mb-1">Shift 2 CID</div>
              <RosterCidPicker name="shift_2" options={rosterOptions} defaultCid="" />
            </label>
          ) : (
            <input type="hidden" name="shift_2" value="" />
          )}
          <div className="md:col-span-3">
            <button className="ui-btn" type="submit">Add Position</button>
          </div>
        </form>

        <div className="mt-6 overflow-x-auto">
          <table className="ui-table w-full">
            <thead>
              <tr>
                <th>Position</th>
                <th>{event.shift_1_label || 'Shift 1'} (CID)</th>
                {hasShift2 ? <th>{event.shift_2_label || 'Shift 2'} (CID)</th> : null}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.id}>
                  <td className="font-semibold">{p.position_name}</td>
                  <td>
                    <form action={setEventPositionAssignmentsAction} className="flex gap-2 items-center">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="event_id" value={eventId} />

                      {(() => {
                        const current = p.shift_1 ? String(p.shift_1) : '';
                        const has = current && rosterOptions.some((r) => r.cid === current);
                        return (
                          <RosterCidPicker name="shift_1" options={rosterOptions} defaultCid={current} style={{ width: 420, maxWidth: '100%', minWidth: 320 }} />
                        );
                      })()}
                      <button className="ui-btn ui-btn-sm" type="submit">Save</button>
                    </form>
                  </td>
                  {hasShift2 ? (
                    <td>
                      <form action={setEventPositionAssignmentsAction} className="flex gap-2 items-center">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="event_id" value={eventId} />

                        {(() => {
                          const current = p.shift_2 ? String(p.shift_2) : '';
                          const has = current && rosterOptions.some((r) => r.cid === current);
                          return (
                            <RosterCidPicker name="shift_2" options={rosterOptions} defaultCid={current} style={{ width: 420, maxWidth: '100%', minWidth: 320 }} />
                          );
                        })()}
                        <button className="ui-btn ui-btn-sm" type="submit">Save</button>
                      </form>
                    </td>
                  ) : null}
                  <td>
                    <form action={deleteEventPositionAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="event_id" value={eventId} />
                      <ConfirmSubmitButton className="ui-btn ui-btn-danger ui-btn-sm" type="submit" confirmMessage="Delete this position?">Delete</ConfirmSubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
              {positions.length === 0 ? (
                <tr><td colSpan={hasShift2 ? 4 : 3} className="text-white/60">No positions yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signups */}
      <div className="ui-card p-6">
        <div className="ui-card-title">Signups</div>
        <p className="mt-1 text-sm text-white/65">These are requests from controllers. You can use them to populate assignments.</p>

        <div className="mt-6 overflow-x-auto">
          <table className="ui-table w-full">
            <thead>
              <tr>
                <th>Controller</th>
                <th>CID</th>
                <th>Signups</th>
                <th>Assign to position</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {groupedSignups.map((g) => (
                <tr key={g.controller_cid}>
                  <td className="font-semibold">{g.controller_full_name}</td>
                  <td>{g.controller_cid}</td>

                  <td className="text-white/80">
                    <div className="space-y-1">
                      {g.items.map((s: any) => (
                        <div key={String(s.id)} className="text-xs">
                          <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                            <span className="font-semibold text-white/90">{String(s.position_name ?? '—')}</span>
                            <span className="text-white/60">•</span>
                            <span className="text-white/70">{shiftsLabel((s as any).shifts_available, event.shift_1_label || 'Shift 1', event.shift_2_label || 'Shift 2')}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>

                  <td className="text-white/80">
                    {(() => {
                      const cid = String(g.controller_cid);
                      const alreadyAssigned = positions.some((p) => String(p.shift_1 ?? '') === cid || String(p.shift_2 ?? '') === cid);

                      const anyPicked = g.items.some((s: any) => Number((s as any).event_position_id ?? (s as any).position_id ?? 0) === 0);
                      const pickedIds = Array.from(
                        new Set(
                          g.items
                            .map((s: any) => Number((s as any).event_position_id ?? (s as any).position_id ?? 0))
                            .filter((n: any) => Number.isFinite(n) && n > 0)
                        )
                      );

                      const allowedPositions = anyPicked ? positions : positions.filter((p) => pickedIds.includes(Number(p.id)));

                      // Aggregate shift availability across this controller's signups.
                      let allowS1 = false;
                      let allowS2 = false;
                      let anyShift = false;
                      for (const s of g.items) {
                        const sv = Number((s as any).shifts_available ?? 0);
                        if (!Number.isFinite(sv) || sv === 0) {
                          anyShift = true;
                          break;
                        }
                        if ((sv & 1) === 1) allowS1 = true;
                        if ((sv & 2) === 2) allowS2 = true;
                      }
                      if (anyShift) {
                        allowS1 = true;
                        allowS2 = true;
                      }
                      if (!hasShift2) {
                        // Single-shift events only.
                        allowS1 = true;
                        allowS2 = false;
                      }

                      if (alreadyAssigned) {
                        return <span className="ui-badge">Already assigned</span>;
                      }

                      if (!allowedPositions.length) {
                        return <span className="text-white/60 text-sm">No valid position selected.</span>;
                      }

                      const single = allowedPositions.length === 1;
                      const pos0 = allowedPositions[0];

                      return (
                        <form action={assignFromSignupAction} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="event_id" value={eventId} />
                          <input type="hidden" name="controller_cid" value={cid} />
                          <input type="hidden" name="position_id" value="0" />

                          {single ? (
                            <>
                              <input type="hidden" name="target_position_id" value={String(pos0.id)} />
                              <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/80">
                                {pos0.position_name}
                              </span>
                            </>
                          ) : (
                            <select name="target_position_id" className="ui-input ui-input-sm" defaultValue="" required>
                              <option value="" className="bg-[#070a12]">Select position…</option>
                              {allowedPositions.map((p) => (
                                <option key={String(p.id)} value={String(p.id)} className="bg-[#070a12]">{p.position_name}</option>
                              ))}
                            </select>
                          )}

                          {allowS1 ? (
                            <button name="shift" value="1" className="ui-btn ui-btn-sm" type="submit">
                              Assign {event.shift_1_label || 'Shift 1'}
                            </button>
                          ) : null}
                          {hasShift2 && allowS2 ? (
                            <button name="shift" value="2" className="ui-btn ui-btn-sm" type="submit">
                              Assign {event.shift_2_label || 'Shift 2'}
                            </button>
                          ) : null}
                        </form>
                      );
                    })()}
                  </td>

                  <td>
                    <div className="space-y-2">
                      {g.items.map((s: any) => (
                        <form key={`rm-${String(s.id)}`} action={deleteEventSignupAction}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="event_id" value={eventId} />
                          <ConfirmSubmitButton className="ui-btn ui-btn-danger ui-btn-sm" type="submit" confirmMessage="Remove this signup?">Remove</ConfirmSubmitButton>
                        </form>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {groupedSignups.length === 0 ? (
                <tr><td colSpan={5} className="text-white/60">No signups yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}
