import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { getUser } from '@/lib/auth/getUser';
import { listAssignedExamsForStudent, listCompletedExamsForStudent, type StudentAssignedExamItem, type StudentCompletedExamItem } from '@/lib/exams';

function fmtStatus(a: any): string {
  if (!a) return 'Not started';
  if (a.locked) return 'Locked';

  const s = String(a.status ?? '').toLowerCase();
  if (s == 'in_progress') return 'In progress';
  if (s == 'needs_review') return 'Pending review';
  if (s == 'graded') {
    const r = String(a.result ?? '').trim();
    return r ? `Graded (${r})` : 'Graded';
  }
  return s || '—';
}

function fmtScore(a: any): string {
  const v = a?.score_percent;
  if (v == null) return '—';
  const n = Number(v);
  if (Number.isFinite(n)) return `${n}%`;
  return `${String(v)}%`;
}

function fmtDate(dt: any): string {
  const s = String(dt ?? '').trim();
  if (!s) return '—';
  // MySQL dateStrings returns either `YYYY-MM-DD HH:MM:SS` or an ISO-ish string.
  return s.replace('T', ' ').replace('.000Z', '');
}

export default async function ExamsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp?.tab === 'completed' ? 'completed' : 'assigned';

  const user = await getUser();
  const [assigned, completed] = user
    ? await Promise.all([
        listAssignedExamsForStudent(Number(user.cid)),
        listCompletedExamsForStudent(Number(user.cid)),
      ])
    : [([] as StudentAssignedExamItem[]), ([] as StudentCompletedExamItem[])];

  return (
    <PageShell
      title="Exams"
      subtitle="Assigned exams and your results"
      crumbs={[{ href: '/', label: 'Home' }, { label: 'Exams' }]}
    >
      <div className="grid gap-4">
        {!user ? (
          <div className="ui-card">
            <div className="ui-card__body">
              <div className="text-sm text-white/70">You must be signed in to view your assigned exams.</div>
              <div className="mt-4">
                <a href="/api/auth/login" className="ui-btn ui-btn--primary">Login with VATSIM</a>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={{ pathname: '/exam', query: { tab: 'assigned' } }}
            className={`ui-btn ${tab === 'assigned' ? 'ui-btn--primary' : ''}`}
          >
            Assigned ({assigned.length})
          </Link>
          <Link
            href={{ pathname: '/exam', query: { tab: 'completed' } }}
            className={`ui-btn ${tab === 'completed' ? 'ui-btn--primary' : ''}`}
          >
            Completed ({completed.length})
          </Link>
        </div>

        {tab === 'assigned' ? (
          <div className="ui-card">
            <div className="ui-card__header">
              <div>
                <div className="text-sm font-semibold">Assigned exams</div>
                <div className="text-xs text-white/60">Only exams assigned by a mentor will appear here.</div>
              </div>
            </div>
            <div className="ui-card__body">
              {!user ? (
                <div className="text-sm text-white/70">Sign in to view your assigned exams.</div>
              ) : !assigned.length ? (
                <div className="text-sm text-white/70">You have no active exam assignments.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>Exam</th>
                        <th>Due</th>
                        <th>Status</th>
                        <th>Score</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assigned.map((it) => (
                        <tr key={String(it.exam.id)}>
                          <td>
                            <div className="font-semibold">{it.exam.title}</div>
                            <div className="text-xs text-white/60">Exam #{it.exam.id}</div>
                          </td>
                          <td>{fmtDate(it.expiry_date)}</td>
                          <td>{fmtStatus(it.latestAttempt as any)}</td>
                          <td>
                            {it.latestAttempt ? (
                              <>
                                {fmtScore(it.latestAttempt as any)}
                                {it.latestAttempt.result ? ` (${String(it.latestAttempt.result).toUpperCase()})` : ''}
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="text-right whitespace-nowrap">
                            <Link className="ui-link" href={`/exam/${it.exam.id}`}>{it.latestAttempt ? 'Open' : 'Start'}</Link>
                            {it.latestAttempt ? (
                              <>
                                <span className="text-white/20">&nbsp;•&nbsp;</span>
                                <Link className="ui-link" href={`/exam/attempt/${it.latestAttempt.id}`}>Results</Link>
                              </>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="ui-card">
            <div className="ui-card__header">
              <div>
                <div className="text-sm font-semibold">Completed exams</div>
                <div className="text-xs text-white/60">Most recent graded or pending-review attempt per exam.</div>
              </div>
            </div>
            <div className="ui-card__body">
              {!user ? (
                <div className="text-sm text-white/70">Sign in to view your completed exams.</div>
              ) : !completed.length ? (
                <div className="text-sm text-white/70">No completed exams yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>Exam</th>
                        <th>Status</th>
                        <th>Score</th>
                        <th>Updated</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completed.map((it) => (
                        <tr key={`${it.exam.id}-${(it.latestAttempt as any).id}`}>
                          <td>
                            <div className="font-semibold">{it.exam.title}</div>
                            <div className="text-xs text-white/60">Exam #{it.exam.id}</div>
                          </td>
                          <td>{fmtStatus(it.latestAttempt as any)}</td>
                          <td>
                            {fmtScore(it.latestAttempt as any)}
                            {it.latestAttempt.result ? ` (${String(it.latestAttempt.result).toUpperCase()})` : ''}
                          </td>
                          <td>{fmtDate((it.latestAttempt as any).reviewed_at ?? (it.latestAttempt as any).submitted_at ?? (it.latestAttempt as any).updated_at)}</td>
                          <td className="text-right whitespace-nowrap">
                            <Link className="ui-link" href={`/exam/attempt/${it.latestAttempt.id}`}>View</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
