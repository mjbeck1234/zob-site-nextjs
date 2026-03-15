import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireExamsGrader } from '@/lib/auth/guards';
import { canManageExams } from '@/lib/auth/exams';
import { getAttemptBundleForStaff } from '@/lib/exams';
import { gradeAttemptAction, resetAttemptAction } from '../../actions';

export default async function AttemptReviewPage({ params, searchParams }: { params: Promise<{ attemptId: string }>; searchParams: Promise<{ graded?: string; reset?: string }> }) {
  const user = await requireExamsGrader();
  const canManage = canManageExams(user);
  const { attemptId } = await params;
  const sp = await searchParams;
  const id = Number(attemptId);
  const bundle = await getAttemptBundleForStaff(id);
  if (!bundle) {
    return (
      <PageShell
        title="Attempt not found"
        subtitle=""
        crumbs={[
          { href: '/', label: 'Home' },
          { href: '/admin', label: 'Admin' },
          ...(canManage ? [{ href: '/admin/exams', label: 'Exams' }] : [{ label: 'Exams' }]),
          { href: '/admin/exams/review', label: 'Review queue' },
          { label: 'Not found' },
        ]}
      >
        <div className="ui-card"><div className="ui-card__body"><div className="text-sm text-white/70">Attempt not found.</div></div></div>
      </PageShell>
    );
  }

  const { exam, attempt, questions, answersByQuestionId } = bundle as any;
  const writtenQuestions = questions.filter((q: any) => String(q.qtype) === 'written');

  return (
    <PageShell
      title={`Grade Attempt #${attempt.id}`}
      subtitle={`${exam.title} • ${attempt.student_name ?? attempt.student_cid}`}
      crumbs={[
        { href: '/', label: 'Home' },
        { href: '/admin', label: 'Admin' },
        ...(canManage ? [{ href: '/admin/exams', label: 'Exams' }] : [{ label: 'Exams' }]),
        { href: '/admin/exams/review', label: 'Review queue' },
        { label: `Attempt #${attempt.id}` },
      ]}
      right={(
        <div className="flex items-center gap-2">
          <Link className="ui-link" href={`/exam/attempt/${attempt.id}`}>Open student view</Link>
          <Link className="ui-link" href="/admin/exams/review">← Back</Link>
        </div>
      )}
    >
      <div className="grid gap-4">
        <div className="ui-card"><div className="ui-card__body">
          {sp.graded === '1' ? <div className="mb-4 ui-badge">Graded</div> : null}
          {sp.reset === '1' ? <div className="mb-4 ui-badge">Reset</div> : null}

          <div className="text-sm text-white/70">
            Status: <span className="text-white/85 font-semibold">{attempt.status}</span>
            {attempt.result ? <> • Result: <span className="text-white/85 font-semibold">{attempt.result}</span></> : null}
            {attempt.locked ? <> • <span className="text-red-200 font-semibold">Locked</span></> : null}
          </div>

          {attempt.locked ? (
            <div className="mt-4">
              <form action={resetAttemptAction.bind(null, String(attempt.id))}>
                <button className="ui-btn ui-btn--primary" type="submit">Reset (unlock) attempt</button>
              </form>
              <div className="mt-2 text-xs text-white/60">Required to allow a retake after failure.</div>
            </div>
          ) : null}
        </div></div>

        {!writtenQuestions.length ? (
          <div className="ui-card"><div className="ui-card__body">
            <div className="text-sm text-white/70">No written questions on this attempt.</div>
          </div></div>
        ) : (
          <div className="ui-card">
            <div className="ui-card__header">
              <div>
                <div className="text-sm font-semibold">Written responses</div>
                <div className="text-xs text-white/60">Enter points (0..max) and optional comments, then submit grading.</div>
              </div>
            </div>
            <div className="ui-card__body">
              <form action={gradeAttemptAction.bind(null, String(attempt.id))} className="grid gap-4">
                {writtenQuestions.map((q: any, idx: number) => {
                  const ans = answersByQuestionId?.[q.id];
                  return (
                    <div key={q.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                      <div className="text-xs text-white/60">Q{idx + 1} • {q.points} point(s)</div>
                      <div className="mt-1 text-sm font-semibold">{q.prompt}</div>
                      <div className="mt-3">
                        <div className="text-xs text-white/60">Student response</div>
                        <div className="mt-1 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">{ans?.written_text || <span className="text-white/50">(no response)</span>}</div>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Points awarded</span>
                          <input name={`points_${q.id}`} type="number" min={0} max={q.points} defaultValue={ans?.points_awarded ?? 0} className="ui-input" />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Mentor comment (optional)</span>
                          <input name={`comment_${q.id}`} className="ui-input" defaultValue={ans?.mentor_comment ?? ''} />
                        </label>
                      </div>
                    </div>
                  );
                })}

                <button className="ui-btn ui-btn--primary" type="submit">Finalize grading</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
