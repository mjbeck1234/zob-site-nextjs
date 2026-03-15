import { getUserControlledSecondsThisQuarter, formatHours } from '@/lib/controllerHours';

export default async function MyQuarterControlTimeCard({ userCid }: { userCid: number }) {
  const MIN_HOURS = Math.max(0, Number(process.env.CONTROLLER_QUARTER_MIN_HOURS ?? '3') || 0);
  const MIN_SECONDS = MIN_HOURS * 3600;

  const { seconds, year, quarter } = await getUserControlledSecondsThisQuarter(userCid);
  const metGoal = seconds === MIN_SECONDS;
  const exceededGoal = seconds > MIN_SECONDS;
  const meets = seconds >= MIN_SECONDS;
  const pct = MIN_SECONDS > 0 ? Math.min(1, seconds / MIN_SECONDS) : 0;
  const overGoalSeconds = Math.max(0, seconds - MIN_SECONDS);

  const badgeCls = meets
    ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
    : 'border-red-300/25 bg-red-400/10 text-red-100';

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <div className="text-sm font-semibold text-white">Control time this quarter</div>
          <div className="mt-1 text-xs text-white/65">Q{quarter} {year}</div>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${badgeCls}`}>
          <span className={`h-2 w-2 rounded-full ${meets ? 'bg-emerald-300' : 'bg-red-300'}`} />
          {exceededGoal ? `Above ${MIN_HOURS.toFixed(0)}h goal` : metGoal ? 'Goal met' : `Below ${MIN_HOURS.toFixed(0)}h`}
        </span>
      </div>

      <div className="px-5 py-4">
        <div className="text-2xl font-extrabold tracking-tight text-white tabular-nums">{formatHours(seconds)}</div>
        <div className="mt-3 h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full ${meets ? 'bg-emerald-400/80' : 'bg-red-400/80'}`}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-white/60">
          {exceededGoal ? `Exceeded goal by ${formatHours(overGoalSeconds)}` : `Goal: ${MIN_HOURS.toFixed(0)}h`}
        </div>
      </div>
    </div>
  );
}
