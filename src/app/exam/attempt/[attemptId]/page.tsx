import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireLogin } from '@/lib/auth/guards';
import { canGradeExams } from '@/lib/auth/exams';
import { getAttemptBundleForStudent, getAttemptBundleForStaff } from '@/lib/exams';

function badge(text: string) {
  return <span className="ui-badge">{text}</span>;
}

export default async function AttemptResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const user = await requireLogin();

  const id = Number(attemptId);
  const bundleStudent = await getAttemptBundleForStudent(id, user);
  const bundle = bundleStudent ?? (canGradeExams(user) ? await getAttemptBundleForStaff(id) : null);

  if (!bundle) {
    return (
      <PageShell title="Exam" subtitle="Not found" crumbs={[{ href: '/', label: 'Home' }, { href: '/exam', label: 'Exams' }, { label: 'Not found' }]}>
        <div className="ui-card"><div className="ui-card__body"><div className="text-sm text-white/70">Attempt not found.</div></div></div>
      </PageShell>
    );
  }

  const { exam, attempt, questions, answersByQuestionId } = bundle as any;
  const status = String(attempt.status);
  const score = attempt.score_percent;
  const result = attempt.result;

  const totalPts = Number(attempt.total_points ?? 0);
  const earnedPts = Number(attempt.earned_points ?? 0);

  return (
    <PageShell
      title={exam.title}
      subtitle="Results"
      crumbs={[{ href: '/', label: 'Home' }, { href: '/exam', label: 'Exams' }, { label: exam.title }, { label: `Attempt #${attempt.id}` }]}
      right={<Link href="/exam" className="ui-link">← Back</Link>}
    >
      <div className="grid gap-4">
        <div className="ui-card">
          <div className="ui-card__body">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Attempt #{attempt.id}</div>
                <div className="text-xs text-white/60">
                  Submitted: {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : '—'}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {badge(status === 'needs_review' ? 'Pending review' : status === 'graded' ? 'Graded' : 'In progress')}
                {status === 'graded' && score !== null ? badge(`${score}%`) : null}
                {status === 'graded' && result ? badge(String(result).toUpperCase()) : null}
                {attempt.locked ? badge('LOCKED') : null}
              </div>
            </div>

            {status === 'needs_review' ? (
              <div className="mt-3 text-sm text-white/70">A mentor needs to grade the written section. MCQ scoring may be incomplete until review is finished.</div>
            ) : null}

            <div className="mt-4 text-sm text-white/75">
              Points: <span className="text-white font-semibold">{earnedPts}</span> / {totalPts}
              <span className="text-white/30"> • </span>
              Pass threshold: {exam.pass_percent}%
            </div>
          </div>
        </div>

        {questions.map((q: any, idx: number) => {
          const a = answersByQuestionId?.[String(q.id)] ?? {};
          const isWritten = String(q.qtype) === 'written';
          const isMcq = String(q.qtype) === 'mcq';
          const choices = Array.isArray(q.choices) ? q.choices : [];
          const selected = a.selected_choice_id ? choices.find((c: any) => Number(c.id) === Number(a.selected_choice_id)) : null;
          const correct = q.correct_choice_id ? choices.find((c: any) => Number(c.id) === Number(q.correct_choice_id)) : null;

          const mcqCorrect = isMcq && a.selected_choice_id && q.correct_choice_id && Number(a.selected_choice_id) === Number(q.correct_choice_id);
          const writtenAwarded = isWritten ? a.points_awarded : null;

          return (
            <div key={q.id} className="ui-card">
              <div className="ui-card__header">
                <div>
                  <div className="text-sm font-semibold">Q{idx + 1}</div>
                  <div className="text-xs text-white/60">{q.points} point(s) • {isWritten ? 'Written' : 'Multiple choice'}</div>
                </div>
                <div className="text-xs text-white/60">
                  {isMcq && q.correct_choice_id ? (mcqCorrect ? 'Correct' : 'Incorrect') : null}
                  {isWritten ? (writtenAwarded === null || writtenAwarded === undefined ? 'Not graded' : `${writtenAwarded}/${q.points}`) : null}
                </div>
              </div>
              <div className="ui-card__body">
                <div className="text-sm text-white whitespace-pre-wrap">{q.prompt}</div>

                {isMcq ? (
                  <div className="mt-4 space-y-2">
                    {choices.map((c: any) => {
                      const picked = Number(a.selected_choice_id ?? 0) === Number(c.id);
                      const isCorrect = q.correct_choice_id && Number(q.correct_choice_id) === Number(c.id);
                      return (
                        <div key={c.id} className={`rounded-2xl border p-3 text-sm ${picked ? 'border-amber-400/30 bg-amber-400/10' : 'border-white/10 bg-white/[0.02]'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-white/85">{c.choice_text}</div>
                            <div className="text-xs text-white/60 whitespace-nowrap">
                              {picked ? 'Your choice' : ''}
                              {picked && isCorrect ? ' • Correct' : ''}
                              {picked && !isCorrect && q.correct_choice_id ? ' • Wrong' : ''}
                              {!picked && isCorrect && q.correct_choice_id ? 'Correct answer' : ''}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {isWritten ? (
                  <div className="mt-4">
                    <div className="text-xs text-white/60 mb-1">Your answer</div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-sm text-white/85 whitespace-pre-wrap">{String(a.written_text ?? '').trim() || '—'}</div>
                    {a.mentor_comment ? (
                      <div className="mt-3">
                        <div className="text-xs text-white/60 mb-1">Mentor feedback</div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-sm text-white/80 whitespace-pre-wrap">{a.mentor_comment}</div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
