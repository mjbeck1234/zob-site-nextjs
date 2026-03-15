import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { requireExamsGrader } from '@/lib/auth/guards';
import { canManageExams } from '@/lib/auth/exams';
import { getAttemptBundleForStaff, getCorrectionById } from '@/lib/exams';
import { reviewCorrectionAction } from '../../actions';

function fmtDate(v: any) {
  try { return v ? new Date(v).toLocaleString() : ''; } catch { return ''; }
}

function shortUrl(url: string, max = 64) {
  try {
    const u = new URL(url);
    const base = `${u.hostname}${u.pathname}${u.search ? u.search : ''}`;
    if (base.length <= max) return base;
    return `${base.slice(0, Math.max(0, max - 1))}…`;
  } catch {
    if (url.length <= max) return url;
    return `${url.slice(0, Math.max(0, max - 1))}…`;
  }
}

export default async function CorrectionReviewPage({ params, searchParams }: { params: Promise<{ correctionId: string }>; searchParams: Promise<{ saved?: string }> }) {
  const user = await requireExamsGrader();
  const canManage = canManageExams(user);
  const { correctionId } = await params;
  const sp = await searchParams;
  const id = Number(correctionId);

  const corr = await getCorrectionById(id);
  if (!corr) {
    return (
      <PageShell
        title="Correction not found"
        subtitle=""
        crumbs={[
          { href: '/', label: 'Home' },
          { href: '/admin', label: 'Admin' },
          ...(canManage ? [{ href: '/admin/exams', label: 'Exams' }] : [{ label: 'Exams' }]),
          { href: '/admin/exams/corrections', label: 'Corrections' },
          { label: 'Not found' },
        ]}
      >
        <div className="ui-card"><div className="ui-card__body"><div className="text-sm text-white/70">Not found.</div></div></div>
      </PageShell>
    );
  }

  const bundle = await getAttemptBundleForStaff(Number(corr.attempt_id));
  const exam = (bundle as any)?.exam;
  const attempt = (bundle as any)?.attempt;
  const questions = (bundle as any)?.questions ?? [];
  const answersByQuestionId = (bundle as any)?.answersByQuestionId ?? {};

  const q = questions.find((qq: any) => String(qq.id) === String(corr.question_id));
  const ans = answersByQuestionId?.[String(corr.question_id)];

  const mcqChoices = Array.isArray(q?.choices) ? q.choices : [];
  const selectedChoice = mcqChoices.find((c: any) => String(c.id) === String(ans?.selected_choice_id));
  const proposedChoice = mcqChoices.find((c: any) => String(c.id) === String(corr.proposed_choice_id));

  const maxPoints = Number(q?.points ?? 0);

  return (
    <PageShell
      title={`Correction #${corr.id}`}
      subtitle={`${exam?.title ?? 'Exam'} • ${attempt?.student_name ?? attempt?.student_cid ?? corr.student_cid}`}
      crumbs={[
        { href: '/', label: 'Home' },
        { href: '/admin', label: 'Admin' },
        ...(canManage ? [{ href: '/admin/exams', label: 'Exams' }] : [{ label: 'Exams' }]),
        { href: '/admin/exams/corrections', label: 'Corrections' },
        { label: `#${corr.id}` },
      ]}
      right={(
        <div className="flex items-center gap-2">
          {corr.attempt_id ? <Link className="ui-link" href={`/exam/attempt/${corr.attempt_id}`}>Open student view</Link> : null}
          {corr.attempt_id ? <Link className="ui-link" href={`/admin/exams/review/${corr.attempt_id}`}>Open grading view</Link> : null}
          <Link className="ui-link" href="/admin/exams/corrections">← Back</Link>
        </div>
      )}
    >
      <div className="grid gap-4">
        <div className="ui-card"><div className="ui-card__body">
          {sp.saved === '1' ? <div className="mb-4 ui-badge">Saved</div> : null}
          <div className="text-sm text-white/70">
            Status: <span className="text-white/85 font-semibold">{corr.status}</span>
            {corr.reviewed_at ? <> • Reviewed: <span className="text-white/85 font-semibold">{fmtDate(corr.reviewed_at)}</span></> : null}
          </div>
          <div className="mt-2 text-xs text-white/60">Requested: {fmtDate(corr.created_at)}</div>
        </div></div>

        <div className="ui-card"><div className="ui-card__body">
          <div className="text-xs text-white/60">Question</div>
          <div className="mt-1 text-sm font-semibold whitespace-pre-wrap">{q?.prompt ?? `(question #${corr.question_id})`}</div>
          <div className="mt-2 text-xs text-white/60">Max points: {maxPoints}</div>

          {String(q?.qtype) === 'mcq' ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs text-white/60">Student selected</div>
                <div className="mt-1 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">
                  {selectedChoice?.choice_text ?? <span className="text-white/50">(no selection)</span>}
                </div>
              </div>
              <div>
                <div className="text-xs text-white/60">Student proposes</div>
                <div className="mt-1 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">
                  {proposedChoice?.choice_text ?? <span className="text-white/50">(not provided)</span>}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <div className="text-xs text-white/60">Student response</div>
              <div className="mt-1 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">{ans?.written_text ?? <span className="text-white/50">(no response)</span>}</div>
              {corr.proposed_text ? (
                <div className="mt-3">
                  <div className="text-xs text-white/60">Proposed correction</div>
                  <div className="mt-1 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">{corr.proposed_text}</div>
                </div>
              ) : null}
            </div>
          )}
        </div></div>

        <div className="ui-card"><div className="ui-card__body">
          <div className="text-xs text-white/60">Student reasoning</div>
          <div className="mt-1 whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-sm">{corr.reasoning}</div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs text-white/60">Proof URL</div>
              <div className="mt-1 text-sm">
                {corr.proof_url ? (
                  <a
                    className="ui-link inline-block max-w-[42rem] truncate align-bottom"
                    href={corr.proof_url}
                    target="_blank"
                    rel="noreferrer"
                    title={corr.proof_url}
                  >
                    {shortUrl(corr.proof_url)}
                  </a>
                ) : (
                  <span className="text-white/50">(none)</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/60">Proof citation / excerpt</div>
              <div className="mt-1 whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-sm">{corr.proof_text ?? <span className="text-white/50">(none)</span>}</div>
            </div>
          </div>
        </div></div>

        <div className="ui-card">
          <div className="ui-card__header">
            <div>
              <div className="text-sm font-semibold">Mentor decision</div>
              <div className="text-xs text-white/60">Approve/reject and optionally award points (overrides auto-grade).</div>
            </div>
          </div>
          <div className="ui-card__body">
            <form action={reviewCorrectionAction.bind(null, String(corr.id))} className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Decision</span>
                <select name="decision" className="ui-input" defaultValue={String(corr.status) === 'pending' ? 'approved' : String(corr.status)}>
                  <option value="approved">Approve</option>
                  <option value="rejected">Reject</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">Points to award (0..{maxPoints})</span>
                <input name="points_awarded" type="number" min={0} max={maxPoints} defaultValue={corr.points_awarded ?? maxPoints} className="ui-input" />
                <span className="text-xs text-white/60">If approved, this becomes a points override for this attempt/question.</span>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">Mentor note (optional)</span>
                <input name="mentor_note" className="ui-input" defaultValue={corr.mentor_note ?? ''} />
              </label>

              <button className="ui-btn ui-btn--primary" type="submit">Save decision</button>
            </form>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
