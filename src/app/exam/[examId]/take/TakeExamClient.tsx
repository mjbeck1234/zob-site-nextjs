'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Choice = {
  id: number;
  question_id: number;
  choice_text: string;
};

type Question = {
  id: number;
  qtype: 'mcq' | 'written' | string;
  prompt: string;
  points: number;
  choices: Choice[];
};

type Answer = {
  selected_choice_id?: number | null;
  written_text?: string | null;
};

function fmtTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

export default function TakeExamClient({ bundle }: { bundle: any }) {
  const router = useRouter();

  const attemptId = Number(bundle?.attempt?.id);
  const examId = Number(bundle?.exam?.id);
  const title = String(bundle?.exam?.title ?? 'Exam');
  const passPercent = Number(bundle?.exam?.pass_percent ?? bundle?.exam?.passPercent ?? 80);

  const questions: Question[] = Array.isArray(bundle?.questions) ? (bundle.questions as Question[]) : [];

  const initial = useMemo<Record<string, Answer>>(() => {
    const map = bundle?.answersByQuestionId ?? {};
    return typeof map === 'object' && map ? map : {};
  }, [bundle]);

  const [answers, setAnswers] = useState<Record<string, Answer>>(initial);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const expiresAtMs = useMemo(() => {
    const raw = bundle?.attempt?.expires_at ?? bundle?.attempt?.expiresAt ?? bundle?.expiresAt;
    if (!raw) return null;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : null;
  }, [bundle]);

  const timeLimitSeconds = useMemo(() => {
    const v = bundle?.exam?.time_limit_seconds ?? bundle?.exam?.timeLimitSeconds ?? bundle?.timeLimitSeconds;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [bundle]);

  useEffect(() => {
    setAnswers(initial);
  }, [initial]);

  // Timer: driven by expires_at if present; otherwise by timeLimitSeconds from started_at.
  useEffect(() => {
    let raf: any = null;
    let interval: any = null;

    const startedAtRaw = bundle?.attempt?.started_at ?? bundle?.attempt?.startedAt;
    const startedAtMs = startedAtRaw ? new Date(startedAtRaw).getTime() : null;
    const fallbackExpiresAt =
      startedAtMs && timeLimitSeconds ? startedAtMs + timeLimitSeconds * 1000 : null;

    const target = expiresAtMs ?? fallbackExpiresAt;
    if (!target) {
      setTimeLeft(null);
      return () => {
        if (raf) cancelAnimationFrame(raf);
        if (interval) clearInterval(interval);
      };
    }

    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, Math.floor((target - now) / 1000));
      setTimeLeft(left);
      if (left <= 0) {
        // auto-submit when time runs out
        void submit(true);
      }
    };

    tick();
    interval = setInterval(tick, 1000);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAtMs, timeLimitSeconds]);

  async function saveAnswer(questionId: number, patch: Answer) {
    if (!Number.isFinite(attemptId) || attemptId <= 0) return;
    const qid = String(questionId);
    setAnswers((prev) => ({ ...prev, [qid]: { ...(prev[qid] ?? {}), ...patch } }));
    setSaving((prev) => ({ ...prev, [qid]: true }));

    try {
      const res = await fetch(`/api/exams/attempt/${attemptId}/answer`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, ...patch }),
      });

      if (!res.ok) {
        let msg = 'Failed to save answer';
        try {
          const j = await res.json();
          if (j?.error) msg = String(j.error);
        } catch {
          try {
            const t = await res.text();
            if (t) msg = t;
          } catch {
            // ignore
          }
        }
        setSubmitError(msg);
      }
    } finally {
      setSaving((prev) => ({ ...prev, [qid]: false }));
    }
  }

  async function flushAnswersBeforeSubmit() {
    if (!Number.isFinite(attemptId) || attemptId <= 0) return;
    const pending: Promise<any>[] = [];

    for (const [qid, a] of Object.entries(answers)) {
      const questionId = Number(qid);
      if (!Number.isFinite(questionId)) continue;

      const payload: any = { questionId };
      if (a?.selected_choice_id != null) payload.selected_choice_id = a.selected_choice_id;
      if (typeof a?.written_text === 'string') payload.written_text = a.written_text;

      // Only send if there's something meaningful to persist
      if (!('selected_choice_id' in payload) && !('written_text' in payload)) continue;

      pending.push(
        fetch(`/api/exams/attempt/${attemptId}/answer`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).then(async (res) => {
          if (!res.ok) {
            const msg = await res.text().catch(() => '');
            throw new Error(msg || 'Failed to save answer');
          }
        }),
      );
    }

    if (pending.length) await Promise.all(pending);
  }

  const autoSubmittingRef = useRef(false);
  async function submit(fromTimer = false) {
    if (!Number.isFinite(attemptId) || attemptId <= 0) return;
    if (submitBusy) return;
    if (fromTimer && autoSubmittingRef.current) return;
    if (fromTimer) autoSubmittingRef.current = true;

    setSubmitBusy(true);

    try {
      setSubmitError(null);
      await flushAnswersBeforeSubmit();

      const res = await fetch(`/api/exams/attempt/${attemptId}/submit`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
      await res.json().catch(() => null);

      router.push(`/exam/attempt/${attemptId}`);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit exam');
      autoSubmittingRef.current = false;
    } finally {
      setSubmitBusy(false);
    }
  }

  if (!Number.isFinite(attemptId) || !Number.isFinite(examId)) {
    return (
      <div className="ui-card">
        <div className="ui-card__header">
          <div className="text-sm font-semibold">Unable to load exam</div>
        </div>
        <div className="ui-card__body">
          <p className="text-sm text-white/75">This exam session could not be initialized. Please refresh.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="ui-card">
        <div className="ui-card__header">
          <div className="flex flex-col gap-1">
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-xs text-white/60">Passing score: {Number.isFinite(passPercent) ? passPercent : 80}%</div>
          </div>
          <div className="flex items-center gap-2">
            {timeLeft != null ? (
              <span className="ui-badge">Time left: {fmtTimer(timeLeft)}</span>
            ) : null}
            {submitBusy ? <span className="ui-badge">Submitting…</span> : null}
          </div>
        </div>
        <div className="ui-card__body">
          {submitError ? (
            <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-white/85">
              {submitError}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void submit(false)}
            disabled={submitBusy}
            className="h-11 w-fit rounded-xl border border-white/10 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Submit exam
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {questions.map((q, idx) => {
          const qid = String(q.id);
          const a = answers[qid] ?? {};
          const isSaving = !!saving[qid];

          return (
            <div key={q.id} className="ui-card">
              <div className="ui-card__header">
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-semibold">Question {idx + 1}</div>
                  <div className="text-xs text-white/60">{Number(q.points ?? 0)} point(s)</div>
                </div>
                <div className="flex items-center gap-2">
                  {isSaving ? <span className="ui-badge">Saving…</span> : null}
                </div>
              </div>
              <div className="ui-card__body grid gap-3">
                <div className="whitespace-pre-wrap text-sm text-white/85">{q.prompt}</div>

                {String(q.qtype) === 'mcq' ? (
                  <div className="grid gap-2">
                    {(q.choices ?? []).map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          checked={Number(a.selected_choice_id ?? 0) === Number(c.id)}
                          onChange={() => void saveAnswer(q.id, { selected_choice_id: c.id })}
                          className="mt-1"
                        />
                        <span className="text-sm text-white/80">{c.choice_text}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-1">
                    <textarea
                      value={String(a.written_text ?? '')}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAnswers((prev) => ({ ...prev, [qid]: { ...(prev[qid] ?? {}), written_text: v } }));
                      }}
                      onBlur={(e) => void saveAnswer(q.id, { written_text: e.currentTarget.value })}
                      placeholder="Type your answer…"
                      className="min-h-[140px] rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white/20"
                    />
                    <div className="text-xs text-white/55">Your written answer will be reviewed by staff.</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
