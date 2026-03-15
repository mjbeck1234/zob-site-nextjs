import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { getEventById, getEventPositions, getEventSignups, getEventSignupsForCid } from '@/lib/events';
import { getRosterFullNameByCid, getRosterMapByCid } from '@/lib/roster';
import { getUser } from '@/lib/auth/getUser';
import { canManageEvents } from '@/lib/auth/permissions';
import { signupForEventAction, cancelEventSignupAction } from './actions';
import RichMarkdown from '@/components/RichMarkdown';

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  const eventId = Number(p.id);

  const event = Number.isFinite(eventId) ? await getEventById(eventId) : null;
  if (!event) {
    return (
      <PageShell title="Event not found" crumbs={[{ href: '/', label: 'Home' }, { href: '/events', label: 'Events' }, { label: 'Not found' }]}>
        <div className="ui-card p-6">
          <div className="text-white/70">We couldn't find that event.</div>
          <div className="mt-4">
            <Link className="ui-button" href="/events">Back to events</Link>
          </div>
        </div>
      </PageShell>
    );
  }

  const user = await getUser().catch(() => undefined);

  // Signups (names) should ONLY be visible to Events Coordinator / Assistant Events Coordinator.
  const canSeeSignups = canManageEvents(user);

// Assignments should ONLY show on the public event page if "Assignments published" is enabled.
  const canSeeAssignments = Number(event.assignments_published) === 1;

  // Only home/visiting controllers (and event staff) can sign up for controlling positions.
  const canSignup = Boolean(user && (user.isZobMember || canSeeSignups));

  const [positions, signups] = await Promise.all([
    getEventPositions(eventId),
    // Normal users should still be able to see *their own* signup rows so they know they are signed up.
    // Events staff can see all signups.
    canSeeSignups
      ? getEventSignups(eventId)
      : user?.cid
        ? getEventSignupsForCid(eventId, Number(user.cid))
        : Promise.resolve([] as any[]),
  ]);

  const hasShift2 = Boolean(String(event.shift_2_label ?? '').trim());

  // Build roster map so we can show names instead of CIDs.
  const rosterByCid = await getRosterMapByCid().catch(() => ({} as Record<string, any>));

  // Determine this user's signups.
  const cid = user?.cid ? String(user.cid) : null;
  const mySignups = cid ? signups.filter((s) => String(s.controller_cid) === cid) : [];
  const isSignedUp = mySignups.length > 0;

  const start = event.start_at ? new Date(event.start_at).toLocaleString() : '';
  const end = event.end_at ? new Date(event.end_at).toLocaleString() : '';

  const bannerRaw = event.banner_path ? String(event.banner_path) : null;
  const banner = bannerRaw
    ? (() => {
        if (bannerRaw.startsWith('http://') || bannerRaw.startsWith('https://') || bannerRaw.startsWith('/')) return bannerRaw;
        return `/${bannerRaw.replace(/^\.\/?/, '')}`;
      })()
    : null;

  const anySignups = canSeeSignups ? signups.filter((s: any) => Number(s.position_id ?? 0) === 0) : [];

  const loginHref = `/api/auth/login?next=${encodeURIComponent(`/events/${eventId}`)}`;

  // Group signups by position_name for admin-only display (position-specific only).
  const signupsByPosition = new Map<string, any[]>();
  if (canSeeSignups) {
    for (const s of signups) {
      if (Number(s.position_id ?? 0) === 0) continue;
      const key = String(s.position_name ?? '');
      if (!signupsByPosition.has(key)) signupsByPosition.set(key, []);
      signupsByPosition.get(key)!.push(s);
    }
  }

  const summarizeNames = (names: string[]) => {
    if (!names.length) return '';
    const head = names.slice(0, 3).join(', ');
    const tail = names.length > 3 ? ` +${names.length - 3} more` : '';
    return `${head}${tail}`;
  };

  const classifyPosition = (nameRaw: string): 'center' | 'tracon' | 'cab' | 'other' => {
    const name = String(nameRaw ?? '').toUpperCase();
    if (name.includes('_CTR')) return 'center';
    if (name.includes('_APP') || name.includes('_DEP')) return 'tracon';
    if (
      name.includes('_TWR') ||
      name.includes('_GND') ||
      name.includes('_DEL') ||
      name.includes('_ATIS') ||
      name.includes('_CLD') ||
      name.includes('_RMP')
    ) {
      return 'cab';
    }
    return 'other';
  };

  const groupedPositions: Record<'center' | 'tracon' | 'cab' | 'other', any[]> = {
    center: [],
    tracon: [],
    cab: [],
    other: [],
  };

  for (const pos of positions) {
    const key = classifyPosition(String(pos.position_name ?? ''));
    groupedPositions[key].push(pos);
  }

  const groupMeta: Array<{ key: 'center' | 'tracon' | 'cab' | 'other'; title: string; subtitle: string }> = [
    { key: 'center', title: 'Center', subtitle: 'Enroute / sectors' },
    { key: 'tracon', title: 'TRACON', subtitle: 'Approach / departure' },
    { key: 'cab', title: 'Cab', subtitle: 'Tower / ground / delivery' },
    { key: 'other', title: 'Other', subtitle: 'Support positions' },
  ];

  return (
    <PageShell
      title={event.name ?? `Event #${event.id}`}
      subtitle={start ? `${start}${end ? ` — ${end}` : ''}` : undefined}
      crumbs={[{ href: '/', label: 'Home' }, { href: '/events', label: 'Events' }, { label: event.name ?? `Event #${event.id}` }]}
      right={
        user ? (
          <Link href="/events" className="ui-button">
            Back
          </Link>
        ) : (
          <Link href={loginHref} className="ui-button">
            Login
          </Link>
        )
      }
    >
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <div className="ui-card overflow-hidden">
            <div className="relative aspect-[21/9] bg-black/20 border-b border-white/10 overflow-hidden">
              {banner ? (
                <>
                  {/*
                    Prevent banner "cutoff" by rendering the full image (contain) on top,
                    while using a blurred cover copy underneath to avoid ugly letterboxing.
                  */}
                  <img
                    src={banner}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110 opacity-35"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" aria-hidden="true" />
                  <img
                    src={banner}
                    alt={`${String(event.name ?? 'Event')} banner`}
                    className="relative h-full w-full object-contain"
                    loading="lazy"
                  />
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-xs font-semibold text-white/55">ZOB</div>
                </div>
              )}
            </div>
            <div className="p-6">
              {event.description ? (
                <div className="prose prose-invert max-w-none">
                  <RichMarkdown content={String(event.description)} />
                </div>
              ) : (
                <div className="text-sm text-white/60">No description provided.</div>
              )}
            </div>
          </div>

          {!canSeeAssignments ? (
            <div className="ui-card">
              <div className="ui-card__body">
                <div className="text-sm text-white/70">
                  Assignments are <span className="font-semibold text-white">not published</span> for this event yet.
                </div>
                <div className="mt-1 text-xs text-white/55">Once published, assigned controllers will appear next to each position.</div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24 self-start">
          {canSignup ? (
            <div className="ui-card">
              <div className="ui-card__header">
                <div className="text-sm font-semibold">Signup</div>
                <span className="ui-badge">{positions.length} positions</span>
              </div>
              <div className="ui-card__body">
                {event.published && !event.archived ? null : (
                  <div className="text-sm text-white/60">Signups are closed for this event.</div>
                )}

                {event.published && !event.archived ? (
                  <>
                    {isSignedUp ? (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-sm font-semibold text-white">You're signed up.</div>
                        <div className="mt-1 text-xs text-white/60">Need to change your preference? Cancel and re-submit.</div>
                        <div className="mt-3 space-y-2">
                          {mySignups.map((s: any) => (
                            <form key={String(s.id)} action={cancelEventSignupAction}>
                              <input type="hidden" name="signup_id" value={String(s.id)} />
                              <input type="hidden" name="event_id" value={String(eventId)} />
                              <button className="ui-button danger w-full" type="submit">
                                Cancel: {String(s.position_name ?? 'Signup')}
                              </button>
                            </form>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <form action={signupForEventAction} className="space-y-4">
                        <input type="hidden" name="event_id" value={String(eventId)} />

                        <div>
                          <div className="text-xs text-white/60 mb-2">Pick up to 3 preferred positions, or select Any Position.</div>
                          <div className="text-xs text-white/50 mb-3">
                            Max assigned shifts per controller: {(event as any).max_shifts_per_user ?? 1}
                          </div>

                          {(() => {
                            const renderOptions = () => (
                              <>
                                <option value="">Select…</option>
                                {groupMeta
                                  .filter((g) => g.key !== 'other')
                                  .map((g) =>
                                    groupedPositions[g.key].length ? (
                                      <optgroup key={`og-${g.key}`} label={g.title}>
                                        {groupedPositions[g.key].map((p: any) => (
                                          <option key={`opt-${String(p.id)}`} value={String(p.id)}>
                                            {String(p.position_name)}
                                          </option>
                                        ))}
                                      </optgroup>
                                    ) : null
                                  )}
                                {groupedPositions.other.length ? (
                                  <optgroup label="Other">
                                    {groupedPositions.other.map((p: any) => (
                                      <option key={`opt-o-${String(p.id)}`} value={String(p.id)}>
                                        {String(p.position_name)}
                                      </option>
                                    ))}
                                  </optgroup>
                                ) : null}
                              </>
                            );

                            return (
                              <div className="grid gap-2">
                                <select name="event_position_id_1" className="ui-input">
                                  {renderOptions()}
                                </select>
                                <select name="event_position_id_2" className="ui-input">
                                  {renderOptions()}
                                </select>
                                <select name="event_position_id_3" className="ui-input">
                                  {renderOptions()}
                                </select>

                                <label className="inline-flex items-center gap-2 text-sm text-white/80">
                                  <input type="checkbox" name="any_position" value="1" className="h-4 w-4" /> Any Position
                                </label>
                              </div>
                            );
                          })()}
                        </div>

                        <div>
                          <div className="text-xs text-white/60 mb-2">Which shift can you work?</div>
                          <div className="grid gap-2">
                            <label className="inline-flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/85">
                              <span>{event.shift_1_label || 'Shift 1'}</span>
                              <input type="checkbox" name="shift_1" value="1" className="h-4 w-4" defaultChecked />
                            </label>
                            {hasShift2 ? (
                              <label className="inline-flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/85">
                                <span>{event.shift_2_label || 'Shift 2'}</span>
                                <input type="checkbox" name="shift_2" value="1" className="h-4 w-4" />
                              </label>
                            ) : null}
                          </div>
                        </div>

                        <button className="ui-button w-full" type="submit">Submit signup</button>
                      </form>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="ui-card">
              <div className="ui-card__header">
                <div className="text-sm font-semibold">Pilots</div>
                <span className="ui-badge">Fly along</span>
              </div>
              <div className="ui-card__body">
                <div className="text-sm text-white/70">
                  Controller signups are limited to <span className="font-semibold text-white">ZOB home/visiting controllers</span>.
                  You&apos;re welcome to fly the event as a pilot — just file, spawn, and have fun.
                </div>
                {user ? null : (
                  <div className="mt-2 text-xs text-white/55">Controllers: <Link href={loginHref} className="underline underline-offset-2">login</Link> to sign up.</div>
                )}
                <div className="mt-3 grid gap-2">
                  <Link className="ui-button w-full" href="/pilot/resources">Pilot briefing</Link>
                  <Link className="ui-button secondary w-full" href="/events">Browse events</Link>
                </div>
              </div>
            </div>
	          )}

          {canSeeSignups ? (
            <div className="ui-card">
              <div className="ui-card__header">
                <div className="text-sm font-semibold">Admin: Signup overview</div>
                <span className="ui-badge">{signups.length}</span>
              </div>
              <div className="ui-card__body">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-xs text-white/55">Total</div>
                    <div className="mt-1 text-lg font-semibold text-white">{signups.length}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-xs text-white/55">Any position</div>
                    <div className="mt-1 text-lg font-semibold text-white">{anySignups.length}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-xs text-white/55">Unique</div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {new Set(signups.map((s: any) => String(s.controller_cid ?? ''))).size}
                    </div>
                  </div>
                </div>

                {anySignups.length ? (
                  <div className="mt-4">
                    <div className="text-xs font-semibold text-white/70">Any Position</div>
                    <div className="mt-1 text-xs text-white/60">
                      {summarizeNames(anySignups.map((s: any) => String(s.controller_full_name ?? s.controller_cid ?? '')).filter(Boolean))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-white">Positions</div>
            <div className="text-sm text-white/60">Grouped by facility type to make staffing easier to scan.</div>
          </div>
          <div className="text-xs text-white/55">{positions.length} total</div>
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-12">
          {groupMeta
            .filter((g) => g.key !== 'other')
            .map((g) => {
              const items = groupedPositions[g.key];
              const isCab = g.key === 'cab';

              return (
                <div key={`grp-${g.key}`} className="ui-card lg:col-span-4">
                  <div className="ui-card__header">
                    <div>
                      <div className="text-sm font-semibold">{g.title}</div>
                      <div className="text-xs text-white/55">{g.subtitle}</div>
                    </div>
                    <span className="ui-badge">{items.length}</span>
                  </div>

                  <div className="ui-card__body">
                    {items.length ? (
                      <div className={isCab ? 'grid gap-2 sm:grid-cols-2' : 'divide-y divide-white/10'}>
                        {items.map((pos: any) => {
                          const posName = String(pos.position_name ?? '—');

                          const assigned1Cid = String(pos.shift_1 ?? '').trim();
                          const assigned2Cid = String(pos.shift_2 ?? '').trim();
                          const assigned1 = assigned1Cid ? getRosterFullNameByCid(rosterByCid, assigned1Cid) : '';
                          const assigned2 = assigned2Cid ? getRosterFullNameByCid(rosterByCid, assigned2Cid) : '';

                          // Events team can see signups and also see the assignment planning state (including "Open").
                          // Public viewers should only ever see assigned names if assignments are published.
                          const showAssignmentsForUser = canSeeAssignments || canSeeSignups;

                          const sAll = canSeeSignups ? signupsByPosition.get(posName) ?? [] : [];
                          const signupCount = sAll.length;
                          const signupNames = canSeeSignups
                            ? sAll.map((x: any) => String(x.controller_full_name ?? x.controller_cid ?? '')).filter(Boolean)
                            : [];

                          const s1Text = showAssignmentsForUser ? (assigned1 ? assigned1 : canSeeSignups ? 'Open' : '') : '';
                          const s2Text =
                            showAssignmentsForUser && hasShift2 ? (assigned2 ? assigned2 : canSeeSignups ? 'Open' : '') : '';

                          // For public viewers, we only show the assignment area if there's an assigned name.
                          const showAssignmentsBlock = canSeeSignups
                            ? Boolean(s1Text) || Boolean(s2Text)
                            : canSeeAssignments && (Boolean(assigned1) || Boolean(assigned2));

                          const outerClass = isCab
                            ? 'rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2'
                            : 'py-2';

                          return (
                            <div key={String(pos.id)} className={outerClass}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="font-semibold text-white">{posName}</div>
                                    {canSeeSignups && signupCount > 0 ? (
                                      <span className="text-xs text-white/50">({signupCount})</span>
                                    ) : null}
                                  </div>

                                  {canSeeSignups ? (
                                    <details className="mt-1 text-xs text-white/55 [&_summary::-webkit-details-marker]:hidden">
                                      <summary className="cursor-pointer select-none text-white/55 hover:text-white/70">
                                        {signupCount ? `${signupCount} signup${signupCount === 1 ? '' : 's'}` : 'No signups'}
                                      </summary>
                                      {signupCount ? (
                                        <div
                                          className="mt-1 block max-w-[26rem] truncate whitespace-nowrap text-white/60"
                                          title={signupNames.join(', ')}
                                        >
                                          {summarizeNames(signupNames)}
                                        </div>
                                      ) : null}
                                    </details>
                                  ) : null}
                                </div>

                                {showAssignmentsBlock ? (
                                  <div className="flex shrink-0 items-center gap-2">
                                    {!hasShift2 ? (
                                      s1Text ? (
                                        <span
                                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${
                                            s1Text === 'Open'
                                              ? 'border-white/10 bg-white/[0.03] text-white/80'
                                              : 'border-white/15 bg-white/[0.06] text-white'
                                          }`}
                                          title={event.shift_1_label || 'Shift 1'}
                                        >
                                          <span className="max-w-[12rem] truncate">{s1Text}</span>
                                        </span>
                                      ) : null
                                    ) : (
                                      <>
                                        {s1Text ? (
                                          <span
                                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                                              s1Text === 'Open'
                                                ? 'border-white/10 bg-white/[0.03] text-white/80'
                                                : 'border-white/15 bg-white/[0.06] text-white'
                                            }`}
                                            title={event.shift_1_label || 'Shift 1'}
                                          >
                                            <span className="text-[10px] text-white/60">S1</span>
                                            <span className="max-w-[9rem] truncate">{s1Text}</span>
                                          </span>
                                        ) : null}

                                        {s2Text ? (
                                          <span
                                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                                              s2Text === 'Open'
                                                ? 'border-white/10 bg-white/[0.03] text-white/80'
                                                : 'border-white/15 bg-white/[0.06] text-white'
                                            }`}
                                            title={event.shift_2_label || 'Shift 2'}
                                          >
                                            <span className="text-[10px] text-white/60">S2</span>
                                            <span className="max-w-[9rem] truncate">{s2Text}</span>
                                          </span>
                                        ) : null}
                                      </>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-white/60">No positions in this group.</div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {groupedPositions.other.length ? (
          <div className="mt-6 ui-card">
            <div className="ui-card__header">
              <div>
                <div className="text-sm font-semibold">Other</div>
                <div className="text-xs text-white/55">Support positions</div>
              </div>
              <span className="ui-badge">{groupedPositions.other.length}</span>
            </div>

            <div className="ui-card__body">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {groupedPositions.other.map((pos: any) => {
                  const posName = String(pos.position_name ?? '—');

                  const assigned1Cid = String(pos.shift_1 ?? '').trim();
                  const assigned2Cid = String(pos.shift_2 ?? '').trim();
                  const assigned1 = assigned1Cid ? getRosterFullNameByCid(rosterByCid, assigned1Cid) : '';
                  const assigned2 = assigned2Cid ? getRosterFullNameByCid(rosterByCid, assigned2Cid) : '';

                  const showAssignmentsForUser = canSeeAssignments || canSeeSignups;

                  const sAll = canSeeSignups ? signupsByPosition.get(posName) ?? [] : [];
                  const signupCount = sAll.length;
                  const signupNames = canSeeSignups
                    ? sAll.map((x: any) => String(x.controller_full_name ?? x.controller_cid ?? '')).filter(Boolean)
                    : [];

                  const s1Text = showAssignmentsForUser ? (assigned1 ? assigned1 : canSeeSignups ? 'Open' : '') : '';
                  const s2Text =
                    showAssignmentsForUser && hasShift2 ? (assigned2 ? assigned2 : canSeeSignups ? 'Open' : '') : '';

                  const showAssignmentsBlock = canSeeSignups
                    ? Boolean(s1Text) || Boolean(s2Text)
                    : canSeeAssignments && (Boolean(assigned1) || Boolean(assigned2));

                  return (
                    <div key={String(pos.id)} className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-white">{posName}</div>
                            {canSeeSignups && signupCount > 0 ? <span className="text-xs text-white/50">({signupCount})</span> : null}
                          </div>

                          {canSeeSignups ? (
                            <details className="mt-1 text-xs text-white/55 [&_summary::-webkit-details-marker]:hidden">
                              <summary className="cursor-pointer select-none text-white/55 hover:text-white/70">
                                {signupCount ? `${signupCount} signup${signupCount === 1 ? '' : 's'}` : 'No signups'}
                              </summary>
                              {signupCount ? (
                                <div className="mt-1 block truncate whitespace-nowrap text-white/60" title={signupNames.join(', ')}>
                                  {summarizeNames(signupNames)}
                                </div>
                              ) : null}
                            </details>
                          ) : null}
                        </div>

                        {showAssignmentsBlock ? (
                          <div className="flex shrink-0 items-center gap-2">
                            {!hasShift2 ? (
                              s1Text ? (
                                <span
                                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${
                                    s1Text === 'Open'
                                      ? 'border-white/10 bg-white/[0.03] text-white/80'
                                      : 'border-white/15 bg-white/[0.06] text-white'
                                  }`}
                                  title={event.shift_1_label || 'Shift 1'}
                                >
                                  <span className="max-w-[12rem] truncate">{s1Text}</span>
                                </span>
                              ) : null
                            ) : (
                              <>
                                {s1Text ? (
                                  <span
                                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                                      s1Text === 'Open'
                                        ? 'border-white/10 bg-white/[0.03] text-white/80'
                                        : 'border-white/15 bg-white/[0.06] text-white'
                                    }`}
                                    title={event.shift_1_label || 'Shift 1'}
                                  >
                                    <span className="text-[10px] text-white/60">S1</span>
                                    <span className="max-w-[9rem] truncate">{s1Text}</span>
                                  </span>
                                ) : null}

                                {s2Text ? (
                                  <span
                                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                                      s2Text === 'Open'
                                        ? 'border-white/10 bg-white/[0.03] text-white/80'
                                        : 'border-white/15 bg-white/[0.06] text-white'
                                    }`}
                                    title={event.shift_2_label || 'Shift 2'}
                                  >
                                    <span className="text-[10px] text-white/60">S2</span>
                                    <span className="max-w-[9rem] truncate">{s2Text}</span>
                                  </span>
                                ) : null}
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>

</PageShell>
  );
}
