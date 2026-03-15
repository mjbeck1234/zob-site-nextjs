import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { getUser } from '@/lib/auth/getUser';
import { getUserProfile, profileAvatarSupported, profilesEnabled } from '@/lib/profile';
import { getLatestLoaForCid, loaEnabled } from '@/lib/loa';
import { listApprovedFeedbackForControllerCid } from '@/lib/feedback';
import { listTrainingTicketsForStudent, trainingTicketsEnabledForProfile } from '@/lib/trainingTickets';
import { getRoster } from '@/lib/content';
import { sql } from '@/lib/db';
import { updateProfileAction } from './actions';

function displayRosterName(r: any) {
  const pref = String(r?.pref_name ?? r?.prefName ?? '').trim();
  const first = pref || String(r?.first_name ?? r?.firstName ?? '').trim();
  const last = String(r?.last_name ?? r?.lastName ?? '').trim();
  const cid = r?.cid ? String(r.cid) : r?.controller_cid ? String(r.controller_cid) : '';
  const base = `${first} ${last}`.trim();
  return `${base || 'Unknown'}${cid ? ` (#${cid})` : ''}`;
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const sp = await searchParams;
  const user = await getUser();

  if (!user) {
    return (
      <PageShell
        title="Profile"
        subtitle="Sign in to view your profile."
        crumbs={[{ href: '/', label: 'Home' }, { label: 'Profile' }]}
      >
        <div className="ui-card">
          <div className="ui-card__body">
            <p className="text-sm text-white/70">You’re not signed in.</p>
            <div className="mt-4">
              <a href="/api/auth/login" className="ui-btn ui-btn--primary">
                Sign in with VATSIM
              </a>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  const profOk = await profilesEnabled();
  const avatarOk = profOk ? await profileAvatarSupported() : false;
  const profile = profOk ? await getUserProfile(user.cid) : null;
  const loaOk = await loaEnabled();
  const loa = loaOk ? await getLatestLoaForCid(user.cid) : null;

  const rosterRows = (await getRoster().catch(() => [])) as any[];
  const rosterByCid = new Map<string, string>(
    (Array.isArray(rosterRows) ? rosterRows : []).map((r) => [String(r.cid ?? r.controller_cid ?? r.id ?? ''), displayRosterName(r)])
  );
  const approvedFeedback = await listApprovedFeedbackForControllerCid(user.cid).catch(() => []);

  const ttEnabled = await trainingTicketsEnabledForProfile();
  const recentTickets = ttEnabled.enabled
    ? await listTrainingTicketsForStudent(Number(user.cid), 5).catch(() => [])
    : [];

  // Total counts across both schemas (new: training_tickets, existing: tickets)
  let trainingTicketCount = 0;
  if (ttEnabled.hasNew) {
    const rows = await sql<{ count: number }[]>`
      SELECT COUNT(*) AS count
      FROM training_tickets
      WHERE student_cid = ${user.cid}
    `;
    trainingTicketCount += Number(rows?.[0]?.count) || 0;
  }
  if (ttEnabled.hasStored) {
    const rows = await sql.unsafe<{ count: number }[]>(
      'SELECT COUNT(*) AS count FROM tickets WHERE controller_cid = $1',
      [String(user.cid)]
    );
    trainingTicketCount += Number(rows?.[0]?.count) || 0;
  }

  const latestTicketDate = recentTickets?.[0]?.session_start
    ? new Date(String(recentTickets[0].session_start)).toLocaleDateString()
    : null;


  return (
    <PageShell
      title="Profile"
      subtitle="Your account, biography, and requests."
      crumbs={[{ href: '/', label: 'Home' }, { label: 'Profile' }]}
      right={<a href="/api/auth/logout" className="ui-btn">Logout</a>}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Left */}
        <div className="ui-card">
          <div className="ui-card__header">
            <div>
              <div className="text-sm font-semibold">Account</div>
              <div className="text-xs text-white/60">Connected via VATSIM SSO</div>
            </div>
            {sp.saved === '1' ? <div className="ui-badge">Saved</div> : null}
          </div>

          <div className="ui-card__body">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {avatarOk && profile?.avatar_url ? <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" /> : null}
              </div>
              <div>
                <div className="text-base font-bold text-white">{user.fullName ?? 'Controller'}</div>
                <div className="mt-1 text-xs text-white/60">CID {user.cid}{user.ratingShort ? ` • ${user.ratingShort}` : ''}</div>
                <div className="mt-1 text-xs text-white/60">Roles: {(user.roles ?? []).join(', ') || 'Member'}</div>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-sm font-semibold">Public Profile</div>
              <div className="mt-1 text-xs text-white/60">This info is stored in <code className="text-white/80">user_profiles</code>.</div>
            </div>

            {!profOk ? (
              <div className="mt-4 text-sm text-white/70">
                The <span className="text-white/80 font-semibold">user_profiles</span> table is not present in your DB.
              </div>
            ) : (
              <form action={updateProfileAction} className="mt-4 grid gap-3">
                {avatarOk ? (
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Avatar URL</span>
                    <input name="avatar_url" className="ui-input" placeholder="https://..." defaultValue={profile?.avatar_url ?? ''} />
                  </label>
                ) : (
                  <div className="text-xs text-white/60">
                    Avatar images are not enabled in your current DB schema (missing <code className="text-white/80">user_profiles.avatar_url</code>).
                  </div>
                )}

                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Biography</span>
                  <textarea name="bio" className="ui-input min-h-[140px]" placeholder="Tell the ARTCC about you..." defaultValue={profile?.bio ?? ''} />
                </label>

                <div className="flex items-center gap-3">
                  <button className="ui-btn ui-btn--primary" type="submit">Save Profile</button>
                  <Link href="/loa" className="ui-link">LOA info</Link>
                </div>
              </form>
            )}

            <div className="mt-6 text-sm text-white/70">
              Need resources? <Link href="/learning" className="ui-link">Learning Center →</Link>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          <div className="ui-card">
            <div className="ui-card__header">
              <div className="text-sm font-semibold">Leave of Absence</div>
              <Link href="/loa" className="ui-btn">
                {user.isZobMember ? 'Open' : 'Policy'}
              </Link>
            </div>
            <div className="ui-card__body">
              {!user.isZobMember ? (
                <div className="text-sm text-white/70">
                  LOA requests are available to ZOB members. You can still review the LOA policy page.
                </div>
              ) : !loaOk ? (
                <div className="text-sm text-white/70">
                  The <span className="text-white/80 font-semibold">loa_requests</span> table is not present in your DB.
                </div>
              ) : loa ? (
                <div className="text-sm text-white/80">
                  <div>Return date: <span className="text-white font-semibold">{loa.estimated_date ? new Date(loa.estimated_date).toLocaleDateString() : '—'}</span></div>
                  <div className="mt-1">Status: <span className="text-white font-semibold">{loa.approved === null ? 'Pending' : loa.approved ? 'Approved' : 'Rejected'}</span></div>
                  <div className="mt-2 text-xs text-white/60">Submitted {loa.created_at ? new Date(loa.created_at).toLocaleString() : '—'}</div>
                </div>
              ) : (
                <div className="text-sm text-white/70">No LOA request on file.</div>
              )}
            </div>
          </div>

          <div className="ui-card">
            <div className="ui-card__header">
              <div className="text-sm font-semibold">Feedback</div>
              <Link href="/profile/feedback" className="ui-btn">View</Link>
            </div>
            <div className="ui-card__body">
              <div className="text-sm text-white/80">
                Approved feedback received: <span className="text-white font-semibold">{approvedFeedback.length}</span>
              </div>
              <div className="mt-2 text-xs text-white/60">Only entries marked Approved by admins appear here.</div>

              {approvedFeedback.length ? (
                <div className="mt-3 space-y-2">
                  {approvedFeedback.slice(0, 3).map((fb: any) => (
                    <Link
                      key={fb.id}
                      href={`/profile/feedback/${fb.id}`}
                      className="block rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm text-white/90">
                          {fb.pos_category ? String(fb.pos_category) : 'Feedback'}
                          {fb.rating ? <span className="text-white/60"> • Rating {String(fb.rating)}</span> : null}
                        </div>
                        <div className="text-xs text-white/60">
                          {fb.created_at ? new Date(String(fb.created_at)).toLocaleDateString() : ''}
                        </div>
                      </div>
                      {fb.comments ? (
                        <div className="mt-1 line-clamp-2 text-xs text-white/70">{String(fb.comments).replace(/<[^>]*>/g, '')}</div>
                      ) : null}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-sm text-white/70">No approved feedback yet.</div>
              )}
            </div>
          </div>

          <div className="ui-card">
            <div className="ui-card__header">
              <div className="text-sm font-semibold">Training Tickets</div>
              <Link href="/profile/training-tickets" className="ui-btn">View</Link>
            </div>
            <div className="ui-card__body">
              {!ttEnabled.enabled ? (
                <div className="text-sm text-white/70">
                  Training tickets are not enabled yet (missing both <code className="text-white/80">training_tickets</code> and existing <code className="text-white/80">tickets</code> tables).
                </div>
              ) : (
                <>
                  <div className="text-sm text-white/80">
                    Tickets on file: <span className="text-white font-semibold">{trainingTicketCount}</span>
                  </div>
                  <div className="mt-2 text-xs text-white/60">
                    {latestTicketDate ? `Latest session: ${latestTicketDate}` : 'No sessions recorded yet.'}
                  </div>
                  <div className="mt-2 text-xs text-white/60">Notes intended for mentors are not shown in student view.</div>

                  {recentTickets.length ? (
                    <div className="mt-3 space-y-2">
                      {recentTickets.slice(0, 3).map((t: any) => (
                        <Link
                          key={`${t.source ?? 't'}-${t.id}`}
                          href={`/profile/training-tickets/${t.id}`}
                          className="block rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm text-white/90">
                              {t.training_category ? String(t.training_category) : 'Training'}
                              {t.session_type ? <span className="text-white/60"> • {String(t.session_type)}</span> : null}
                            </div>
                            <div className="text-xs text-white/60">
                              {t.session_start ? new Date(String(t.session_start)).toLocaleDateString() : ''}
                            </div>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-3 text-xs text-white/60">
                            <div>
                              Mentor:{' '}
                              {t.mentor_cid ? (rosterByCid.get(String(t.mentor_cid)) ?? (t.mentor_name ? String(t.mentor_name) : `CID ${t.mentor_cid}`)) : '—'}
                            </div>
                            <div>
                              {Number(t.duration_minutes) ? `${Number(t.duration_minutes)} min` : ''}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-white/70">No tickets found for your CID.</div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="ui-card">
            <div className="ui-card__header">
              <div className="text-sm font-semibold">Syllabus</div>
              <Link href="/learning/syllabus" className="ui-btn">Open</Link>
            </div>
            <div className="ui-card__body">
              <div className="text-sm text-white/70">
                View your mentor-fillable training syllabus checklist.
              </div>
            </div>
          </div>



          <div className="ui-card">
            <div className="ui-card__header">
              <div className="text-sm font-semibold">Quick Links</div>
            </div>
            <div className="ui-card__body">
              <div className="space-y-2 text-sm">
                <Link href="/roster" className="ui-link block">Roster</Link>
                <Link href="/events" className="ui-link block">Events</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
