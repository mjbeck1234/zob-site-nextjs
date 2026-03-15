import Link from 'next/link';

import PageShell from '@/components/PageShell';
import { requireLogin } from '@/lib/auth/guards';
import { getRoster } from '@/lib/content';
import { textToHtml } from '@/lib/htmlContent';
import { TRAINING_SESSION_TYPES, getTrainingTicketsSchemaInfo, listTrainingTicketsForStudent, trainingTicketsEnabledForProfile } from '@/lib/trainingTickets';

function displayName(r: any) {
  const pref = String(r?.pref_name ?? r?.prefName ?? r?.preferred_name ?? r?.preferredName ?? '').trim();
  const first =
    pref ||
    String(
      r?.first_name ?? r?.firstName ?? r?.first ?? r?.firstname ?? r?.fname ?? r?.given_name ?? r?.givenName ?? ''
    ).trim();
  const last = String(r?.last_name ?? r?.lastName ?? r?.last ?? r?.lastname ?? r?.lname ?? r?.surname ?? '').trim();
  const cid = r?.cid ? String(r.cid) : '';
  const base = `${first} ${last}`.trim();
  return `${base || 'Unknown'} (#${cid})`;
}

function typeLabel(v: any) {
  const s = String(v ?? '');
  return TRAINING_SESSION_TYPES.find((t) => t.value === s)?.label ?? s;
}

function overallRubricLabel(rubricRatings: any) {
  if (!rubricRatings || typeof rubricRatings !== 'object') return null;
  const vals = Object.values(rubricRatings).map((x) => String(x ?? '').toLowerCase());
  if (vals.includes('unsatisfactory')) return 'Unsatisfactory';
  if (vals.includes('needs_improvement')) return 'Needs improvement';
  if (vals.includes('satisfactory')) return 'Satisfactory';
  return null;
}

export default async function ProfileTrainingTicketsPage() {
  const user = await requireLogin();
  const enabled = await trainingTicketsEnabledForProfile();
  const info = await getTrainingTicketsSchemaInfo();

  if (!enabled.enabled) {
    return (
      <PageShell
        title="Training Tickets"
        subtitle="Your training history."
        crumbs={[{ href: '/', label: 'Home' }, { href: '/profile', label: 'Profile' }, { label: 'Training Tickets' }]}
        actions={
          <Link href="/profile" className="ui-btn">
            Back
          </Link>
        }
      >
        <div className="ui-card">
          <div className="ui-card__body text-sm text-white/70">
            Training tickets are not enabled yet (missing both <code className="text-white/80">training_tickets</code> and existing <code className="text-white/80">tickets</code> tables).
          </div>
        </div>
      </PageShell>
    );
  }

  const roster = (await getRoster().catch(() => [])) as any[];
  const rosterByCid = new Map<string, string>(roster.map((r) => [String(r.cid), displayName(r)]));

  const tickets = await listTrainingTicketsForStudent(Number(user.cid), 250).catch(() => []);
  const total = tickets.length;
  const noShows = info.hasNoShow ? tickets.filter((t: any) => Boolean(t.no_show)).length : 0;

  return (
    <PageShell
      title="Training Tickets"
      subtitle="Your training history (mentor-only notes hidden)."
      crumbs={[{ href: '/', label: 'Home' }, { href: '/profile', label: 'Profile' }, { label: 'Training Tickets' }]}
      actions={
        <Link href="/profile" className="ui-btn">
          Back
        </Link>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="ui-card">
            <div className="ui-card__body">
              <div className="text-xs text-white/60">Total tickets</div>
              <div className="mt-1 text-2xl font-semibold">{total}</div>
            </div>
          </div>
          <div className="ui-card">
            <div className="ui-card__body">
              <div className="text-xs text-white/60">No-shows</div>
              <div className="mt-1 text-2xl font-semibold">{noShows}</div>
            </div>
          </div>
          <div className="ui-card">
            <div className="ui-card__body">
              <div className="text-xs text-white/60">Most recent</div>
              <div className="mt-1 text-2xl font-semibold">
                {tickets?.[0]?.session_start ? new Date(String(tickets[0].session_start)).toLocaleDateString() : '—'}
              </div>
            </div>
          </div>
        </div>

        <div className="ui-card">
          <div className="ui-card__header">
            <div className="text-sm font-semibold">Tickets</div>
          </div>
          <div className="ui-card__body">
            {tickets.length === 0 ? (
              <div className="text-sm text-white/70">No tickets yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Mentor</th>
                      <th>Type</th>
                      <th className="text-right">Minutes</th>
                      <th>Summary</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t: any) => {
                      const date = t.session_start ? new Date(String(t.session_start)).toLocaleString() : '—';
                      const mentor = rosterByCid.get(String(t.mentor_cid)) ?? t.mentor_name ?? `#${String(t.mentor_cid ?? '')}`;
                      const rubricSummary = info.hasRubric ? overallRubricLabel(t.rubric_ratings) : null;
                      const noteSnippet =
                        !rubricSummary && t.notes_student
                          ? textToHtml(String(t.notes_student)).replace(/<[^>]*>/g, '').trim()
                          : '';
                      const isNoShow = info.hasNoShow ? Boolean(t.no_show) : false;
                      return (
                        <tr key={String(t.id)}>
                          <td className="whitespace-nowrap">
                            {date}
                            {isNoShow ? <span className="ml-2 ui-badge">No-show</span> : null}
                          </td>
                          <td className="whitespace-nowrap">{mentor}</td>
                          <td>{typeLabel(t.session_type)}</td>
                          <td className="text-right">{Number(t.duration_minutes) || 0}</td>
                          <td>
                            {rubricSummary ? (
                              <span className="ui-badge">{rubricSummary}</span>
                            ) : noteSnippet ? (
                              <span className="text-white/70">{noteSnippet.length > 80 ? noteSnippet.slice(0, 77) + '…' : noteSnippet}</span>
                            ) : (
                              <span className="text-white/50">—</span>
                            )}
                          </td>
                          <td className="text-right">
                            <Link href={`/profile/training-tickets/${String(t.id)}`} className="ui-link">
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
