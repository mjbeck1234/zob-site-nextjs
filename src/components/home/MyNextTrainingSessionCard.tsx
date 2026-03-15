import Link from 'next/link';
import { fetchScheddyUserSessions, pickNextUpcomingSession, formatCountdown, formatPerson, getSessionTypeName } from '@/lib/scheddy';
import { getRosterDisplayNameByCid } from '@/lib/roster';

export default async function MyNextTrainingSessionCard({ userCid }: { userCid: number }) {
  try {
    const rows = await fetchScheddyUserSessions(userCid);
    const next = pickNextUpcomingSession(rows);
    if (!next) return null;

    const startStr = next.session?.start ? String(next.session.start) : null;
    const start = startStr ? new Date(startStr) : null;
    const startOk = start && !Number.isNaN(start.getTime()) ? start : null;
    const mentorCid = Number(next.session?.mentor ?? (next.mentor as any)?.id ?? 0);
    const mentorFromRoster = mentorCid ? await getRosterDisplayNameByCid(mentorCid, { fallbackToCid: true }) : '';
    const mentorName = mentorFromRoster && mentorFromRoster !== String(mentorCid) ? mentorFromRoster : (mentorFromRoster || formatPerson(next.mentor) || String(mentorCid || '—'));

    // This card is shown for the logged-in user; treat the student as "You" for clarity.
    const studentName = 'You';
    const typeName = getSessionTypeName(next);

    const startPretty = startOk ? startOk.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
    const countdown = startOk ? formatCountdown(new Date(), startOk) : '';

    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-white">Next training session</div>
            <div className="text-xs text-white/55">From Scheddy</div>
          </div>
          {countdown ? (
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
              {countdown}
            </span>
          ) : null}
        </div>

        <div className="px-5 py-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
            <div className="text-sm font-semibold text-white">{startPretty}</div>
            <div className="mt-1 text-xs text-white/60">
              {typeName ? (
                <>
                  <span className="font-semibold text-white/75">Type:</span> {typeName}
                </>
              ) : (
                <span>Training session</span>
              )}
            </div>
            <div className="mt-2 text-xs text-white/60">
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/55">Mentor</span>
                <span className="font-semibold text-white/80 truncate">{mentorName}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-white/55">Student</span>
                <span className="font-semibold text-white/80 truncate">{studentName}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Link
              href="https://scheddy.clevelandcenter.org"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 backdrop-blur hover:bg-white/[0.14] hover:text-white"
            >
              Open Scheddy →
            </Link>
            <Link
              href="/learning"
              className="text-sm font-semibold text-amber-200/90 hover:text-amber-200"
            >
              Learning Center
            </Link>
          </div>
        </div>
      </div>
    );
  } catch {
    // If Scheddy is unavailable/misconfigured, we hide the card rather than breaking Home.
    return null;
  }
}
