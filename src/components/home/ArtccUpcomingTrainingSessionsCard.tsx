import { fetchScheddyAllSessions, pickUpcomingSessions, getSessionTypeName, formatCountdown } from '@/lib/scheddy';
import { getRosterDisplayNameMapByCids } from '@/lib/roster';

import ArtccUpcomingTrainingSessionsCardClient, { type HomeTrainingSessionRow } from './ArtccUpcomingTrainingSessionsCardClient';

function fmtStart(start: string | undefined | null): { pretty: string; countdown: string } {
  if (!start) return { pretty: '—', countdown: '' };
  const d = new Date(String(start));
  if (Number.isNaN(d.getTime())) return { pretty: '—', countdown: '' };
  return {
    pretty: d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
    countdown: formatCountdown(new Date(), d),
  };
}

export default async function ArtccUpcomingTrainingSessionsCard() {
  let rows: any[] = [];
  let loadError = false;

  try {
    rows = await fetchScheddyAllSessions();
  } catch {
    loadError = true;
  }

  const upcoming = loadError ? [] : pickUpcomingSessions(rows, { limit: 25 });

  const cids: Array<string | number> = [];
  for (const r of upcoming) {
    const m = r?.session?.mentor;
    const s = r?.session?.student;
    if (m) cids.push(m);
    if (s) cids.push(s);
  }

  const nameMap = cids.length ? await getRosterDisplayNameMapByCids(cids, { fallbackToCid: true }) : ({} as Record<string, string>);

  const sessions: HomeTrainingSessionRow[] = upcoming.map((r) => {
    const id = String(r?.session?.id ?? r?.session?.start ?? Math.random());
    const start = fmtStart(r?.session?.start ?? null);
    const typeName = getSessionTypeName(r) || 'Training session';
    const mentorCid = String(r?.session?.mentor ?? '').trim();
    const studentCid = String(r?.session?.student ?? '').trim();
    const mentorName = mentorCid ? (nameMap[mentorCid] ?? mentorCid) : '—';
    const studentName = studentCid ? (nameMap[studentCid] ?? studentCid) : '—';

    return {
      id,
      startPretty: start.pretty,
      countdown: start.countdown,
      typeName,
      mentorName,
      studentName,
    };
  });

  return <ArtccUpcomingTrainingSessionsCardClient sessions={sessions} total={upcoming.length} loadError={loadError} />;
}
