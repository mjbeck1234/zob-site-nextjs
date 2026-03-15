import Link from 'next/link';

import HomeBackdrop from '@/components/home/HomeBackdrop';
import ArtccUpcomingTrainingSessionsCard from '@/components/home/ArtccUpcomingTrainingSessionsCard';
import LiveFreshness from '@/components/home/LiveFreshness';
import MyQuarterControlTimeCard from '@/components/home/MyQuarterControlTimeCard';
import MyNextTrainingSessionCard from '@/components/home/MyNextTrainingSessionCard';
import MyEventsCards from '@/components/home/MyEventsCards';
import OnlineNowKneeboardClient, { type OnlineNowKneeboardPosition } from '@/components/home/OnlineNowKneeboardClient';
import TopControllersThisMonthCard from '@/components/home/TopControllersThisMonthCard';

import { getUser } from '@/lib/auth/getUser';
import { canManageTrainingTickets } from '@/lib/auth/permissions';
import { getUpcomingEvents } from '@/lib/content';
import { getMajorAirportTrafficCounts, getZobControllersOnline } from '@/lib/vatsim';
import { fetchMetarNoaa, type FlightCategory, type MetarInfo } from '@/lib/metar';

type AnyEvent = any;

type AirportCardSpec = {
  icao: string;
  label: string;
  city: string;
};

type AirportSnapshot = AirportCardSpec & {
  dep: number;
  arr: number;
  total: number;
  cat: FlightCategory | null;
  vis: string;
  ceil: string;
  wind: string;
  alt: string;
};

const MAJOR: AirportCardSpec[] = [
  { icao: 'KCLE', label: 'Cleveland Hopkins', city: 'Cleveland' },
  { icao: 'KPIT', label: 'Pittsburgh Intl', city: 'Pittsburgh' },
  { icao: 'KBUF', label: 'Buffalo Niagara', city: 'Buffalo' },
  { icao: 'KDTW', label: 'Detroit Metro', city: 'Detroit' },
];

function categoryBadgeClass(cat: FlightCategory | null): string {
  switch (cat) {
    case 'VFR':
      return 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100';
    case 'MVFR':
      return 'border-sky-300/30 bg-sky-400/10 text-sky-100';
    case 'IFR':
      return 'border-amber-300/30 bg-amber-400/10 text-amber-100';
    case 'LIFR':
      return 'border-rose-300/30 bg-rose-400/10 text-rose-100';
    default:
      return 'border-white/15 bg-white/10 text-white/80';
  }
}

function formatEventWhen(e: any): { date: string; time: string } {
  const startVal = e?.start_time ?? e?.start_at ?? e?.start_date ?? e?.start ?? e?.date ?? null;
  const d = startVal ? new Date(startVal) : null;
  if (!d || Number.isNaN(d.getTime())) return { date: '', time: '' };
  return {
    date: d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  };
}

function titleForEvent(e: any): string {
  return String(e?.title ?? e?.name ?? e?.event_name ?? e?.event ?? 'Event');
}

function bannerUrlForEvent(e: any): string | null {
  const bannerRaw = e?.banner_path ? String(e.banner_path) : null;
  if (!bannerRaw) return null;
  if (bannerRaw.startsWith('http://') || bannerRaw.startsWith('https://') || bannerRaw.startsWith('/')) return bannerRaw;
  return `/${bannerRaw.replace(/^\.\/?/, '')}`;
}

function totalFlightsAcrossMajors(trafficCounts: any[]): { dep: number; arr: number; total: number } {
  let dep = 0;
  let arr = 0;
  for (const t of trafficCounts ?? []) {
    dep += Number(t?.departures ?? 0) || 0;
    arr += Number(t?.arrivals ?? 0) || 0;
  }
  return { dep, arr, total: dep + arr };
}

function fmtVis(m: MetarInfo | null | undefined): string {
  const vis = m?.visibilitySm;
  if (vis == null) return '—';
  const raw = String(m?.raw ?? '');
  if (raw.toUpperCase().includes('P6SM') && vis === 6) return '6+SM';
  return `${vis}SM`;
}

function fmtCeil(m: MetarInfo | null | undefined): string {
  const c = m?.ceilingFt;
  if (c == null) return '—';
  if (c >= 99900) return '—';
  if (c >= 1000) return `${Math.round(c / 1000)}k`;
  return `${c}`;
}

function extractWind(raw: string | null | undefined): string {
  const up = String(raw ?? '').toUpperCase();
  const m = up.match(/\b(\d{3}|VRB)(\d{2,3})(G\d{2,3})?KT\b/);
  if (!m) return '—';
  const dir = m[1];
  const spd = m[2];
  const gust = m[3] ? m[3].slice(1) : '';
  return gust ? `${dir}${spd}G${gust}` : `${dir}${spd}`;
}

function extractAlt(raw: string | null | undefined): string {
  const up = String(raw ?? '').toUpperCase();
  const m = up.match(/\bA(\d{4})\b/);
  if (!m) return '—';
  const v = m[1];
  return `${v.slice(0, 2)}.${v.slice(2)}`;
}

function shortIcao(icao: string): string {
  return String(icao ?? '').toUpperCase().replace(/^K/, '');
}

function nextEventLabel(events: AnyEvent[]): string {
  const e = events?.[0];
  if (!e) return '—';
  const when = formatEventWhen(e);
  return when.date || 'Scheduled';
}

function SmallStat(props: { label: string; value: string; hint?: string; pill?: string; pillClassName?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-white/55">{props.label}</div>
          <div className="mt-1 text-xl font-extrabold text-white tabular-nums">{props.value}</div>
          {props.hint ? <div className="mt-0.5 text-[11px] text-white/55">{props.hint}</div> : null}
        </div>
        {props.pill ? (
          <span className={props.pillClassName ?? 'inline-flex items-center rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80'}>
            {props.pill}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TopBar(props: { showControllerHome: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white/85 backdrop-blur">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-300" />
        Cleveland ARTCC (ZOB)
        <span className="text-white/50">•</span>
        <span className="text-white/70">{props.showControllerHome ? 'kneeboard' : 'live dashboard'}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {props.showControllerHome ? (
          <Link
            href="/ids"
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white/90 backdrop-blur hover:bg-white/[0.14] hover:text-white"
          >
            Open IDS
          </Link>
        ) : (
          <>
            <Link
              href="/pilot/ramp"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white/90 backdrop-blur hover:bg-white/[0.14] hover:text-white"
            >
              Ramp Gate Selection
            </Link>
            <Link href="/events" className="text-xs font-semibold text-amber-200/90 hover:text-amber-200">
              Events
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function EventsPanel(props: { events: AnyEvent[]; columnsClassName: string; emptyMode: 'controller' | 'pilot' }) {
  const { events, columnsClassName, emptyMode } = props;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <div className="text-sm font-semibold text-white">What’s coming up</div>
          <div className="mt-1 text-xs text-white/55">Events (next 6)</div>
        </div>
        <Link href="/events" className="text-sm font-semibold text-amber-200/90 hover:text-amber-200">
          View all →
        </Link>
      </div>

      <div className="px-5 py-5">
        {Array.isArray(events) && events.length ? (
          <div className={columnsClassName}>
            {events.slice(0, 6).map((e: any) => {
              const eid = Number(e?.id);
              const when = formatEventWhen(e);
              const banner = bannerUrlForEvent(e);
              return (
                <Link
                  key={String(eid || titleForEvent(e))}
                  href={eid ? `/events/${eid}` : '/events'}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition"
                >
                  <div className="aspect-[16/9] w-full overflow-hidden bg-white/[0.03]">
                    {banner ? (
                      <img
                        src={banner}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/[0.05] to-white/[0.01] text-xs font-semibold text-white/60">
                        EVENT
                      </div>
                    )}
                  </div>

                  <div className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{titleForEvent(e)}</div>
                        <div className="mt-1 truncate text-[11px] text-white/55">{when.date || '—'}</div>
                      </div>
                      <div className="shrink-0 text-[11px] text-white/60 tabular-nums">{when.time || ''}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-4 text-sm text-white/70">
            <div className="font-semibold text-white/85">No upcoming events posted yet.</div>
            <div className="mt-1 text-white/60">
              {emptyMode === 'controller'
                ? 'Quiet calendar for now — a good time to train, mentor, or prep the next event push.'
                : 'Nothing published yet — check pilot resources for great fields, routes, and briefing notes in the meantime.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PilotWhyFlySection(props: { mostStaffed: AirportCardSpec | undefined; bestWeather: AirportCardSpec | undefined; staffingCount: number; bestWeatherCat: FlightCategory | null }) {
  return (
    <div className="px-5 pb-5 pt-4">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/55">Pilot briefing</div>
            <div className="mt-1 text-lg font-semibold text-white">Why fly ZOB?</div>
            <div className="mt-2 max-w-3xl text-sm text-white/60">
              ZOB is one of the best places on VATSIM for quick hub hops, dense handoffs, and realistic traffic across the Midwest and East Coast.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/pilot/resources" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white/85 hover:bg-white/[0.06]">
              Full pilot briefing
            </Link>
            <Link href="/routing" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white/85 hover:bg-white/[0.06]">
              Preferred routes
            </Link>
            <Link href="/splits" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white/85 hover:bg-white/[0.06]">
              Active splits
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/55">Popular hubs</div>
            <div className="mt-2 text-sm text-white/75">Detroit, Cleveland, Pittsburgh, and Buffalo give you busy Class B/C flying without needing a coast-to-coast leg.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/55">Best staffed right now</div>
            <div className="mt-2 text-base font-semibold text-white">{props.mostStaffed ? `${shortIcao(props.mostStaffed.icao)} • ${props.mostStaffed.city}` : 'Watch for staffed pushes'}</div>
            <div className="mt-1 text-sm text-white/60">{props.mostStaffed ? `${props.staffingCount} positions online at that field.` : 'When controllers sign on, it usually starts at the majors.'}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/55">Smoothest weather</div>
            <div className="mt-2 text-base font-semibold text-white">{props.bestWeather ? `${shortIcao(props.bestWeather.icao)} • ${props.bestWeather.city}` : 'Check the majors'}</div>
            <div className="mt-1 text-sm text-white/60">{props.bestWeather ? `Currently ${props.bestWeatherCat ?? 'flyable'} and usually a great first stop.` : 'A quick glance at the majors helps you pick the easiest launch.'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  let user: any = undefined;
  try {
    user = await getUser();
  } catch {
    user = undefined;
  }

  const mt = String(user?.memberType ?? '').trim().toLowerCase();
  const hasExplicitPilotRole = Boolean((user?.roles ?? []).some((r: string) => String(r).trim().toLowerCase() === 'pilot'));
  const isHomeOrVisiting = Boolean(
    user?.isZobMember && (mt === 'home' || mt === 'visiting' || mt === 'prim' || mt === 'vis' || mt === '')
  );
  const showControllerHome = isHomeOrVisiting && !hasExplicitPilotRole;
  const showArtccSessions = Boolean(user && canManageTrainingTickets(user));
  const snapshotIso = new Date().toISOString();

  const [onlineControllers, trafficCounts, metars, upcomingEvents] = await Promise.all([
    getZobControllersOnline().catch(() => [] as any[]),
    getMajorAirportTrafficCounts(MAJOR.map((m) => m.icao)).catch(() => [] as any[]),
    Promise.all(MAJOR.map((m) => fetchMetarNoaa(m.icao))).catch(() => [] as any[]),
    getUpcomingEvents(10).catch(() => [] as AnyEvent[]),
  ]);

  const trafficMap = new Map<string, any>();
  for (const t of trafficCounts as any[]) {
    const icao = String(t?.airport ?? '').toUpperCase();
    if (!icao) continue;
    trafficMap.set(icao, t);
  }

  const metarMap = new Map<string, MetarInfo>();
  for (const m of metars as any[]) {
    const icao = String(m?.icao ?? '').toUpperCase();
    if (!icao) continue;
    metarMap.set(icao, m as MetarInfo);
  }

  const onlinePositions: OnlineNowKneeboardPosition[] = Array.isArray(onlineControllers)
    ? (onlineControllers as any[]).map((c) => ({
        cid: Number(c?.cid ?? 0) || undefined,
        callsign: String(c?.callsign ?? '').trim(),
        controllerName: String(c?.name ?? c?.controllerName ?? '').trim(),
        frequency: String(c?.frequency ?? '').trim(),
      }))
    : [];

  const flights = totalFlightsAcrossMajors(trafficCounts as any[]);
  const nextEvent = nextEventLabel(upcomingEvents as AnyEvent[]);

  const facPrefixFromIcao = (icao: string) => `${shortIcao(icao).slice(0, 3)}_`;
  const atcByFacility = new Map<string, number>();
  for (const p of onlinePositions) {
    const cs = String(p.callsign ?? '').toUpperCase();
    const fac = cs.slice(0, 4);
    if (!fac) continue;
    atcByFacility.set(fac, (atcByFacility.get(fac) ?? 0) + 1);
  }

  const flightsFor = (icao: string): { dep: number; arr: number; total: number } => {
    const t = trafficMap.get(String(icao ?? '').toUpperCase());
    const dep = Number(t?.departures ?? 0) || 0;
    const arr = Number(t?.arrivals ?? 0) || 0;
    return { dep, arr, total: dep + arr };
  };

  const catRank: Record<string, number> = { VFR: 1, MVFR: 2, IFR: 3, LIFR: 4 };

  const bestWeather = [...MAJOR]
    .map((a) => ({ a, cat: metarMap.get(a.icao)?.category ?? null }))
    .filter((x) => x.cat)
    .sort((x, y) => (catRank[String(x.cat)] ?? 999) - (catRank[String(y.cat)] ?? 999))[0]?.a;

  const mostStaffedPick = [...MAJOR]
    .map((a) => ({ a, n: atcByFacility.get(facPrefixFromIcao(a.icao)) ?? 0 }))
    .sort((x, y) => y.n - x.n)[0];
  const mostStaffed = mostStaffedPick && mostStaffedPick.n > 0 ? mostStaffedPick.a : undefined;

  const snapshots: AirportSnapshot[] = MAJOR.map((a) => {
    const traffic = trafficMap.get(a.icao);
    const metar = metarMap.get(a.icao);
    const dep = Number(traffic?.departures ?? 0) || 0;
    const arr = Number(traffic?.arrivals ?? 0) || 0;
    return {
      ...a,
      dep,
      arr,
      total: dep + arr,
      cat: metar?.category ?? null,
      vis: fmtVis(metar),
      ceil: fmtCeil(metar),
      wind: extractWind(metar?.raw ?? null),
      alt: extractAlt(metar?.raw ?? null),
    };
  });

  const featuredPilotEvent: any = !showControllerHome && Array.isArray(upcomingEvents) && upcomingEvents.length
    ? ((upcomingEvents as any[]).find((x: any) => {
        const host = String(x?.host ?? '').trim();
        return !host || host.toUpperCase().includes('ZOB');
      }) ?? upcomingEvents[0])
    : null;

  return (
    <div className="relative min-h-screen">
      <HomeBackdrop />

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-20">
        <TopBar showControllerHome={showControllerHome} />

        <div className="mt-5 grid items-start gap-4 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold leading-tight text-white md:text-3xl">
                    {showControllerHome ? 'Airspace kneeboard' : 'Pilot flight planner'}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-white/60 md:text-base">
                    {showControllerHome
                      ? 'A dense snapshot of traffic, events, and major-field weather for your next session.'
                      : 'Plan a smooth flight through ZOB using live traffic, weather, and quick pilot tools.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                    Live
                  </span>
                  <LiveFreshness sinceIso={snapshotIso} prefix="Updated" className="text-xs text-white/50" />
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SmallStat label="Flights (majors)" value={String(flights.total)} hint={`${flights.dep} dep • ${flights.arr} arr`} />
                <SmallStat
                  label={showControllerHome ? 'Upcoming events' : 'ATC online'}
                  value={showControllerHome ? String(Array.isArray(upcomingEvents) ? upcomingEvents.length : 0) : String(onlinePositions.length)}
                  hint={showControllerHome ? (nextEvent !== '—' ? `Next: ${nextEvent}` : 'No events posted yet') : 'Across ZOB'}
                />
              </div>

              {!showControllerHome ? (
                <>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-xs font-semibold text-white/60">Popular hubs</div>
                      <div className="mt-2 text-sm font-semibold text-white">DTW • CLE • PIT • BUF</div>
                      <div className="mt-1 text-xs text-white/60">Great for quick hops, hub ops, and event flying.</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-xs font-semibold text-white/60">Most staffed right now</div>
                      <div className="mt-2 text-sm font-semibold text-white">{mostStaffed ? `${shortIcao(mostStaffed.icao)} • ${mostStaffed.city}` : 'Watch the majors'}</div>
                      <div className="mt-1 text-xs text-white/60">
                        {mostStaffed ? `${atcByFacility.get(facPrefixFromIcao(mostStaffed.icao)) ?? 0} positions online there` : 'Controllers usually start at the majors.'}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-xs font-semibold text-white/60">Best weather</div>
                      <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                        <span>{bestWeather ? `${shortIcao(bestWeather.icao)} • ${bestWeather.city}` : 'Check the majors'}</span>
                      </div>
                      <div className="mt-1 text-xs text-white/60">
                        {bestWeather ? `Currently ${String(metarMap.get(bestWeather.icao)?.category ?? '—')}` : 'Use the briefing for the best planning cues.'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <Link href="/pilot/ramp" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-semibold text-white/85 hover:bg-white/[0.06]">
                      Gate reservations
                    </Link>
                    <Link href="/pilot/resources" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-semibold text-white/85 hover:bg-white/[0.06]">
                      Pilot briefing
                    </Link>
                    <Link href="/events" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-semibold text-white/85 hover:bg-white/[0.06]">
                      Events
                    </Link>
                    <Link href="/feedback" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-semibold text-white/85 hover:bg-white/[0.06]">
                      Leave feedback
                    </Link>
                  </div>
                </>
              ) : null}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div>
                  <div className="text-sm font-semibold text-white">Major airports</div>
                  <div className="mt-1 text-xs text-white/55">Dep/arr from VATSIM • METAR from NOAA • mobile-friendly snapshot</div>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/55">
                  <span>{showControllerHome ? 'Tap a field to jump into IDS' : 'Vis + ceiling drives category'}</span>
                  <LiveFreshness sinceIso={snapshotIso} prefix="Refreshed" />
                </div>
              </div>

              <div className="space-y-4 px-5 py-4">
                <div className="grid gap-3 md:hidden">
                  {snapshots.map((a) => {
                    const mobileBody = (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white">{a.icao}</div>
                            <div className="mt-0.5 truncate text-[11px] text-white/55">{a.label} — {a.city}</div>
                          </div>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${categoryBadgeClass(a.cat)}`}>
                            {a.cat ?? '—'}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/70">
                          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">Dep <span className="font-semibold text-white/90">{a.dep}</span></div>
                          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">Arr <span className="font-semibold text-white/90">{a.arr}</span></div>
                          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">Vis/Ceil <span className="font-semibold text-white/90">{a.vis} / {a.ceil}</span></div>
                          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">Wind/Alt <span className="font-semibold text-white/90">{a.wind} • {a.alt}</span></div>
                        </div>
                      </div>
                    );
                    return showControllerHome ? (
                      <Link key={a.icao} href={`/ids?tab=airport&airport=${encodeURIComponent(a.icao)}`} className="block">{mobileBody}</Link>
                    ) : (
                      <div key={a.icao}>{mobileBody}</div>
                    );
                  })}
                </div>

                <div className="hidden md:block rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                  <div className="grid grid-cols-6 gap-0 border-b border-white/10 bg-white/[0.02] text-[11px] font-semibold text-white/65">
                    <div className="px-3 py-2">Field</div>
                    <div className="px-3 py-2">Cat</div>
                    <div className="px-3 py-2">Dep</div>
                    <div className="px-3 py-2">Arr</div>
                    <div className="px-3 py-2">Vis/Ceil</div>
                    <div className="px-3 py-2">Wind/Alt</div>
                  </div>
                  {snapshots.map((a) => {
                    const rowInner = (
                      <div className="grid grid-cols-6 gap-0 text-[11px] text-white/70">
                        <div className="px-3 py-2">
                          <div className="font-semibold text-white/85">{a.icao}</div>
                          <div className="mt-0.5 truncate text-[10px] text-white/50">{a.label} — {a.city}</div>
                        </div>
                        <div className="px-3 py-2">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${categoryBadgeClass(a.cat)}`}>
                            {a.cat ?? '—'}
                          </span>
                        </div>
                        <div className="px-3 py-2 tabular-nums">{a.dep}</div>
                        <div className="px-3 py-2 tabular-nums">{a.arr}</div>
                        <div className="px-3 py-2 tabular-nums">{a.vis} / {a.ceil}</div>
                        <div className="px-3 py-2 tabular-nums">{a.wind} • {a.alt}</div>
                      </div>
                    );
                    return showControllerHome ? (
                      <Link key={a.icao} href={`/ids?tab=airport&airport=${encodeURIComponent(a.icao)}`} className="block border-b border-white/10 transition hover:bg-white/[0.03] last:border-b-0">
                        {rowInner}
                      </Link>
                    ) : (
                      <div key={a.icao} className="border-b border-white/10 last:border-b-0">{rowInner}</div>
                    );
                  })}
                </div>
              </div>

              {!showControllerHome ? (
                <PilotWhyFlySection
                  mostStaffed={mostStaffed}
                  staffingCount={mostStaffed ? (atcByFacility.get(facPrefixFromIcao(mostStaffed.icao)) ?? 0) : 0}
                  bestWeather={bestWeather}
                  bestWeatherCat={bestWeather ? (metarMap.get(bestWeather.icao)?.category ?? null) : null}
                />
              ) : null}
            </div>

            {showControllerHome ? <TopControllersThisMonthCard /> : null}
            {showControllerHome ? <EventsPanel events={upcomingEvents as AnyEvent[]} columnsClassName="grid gap-4 md:grid-cols-2" emptyMode="controller" /> : null}
          </div>

          <div className="space-y-4 lg:col-span-4 lg:sticky lg:top-20">
            <OnlineNowKneeboardClient
              positions={onlinePositions}
              currentCid={user?.cid ? Number(user.cid) : null}
              ctaHref={showControllerHome ? '/ids' : undefined}
              ctaLabel={showControllerHome ? 'IDS' : undefined}
              secondaryHref={showControllerHome ? '/ids' : '/pilot/resources'}
              secondaryLabel={showControllerHome ? 'Go to IDS' : 'Pilot resources'}
              showNames={!showControllerHome}
              emptyMode={showControllerHome ? 'controller' : 'pilot'}
              lastUpdatedIso={snapshotIso}
            />

            {!showControllerHome && featuredPilotEvent ? (() => {
              const e = featuredPilotEvent;
              const eid = Number(e?.id);
              const when = formatEventWhen(e);
              const banner = bannerUrlForEvent(e);
              return (
                <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur">
                  <div className="border-b border-white/10 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-white/55">Featured event</div>
                        <div className="mt-1 truncate text-sm font-semibold text-white">{titleForEvent(e)}</div>
                      </div>
                      <Link href="/events" className="text-xs font-semibold text-amber-200/90 hover:text-amber-200">All events →</Link>
                    </div>
                    <div className="mt-1 text-xs text-white/55">{when.date ? `${when.date}${when.time ? ` • ${when.time}` : ''}` : '—'}</div>
                  </div>
                  <Link href={eid ? `/events/${eid}` : '/events'} className="group block">
                    <div className="aspect-[16/9] w-full overflow-hidden bg-white/[0.03]">
                      {banner ? (
                        <img src={banner} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" decoding="async" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/[0.05] to-white/[0.01] text-xs font-semibold text-white/60">EVENT</div>
                      )}
                    </div>
                    <div className="px-5 py-4">
                      <div className="line-clamp-2 text-sm text-white/70">{String(e?.description ?? e?.summary ?? '').trim() || 'Tap to view details and pilot/controller info.'}</div>
                      <div className="mt-3 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white/85 backdrop-blur hover:bg-white/[0.14] hover:text-white">View details →</div>
                    </div>
                  </Link>
                </div>
              );
            })() : null}

            {showControllerHome && user?.cid ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <MyQuarterControlTimeCard userCid={Number(user.cid)} />
                <MyNextTrainingSessionCard userCid={Number(user.cid)} />
              </div>
            ) : null}

            {showArtccSessions ? <ArtccUpcomingTrainingSessionsCard /> : null}
            {showControllerHome && Array.isArray(upcomingEvents) && upcomingEvents.length && user?.cid ? <MyEventsCards userCid={Number(user.cid)} events={upcomingEvents} stack /> : null}
          </div>
        </div>

        {!showControllerHome ? (
          <>
            <div className="mt-4">
              <TopControllersThisMonthCard />
            </div>
            <div className="mt-4">
              <EventsPanel events={upcomingEvents as AnyEvent[]} columnsClassName="grid gap-4 md:grid-cols-2 xl:grid-cols-3" emptyMode="pilot" />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
