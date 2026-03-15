import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireExamsManager } from '@/lib/auth/guards';
import { sql } from '@/lib/db';
import { getExamById, listAttemptsForExam } from '@/lib/exams';
import {
  createQuestionAction,
  deleteExamAction,
  deleteQuestionAction,
  resetAttemptFromExamEditorAction,
  updateExamAction,
  updateQuestionAction,
} from '../actions';

type StoredExamQuestion = {
  id: number;
  exam_id: number;
  content: string;
  type: number; // 0=MCQ, 1=TF, 2=Written
  answer: string;
  d1: string;
  d2: string;
  d3: string;
};

async function tableHasColumn(table: string, column: string): Promise<boolean> {
  const rows: any[] = await sql`
    SELECT COUNT(*) AS c
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${table}
      AND COLUMN_NAME = ${column}
  `;
  return Number(rows?.[0]?.c ?? 0) > 0;
}

export default async function EditExamPage({ params, searchParams }: { params: Promise<{ examId: string }>; searchParams: Promise<{ saved?: string; reset?: string; error?: string; q_added?: string; q_saved?: string }> }) {
  await requireExamsManager();
  const { examId } = await params;
  const sp = await searchParams;

  const exam = await getExamById(examId);
  if (!exam) {
    return (
      <PageShell title="Admin: Exams" subtitle="Not found" crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { href: '/admin/exams', label: 'Exams' }, { label: 'Not found' }]}>
        <div className="ui-card"><div className="ui-card__body"><div className="text-sm text-white/70">Exam not found.</div></div></div>
      </PageShell>
    );
  }

  const eid = Number(exam.id);
  const hasDesc = await tableHasColumn('exams', 'description').catch(() => false);

  const questions = await sql<StoredExamQuestion[]>`
    SELECT id, exam_id, content, type, answer, d1, d2, d3
    FROM exam_questions
    WHERE exam_id = ${eid}
    ORDER BY id ASC
  `;

  const attempts = await listAttemptsForExam(eid, 25);

  return (
    <PageShell
      title={`Edit: ${exam.title}`}
      subtitle="Manage exam settings and questions"
      crumbs={[{ href: '/', label: 'Home' }, { href: '/admin', label: 'Admin' }, { href: '/admin/exams', label: 'Exams' }, { label: exam.title }]}
      right={(
        <div className="flex items-center gap-2">
          <Link href="/admin/exams/review" className="ui-btn">Review queue</Link>
          <Link href={`/exam/${exam.id}`} className="ui-btn">Open as student</Link>
          <Link href="/admin/exams" className="ui-link">← Back</Link>
        </div>
      )}
    >
      <div className="grid gap-4">
        <div className="ui-card">
          <div className="ui-card__header">
            <div>
              <div className="text-sm font-semibold">Exam settings</div>
              <div className="text-xs text-white/60">Students only see exams that are assigned to them.</div>
            </div>
          </div>
          <div className="ui-card__body">
            {sp.saved === '1' ? <div className="mb-4 ui-badge">Saved</div> : null}
            {sp.reset === '1' ? <div className="mb-4 ui-badge">Reset</div> : null}
            {sp.q_added === '1' ? <div className="mb-4 ui-badge">Question added</div> : null}
            {sp.q_saved === '1' ? <div className="mb-4 ui-badge">Question saved</div> : null}
            {sp.error ? <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">{sp.error}</div> : null}

            <form action={updateExamAction.bind(null, String(exam.id))} className="grid gap-3 max-w-3xl">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Title</span>
                <input name="title" className="ui-input" defaultValue={exam.title} required />
              </label>

              {hasDesc ? (
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Description</span>
                  <textarea name="description" className="ui-input min-h-[120px]" defaultValue={(exam as any).description ?? ''} />
                </label>
              ) : null}

              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Pass percent</span>
                  <input name="pass_percent" type="number" min={1} max={100} defaultValue={Number((exam as any).pass_percent ?? 80)} className="ui-input" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Number to ask</span>
                  <input name="number_to_ask" type="number" min={0} defaultValue={Number((exam as any).number_to_ask ?? 0)} className="ui-input" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Reassign period (days)</span>
                  <input name="reassign_period" type="number" min={0} defaultValue={Number((exam as any).reassign_period ?? 0)} className="ui-input" />
                </label>
              </div>

              <button className="ui-btn ui-btn--primary" type="submit">Save settings</button>
            </form>

            <div className="mt-6">
              <form action={deleteExamAction.bind(null, String(exam.id))}>
                <button className="ui-btn ui-btn--danger" type="submit">Delete exam</button>
              </form>
              <div className="mt-2 text-xs text-white/60">Deletion is permanent and will remove questions and attempts via cascade.</div>
            </div>
          </div>
        </div>

        <div className="ui-card">
          <div className="ui-card__header">
            <div>
              <div className="text-sm font-semibold">Add question</div>
              <div className="text-xs text-white/60">MCQ = answer + 3 distractors. TF stores answer as true/false. Written uses type=2 and is mentor-graded.</div>
            </div>
          </div>
          <div className="ui-card__body">
            <form action={createQuestionAction.bind(null, String(exam.id))} className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Type</span>
                  <select name="qtype" className="ui-input" defaultValue="mcq">
                    <option value="mcq">Multiple choice</option>
                    <option value="tf">True / False</option>
                    <option value="written">Written</option>
                  </select>
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">Prompt</span>
                <textarea name="prompt" className="ui-input min-h-[140px]" placeholder="Question text" required />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Correct answer</span>
                  <input name="answer" className="ui-input" placeholder="For TF, use true/false" />
                </label>
                <div className="text-xs text-white/60 self-end">For written questions, this can be a reference answer for mentors.</div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Distractor 1</span>
                  <input name="d1" className="ui-input" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Distractor 2</span>
                  <input name="d2" className="ui-input" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Distractor 3</span>
                  <input name="d3" className="ui-input" />
                </label>
              </div>

              <button className="ui-btn ui-btn--primary" type="submit">Add question</button>
            </form>
          </div>
        </div>

        <div className="ui-card">
          <div className="ui-card__header">
            <div>
              <div className="text-sm font-semibold">Questions</div>
              <div className="text-xs text-white/60">{questions.length} configured</div>
            </div>
          </div>
          <div className="ui-card__body">
            {!questions.length ? (
              <div className="text-sm text-white/70">No questions yet.</div>
            ) : (
              <div className="space-y-4">
                {questions.map((q) => {
                  const qtype = q.type === 2 ? 'written' : q.type === 1 ? 'tf' : 'mcq';
                  const typeLabel = q.type === 2 ? 'Written' : q.type === 1 ? 'True/False' : 'Multiple choice';
                  return (
                    <div key={q.id} id={`q-${q.id}`} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Question #{q.id}</div>
                          <div className="text-xs text-white/60">{typeLabel}</div>
                        </div>
                        <form action={deleteQuestionAction.bind(null, String(exam.id), String(q.id))}>
                          <button className="ui-btn ui-btn--danger" type="submit">Delete</button>
                        </form>
                      </div>

                      <form action={updateQuestionAction.bind(null, String(exam.id), String(q.id))} className="mt-3 grid gap-3">
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Type</span>
                          <select name="qtype" className="ui-input" defaultValue={qtype}>
                            <option value="mcq">Multiple choice</option>
                            <option value="tf">True / False</option>
                            <option value="written">Written</option>
                          </select>
                        </label>

                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Prompt</span>
                          <textarea name="prompt" className="ui-input min-h-[140px]" defaultValue={q.content} />
                        </label>

                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Correct answer</span>
                          <input name="answer" className="ui-input" defaultValue={q.answer} />
                          <div className="text-xs text-white/60">For TF use true/false. For written, this is a reference answer.</div>
                        </label>

                        <div className="grid gap-3 md:grid-cols-3">
                          <label className="grid gap-2">
                            <span className="text-sm font-semibold">Distractor 1</span>
                            <input name="d1" className="ui-input" defaultValue={q.d1} />
                          </label>
                          <label className="grid gap-2">
                            <span className="text-sm font-semibold">Distractor 2</span>
                            <input name="d2" className="ui-input" defaultValue={q.d2} />
                          </label>
                          <label className="grid gap-2">
                            <span className="text-sm font-semibold">Distractor 3</span>
                            <input name="d3" className="ui-input" defaultValue={q.d3} />
                          </label>
                        </div>

                        {q.type === 2 ? (
                          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-sm text-white/70">
                            Written questions (type=2) require mentor grading. Student attempts appear in the <Link className="ui-link" href="/admin/exams/review">review queue</Link>.
                          </div>
                        ) : null}

                        <button className="ui-btn ui-btn--primary" type="submit">Save question</button>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="ui-card">
          <div className="ui-card__header">
            <div>
              <div className="text-sm font-semibold">Recent attempts</div>
              <div className="text-xs text-white/60">Useful for unlocking failed exams (staff reset)</div>
            </div>
          </div>
          <div className="ui-card__body">
            {!attempts.length ? (
              <div className="text-sm text-white/70">No attempts yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Attempt</th>
                      <th>Student</th>
                      <th>Status</th>
                      <th>Score</th>
                      <th>Locked</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((a) => (
                      <tr key={a.id}>
                        <td>#{a.id}</td>
                        <td>{a.student_name ?? a.student_cid}</td>
                        <td>{a.status}</td>
                        <td>{a.score_percent ?? '—'}{a.result ? ` (${a.result})` : ''}</td>
                        <td>{a.locked ? 'Yes' : 'No'}</td>
                        <td className="text-right whitespace-nowrap">
                          <Link href={`/exam/attempt/${a.id}`} className="ui-link">View</Link>
                          {a.locked ? (
                            <>
                              <span className="text-white/20">&nbsp;•&nbsp;</span>
                              <form className="inline" action={resetAttemptFromExamEditorAction.bind(null, String(exam.id), String(a.id))}>
                                <button className="ui-btn ui-btn--primary" type="submit">Reset</button>
                              </form>
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
      </div>
    </PageShell>
  );
}
