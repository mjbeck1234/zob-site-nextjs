import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { getEventAssignmentsForCidAcrossEvents, getEventSignupsForCidAcrossEvents } from '@/lib/events';

type AnyEvent = any;

const getMyEventRows = unstable_cache(
  async (cid: number, idsKey: string) => {
    const ids = idsKey
      .split(',')
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (!cid || !ids.length) return { signups: [], assignments: [] };

    const [signups, assignments] = await Promise.all([
      getEventSignupsForCidAcrossEvents(cid, ids),
      getEventAssignmentsForCidAcrossEvents(cid, ids),
    ]);

    return { signups: (signups as any[]) ?? [], assignments: (assignments as any[]) ?? [] };
  },
  ['home-my-events'],
  { revalidate: 60 }
);

export default async function MyEventsCards({ userCid, events, stack = false }: { userCid: number; events: AnyEvent[]; stack?: boolean }) {
  const upcomingIds = (Array.isArray(events) ? events : [])
    .map((e: any) => Number(e?.id))
    .filter((n) => Number.isFinite(n) && n > 0);

  const idsKey = upcomingIds.join(',');
  const { signups: mySignups, assignments: myAssignments } = await getMyEventRows(userCid, idsKey);

  const signupsByEvent = new Map<number, any[]>();
  for (const s of mySignups as any[]) {
    const eid = Number((s as any).event_id);
    if (!Number.isFinite(eid)) continue;
    if (!signupsByEvent.has(eid)) signupsByEvent.set(eid, []);
    signupsByEvent.get(eid)!.push(s);
  }

  const assignsByEvent = new Map<number, any[]>();
  for (const a of myAssignments as any[]) {
    const eid = Number((a as any).event_id);
    if (!Number.isFinite(eid)) continue;
    if (!assignsByEvent.has(eid)) assignsByEvent.set(eid, []);
    assignsByEvent.get(eid)!.push(a);
  }

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const endOfWindow = new Date(now);
  endOfWindow.setDate(endOfWindow.getDate() + 7);

  const normalizeStart = (e: any): Date | null => {
    const startVal = e?.start_time ?? e?.start_at ?? e?.start_date ?? e?.start ?? e?.date ?? null;
    if (!startVal) return null;
    const d = new Date(startVal);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const getTitle = (e: any) => String(e?.title ?? e?.name ?? e?.event_name ?? e?.event ?? 'Event');
  const fmtTime = (d: Date | null) => (d ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');

  const describeMySlots = (eventId: number) => {
    const assigns = assignsByEvent.get(eventId) ?? [];
    const prefs = signupsByEvent.get(eventId) ?? [];

    const assignedPos = assigns
      .map((x: any) => String(x.position_name ?? '').trim())
      .filter(Boolean);

    const prefPos = prefs
      .map((x: any) => String(x.position_name ?? '').trim())
      .filter(Boolean);

    if (assignedPos.length) return { label: 'Assigned', value: assignedPos.join(', ') };
    if (prefPos.length) return { label: 'Signed up', value: prefPos.join(', ') };
    return null;
  };

  const isMine = (eventId: number) => (assignsByEvent.get(eventId)?.length ?? 0) > 0 || (signupsByEvent.get(eventId)?.length ?? 0) > 0;

  const myToday = (Array.isArray(events) ? events : [])
    .filter((e: any) => {
      const eid = Number(e?.id);
      if (!Number.isFinite(eid)) return false;
      if (!isMine(eid)) return false;
      const d = normalizeStart(e);
      return d ? d >= startOfToday && d <= endOfToday : false;
    })
    .sort((a: any, b: any) => (normalizeStart(a)?.getTime() ?? 0) - (normalizeStart(b)?.getTime() ?? 0));

  const myNext7 = (Array.isArray(events) ? events : [])
    .filter((e: any) => {
      const eid = Number(e?.id);
      if (!Number.isFinite(eid)) return false;
      if (!isMine(eid)) return false;
      const d = normalizeStart(e);
      if (!d) return false;
      // Next 7 days, excluding today.
      return d > endOfToday && d <= endOfWindow;
    })
    .sort((a: any, b: any) => (normalizeStart(a)?.getTime() ?? 0) - (normalizeStart(b)?.getTime() ?? 0));

  // Only render this module if the user actually has an event today and/or within the next 7 days.
  if (!myToday.length && !myNext7.length) return null;

  return (
    <div className={stack ? "space-y-6" : "grid gap-6 md:grid-cols-2"}>
      {myToday.length ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-white">Today</div>
              <div className="text-xs text-white/55">Your event(s) today</div>
            </div>
            <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border border-white/15 bg-white/10 px-2 text-xs font-semibold text-white/85">
              {myToday.length}
            </span>
          </div>
          <div className="px-5 py-4">
            <div className="space-y-3">
              {myToday.slice(0, 3).map((e: any) => {
                const eid = Number(e?.id);
                const start = normalizeStart(e);
                const title = getTitle(e);
                const slots = describeMySlots(eid);
                return (
                  <Link
                    key={`today-${String(eid)}`}
                    href={eid ? `/events/${eid}` : '/events'}
                    className="block rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 hover:bg-white/[0.04] transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">{title}</div>
                        {slots ? (
                          <div className="mt-1 text-xs text-white/55">
                            <span className="font-semibold text-white/75">{slots.label}:</span> {slots.value}
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-xs text-white/60 tabular-nums">{fmtTime(start)}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="mt-4">
              <Link href="/events" className="text-sm font-semibold text-amber-200/90 hover:text-amber-200">
                View all events →
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {myNext7.length ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-white">This week</div>
              <div className="text-xs text-white/55">Next 7 days</div>
            </div>
            <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border border-white/15 bg-white/10 px-2 text-xs font-semibold text-white/85">
              {myNext7.length}
            </span>
          </div>
          <div className="px-5 py-4">
            <div className="space-y-3">
              {myNext7.slice(0, 4).map((e: any) => {
                const eid = Number(e?.id);
                const start = normalizeStart(e);
                const title = getTitle(e);
                const slots = describeMySlots(eid);
                const when = start ? start.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '';
                return (
                  <Link
                    key={`wk-${String(eid)}`}
                    href={eid ? `/events/${eid}` : '/events'}
                    className="block rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 hover:bg-white/[0.04] transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">{title}</div>
                        {slots ? (
                          <div className="mt-1 text-xs text-white/55">
                            <span className="font-semibold text-white/75">{slots.label}:</span> {slots.value}
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-xs text-white/60 tabular-nums">{when}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="mt-4">
              <Link href="/events" className="text-sm font-semibold text-amber-200/90 hover:text-amber-200">
                View all events →
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
