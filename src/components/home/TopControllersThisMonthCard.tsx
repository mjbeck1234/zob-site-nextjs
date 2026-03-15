import Link from 'next/link';

import { formatHours, getTopControllersThisMonth } from '@/lib/controllerHours';

function monthLabelUtc(d = new Date()): string {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[d.getUTCMonth()] ?? 'Jan'} ${d.getUTCFullYear()}`;
}

const rankStyles = [
  {
    ring: 'border-amber-300/30 bg-amber-400/15 text-amber-100',
    accent: 'from-amber-300/20 via-yellow-300/10 to-transparent',
    badge: 'text-amber-200',
    label: 'Controller of the month',
  },
  {
    ring: 'border-sky-300/25 bg-sky-400/10 text-sky-100',
    accent: 'from-sky-300/12 via-cyan-300/8 to-transparent',
    badge: 'text-sky-200',
    label: 'Runner-up',
  },
  {
    ring: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
    accent: 'from-emerald-300/12 via-teal-300/8 to-transparent',
    badge: 'text-emerald-200',
    label: 'Third place',
  },
];

export default async function TopControllersThisMonthCard(props: { limit?: number; compact?: boolean; href?: string }) {
  const limit = Math.max(1, Math.min(10, Number(props.limit ?? 3) || 3));
  const href = props.href ?? '/roster';
  const compact = Boolean(props.compact);

  let top: Array<{ cid: number; name: string; callsign?: string | null; seconds: number }> = [];
  try {
    top = await getTopControllersThisMonth(limit);
  } catch {
    top = [];
  }

  const leader = top[0] ?? null;
  const runnersUp = top.slice(1, limit);

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <div className="text-sm font-semibold text-white">Top controllers</div>
          <div className="mt-1 text-xs text-white/55">This month • {monthLabelUtc()}</div>
        </div>
        <Link href={href} className="text-sm font-semibold text-amber-200/90 hover:text-amber-200">
          View roster →
        </Link>
      </div>

      <div className={compact ? 'px-5 py-4' : 'px-5 py-5'}>
        {top.length ? (
          <div className="space-y-4">
            {leader ? (
              <div className="relative overflow-hidden rounded-[28px] border border-amber-300/20 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-5 py-5">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(251,191,36,0.16),transparent_22%)]" />
                <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/95">
                      <span aria-hidden="true">🏆</span>
                      {rankStyles[0].label}
                    </div>
                    <div className="mt-4 truncate text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                      {leader.name}
                    </div>
                    <div className="mt-4 text-sm text-amber-100/90">
                      Put in a huge month on the network — congrats.
                    </div>
                  </div>

                  <div className="shrink-0 rounded-3xl border border-white/10 bg-black/15 px-5 py-4 text-right shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">Hours worked</div>
                    <div className="mt-2 text-3xl font-extrabold tabular-nums text-white sm:text-4xl">
                      {formatHours(leader.seconds)}
                    </div>
                    <div className="mt-1 text-xs text-amber-100/80">this month</div>
                  </div>
                </div>
              </div>
            ) : null}

            {runnersUp.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {runnersUp.map((t, idx) => {
                  const style = rankStyles[idx + 1] ?? {
                    ring: 'border-white/15 bg-white/10 text-white/80',
                    accent: 'from-white/8 via-white/3 to-transparent',
                    badge: 'text-white/80',
                    label: `#${idx + 2}`,
                  };

                  return (
                    <div
                      key={String(t.cid)}
                      className={`relative overflow-hidden rounded-2xl border px-4 py-4 ${style.ring}`}
                    >
                      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${style.accent}`} />
                      <div className="relative flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${style.badge}`}>
                            #{idx + 2}
                          </div>
                          <div className="mt-2 truncate text-lg font-semibold text-white">{t.name}</div>

                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-xl font-bold tabular-nums text-white">{formatHours(t.seconds)}</div>
                          <div className="mt-1 text-[11px] text-white/55">this month</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-4 text-sm text-white/70">
            <div className="font-semibold text-white/85">No controller time recorded yet.</div>
            <div className="mt-1 text-white/60">Once people start working positions this month, the leaderboard will populate automatically.</div>
          </div>
        )}
      </div>
    </div>
  );
}
