'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

export type HomeTrainingSessionRow = {
  id: string;
  startPretty: string;
  countdown: string;
  typeName: string;
  mentorName: string;
  studentName: string;
};

export default function ArtccUpcomingTrainingSessionsCardClient(props: {
  sessions: HomeTrainingSessionRow[];
  total: number;
  loadError: boolean;
  scheddyUrl?: string;
  learningHref?: string;
}) {
  const { sessions, total, loadError, scheddyUrl = 'https://scheddy.clevelandcenter.org', learningHref = '/learning' } = props;
  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(() => {
    if (expanded) return sessions;
    return sessions.slice(0, 2);
  }, [sessions, expanded]);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <div className="text-sm font-semibold text-white">Upcoming training sessions</div>
          <div className="text-xs text-white/55">ARTCC-wide</div>
        </div>
        <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
          {loadError ? '—' : total}
        </span>
      </div>

      <div className="px-5 py-4">
        {loadError ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/70">
            Unable to load sessions right now.
          </div>
        ) : total ? (
          <>
            <ul className="space-y-2">
              {visible.map((r) => (
                <li key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{r.startPretty}</div>
                      <div className="mt-1 text-xs text-white/60 truncate">{r.typeName}</div>
                    </div>
                    {r.countdown ? (
                      <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/80">
                        {r.countdown}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-white/60">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white/55">Mentor</span>
                      <span className="font-semibold text-white/80 truncate">{r.mentorName || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white/55">Student</span>
                      <span className="font-semibold text-white/80 truncate">{r.studentName || '—'}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {total > 2 ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 backdrop-blur hover:bg-white/[0.14] hover:text-white"
                >
                  {expanded ? 'Show fewer' : `Show all (${total})`}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/70">
            No upcoming sessions scheduled.
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href={scheddyUrl}
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 backdrop-blur hover:bg-white/[0.14] hover:text-white"
          >
            Open Scheddy →
          </Link>
          <Link href={learningHref} className="text-sm font-semibold text-amber-200/90 hover:text-amber-200">
            Learning Center
          </Link>
        </div>
      </div>
    </div>
  );
}
