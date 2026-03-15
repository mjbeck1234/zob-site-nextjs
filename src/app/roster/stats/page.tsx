import PageShell from '@/components/PageShell';
import { getRoster } from '@/lib/content';
import { sql } from '@/lib/db';
import { rosterDisplayName } from '@/lib/names';
import { tableExists } from '@/lib/schema';
import Link from 'next/link';
import { Fragment } from 'react';

export const dynamic = 'force-dynamic';

type StatRow = {
  cid: string | number;
  key: string; // YYYY-MM
  seconds: number;
};

type TicketRow = {
  cid: string | number;
  key: string; // YYYY-MM
  total: number;
};

type MonthCell = {
  status: 'pass' | 'fail' | 'loa';
  text: string; // HH:MM | OBS | LOA
  seconds?: number;
  tickets?: number;
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function monthInfos(count = 3): Array<{
  year: number;
  month: number;
  monthName: string;
  yearStr: string;
  key: string;
  label: string;
  monthStart: string;
}> {
  const out: Array<{
    year: number;
    month: number;
    monthName: string;
    yearStr: string;
    key: string;
    label: string;
    monthStart: string;
  }> = [];

  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1; // 1-12
    const monthName = MONTH_NAMES[d.getUTCMonth()] ?? 'January';
    const yearStr = String(year);
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    out.push({ year, month, monthName, yearStr, key, label, monthStart });
  }
  return out;
}

function displayName(r: any): string {
  return rosterDisplayName(r);
}

function parseSeconds(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
  const s = String(v).trim();
  if (!s) return 0;

  // Common existing shapes:
  // - "12345" (seconds)
  // - "123.4" (hours)
  // - "HH:MM" or "HH:MM:SS"
  if (/^\d{1,4}:\d{2}(:\d{2})?$/.test(s)) {
    const parts = s.split(':').map((x) => Number(x));
    const hh = parts[0] || 0;
    const mm = parts[1] || 0;
    const ss = parts.length > 2 ? (parts[2] || 0) : 0;
    return Math.max(0, Math.floor(hh * 3600 + mm * 60 + ss));
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  // Heuristic: if someone stored fractional hours (e.g., 3.5), convert to seconds.
  // If it's a big integer, assume seconds.
  if (n > 0 && n < 200 && s.includes('.')) return Math.max(0, Math.floor(n * 3600));
  return Math.max(0, Math.floor(n));
}

function formatHHMM(seconds: number): string {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isYes(v: any): boolean {
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'yes' || s === 'y' || s === 'true' || s === '1';
}

function statusIcon(status: MonthCell['status']): { glyph: string; cls: string } {
  if (status === 'pass') return { glyph: '✓', cls: 'text-emerald-300' };
  if (status === 'loa') return { glyph: '✓', cls: 'text-amber-300' };
  return { glyph: '✕', cls: 'text-red-400' };
}

export default async function RosterStatsPage() {
  const months = monthInfos(3);

  const MINIMUM_HOURS = Math.max(0, Number(process.env.MINIMUM_HOURS ?? process.env.CONTROLLER_STATS_MIN_HOURS ?? '3') || 0);
  const MINIMUM_TICKETS = Math.max(0, Number(process.env.MINIMUM_TICKETS ?? process.env.CONTROLLER_STATS_MIN_TICKETS ?? '2') || 0);

  const hasStoredStats = await tableExists('stats').catch(() => false);
  const hasTickets = await tableExists('tickets').catch(() => false);
  const hasStats = hasStoredStats;

  // Match the main roster page: only include Home (prim) and Visiting (vis) controllers.
  const rosterAll = (await getRoster().catch(() => [])) as any[];
  const roster = rosterAll.filter((r) => {
    const t = String(r?.type ?? '').trim().toLowerCase();
    return t === 'prim' || t === 'vis';
  });

  const rosterByCid = new Map<string, any>();
  for (const r of roster) {
    const cid = String(r?.cid ?? '').trim();
    if (cid) rosterByCid.set(cid, r);
  }

  const cids = Array.from(rosterByCid.keys());

  let statRows: StatRow[] = [];

  if (cids.length && hasStoredStats) {
    // Existing dump: stats has { cid, minutes, rec_month (name), rec_year (string) }
    const whereParts: string[] = [];
    const params: any[] = [];
    months.forEach((m) => {
      whereParts.push('(rec_month = ? AND rec_year = ?)');
      params.push(m.monthName, m.yearStr);
    });

    // Restrict to just the roster cids so we don't scan huge existing stats tables.
    const cidQs = cids.map(() => '?').join(', ');
    const q = `SELECT cid, rec_month, rec_year, minutes FROM stats WHERE ((${whereParts.join(' OR ')})) AND cid IN (${cidQs})`;

    let rows: any[] = [];
    try {
      rows = (await sql.unsafe<any[]>(q, [...params, ...cids])) ?? [];
    } catch {
      rows = [];
    }

    statRows = rows
      .map((r) => {
        const monthName = String(r.rec_month ?? '').trim();
        const yearStr = String(r.rec_year ?? '').trim();
        const monthIdx = MONTH_NAMES.findIndex((x) => x.toLowerCase() === monthName.toLowerCase());
        if (monthIdx < 0) return null;
        const month = monthIdx + 1;
        const key = `${yearStr}-${String(month).padStart(2, '0')}`;
        return {
          cid: r.cid,
          key,
          seconds: parseSeconds(r.minutes) * 60,
        } as StatRow;
      })
      .filter(Boolean) as StatRow[];
  }

  // cid -> monthKey -> seconds
  const secsByCid = new Map<string, Map<string, number>>();
  for (const r of statRows) {
    const cid = String(r.cid ?? '').trim();
    const key = String(r.key ?? '').trim();
    const secs = parseSeconds(r.seconds);
    if (!cid) continue;
    const m = secsByCid.get(cid) ?? new Map<string, number>();
    m.set(key, (m.get(key) ?? 0) + secs);
    secsByCid.set(cid, m);
  }

  // OBS tickets: cid -> monthKey -> ticketCount
  const ticketsByCid = new Map<string, Map<string, number>>();
  const obsCids = roster
    .filter((r) => String(r?.rating ?? '').trim().toUpperCase() === 'OBS')
    .map((r) => String(r?.cid ?? '').trim())
    .filter(Boolean);

  if (hasTickets && obsCids.length) {
    for (const m of months) {
      let rows: any[] = [];
      try {
        rows =
          (await sql<any[]>`
            SELECT controller_cid AS cid, COUNT(*) AS total
            FROM tickets
            WHERE controller_cid IN ${sql.in(obsCids)}
              AND training_type != 'No Show'
              AND MONTH(\`date\`) = ${m.month}
              AND YEAR(\`date\`) = ${m.year}
            GROUP BY controller_cid
          `) ?? [];
      } catch {
        rows = [];
      }

      const key = m.key;
      for (const r of rows) {
        const cid = String(r.cid ?? '').trim();
        const total = Number(r.total) || 0;
        if (!cid) continue;
        const byMonth = ticketsByCid.get(cid) ?? new Map<string, number>();
        byMonth.set(key, total);
        ticketsByCid.set(cid, byMonth);
      }

      // Ensure OBS controllers without any tickets still show up as 0.
      for (const cid of obsCids) {
        const byMonth = ticketsByCid.get(cid) ?? new Map<string, number>();
        if (!byMonth.has(key)) byMonth.set(key, 0);
        ticketsByCid.set(cid, byMonth);
      }
    }
  }

  const QUARTER_GREEN_SECONDS = 3 * 60 * 60; // 3 hours across the last 3 months

  const viewRows = cids
    .map((cid) => {
      const r = rosterByCid.get(cid);
      const name = displayName(r) || `CID ${cid}`;
      const rating = String(r?.rating ?? '').trim() || '—';
      const active = isYes(r?.active);
      const byMonth = secsByCid.get(cid) ?? new Map<string, number>();
      const tickets = ticketsByCid.get(cid) ?? new Map<string, number>();

      const cells: MonthCell[] = months.map((m) => {
        const isObs = rating.toUpperCase() === 'OBS';
        if (!active) {
          return { status: 'loa', text: 'LOA' };
        }

        if (isObs) {
          const t = Number(tickets.get(m.key) ?? 0) || 0;
          return {
            status: t >= MINIMUM_TICKETS ? 'pass' : 'fail',
            text: 'OBS',
            tickets: t,
          };
        }

        const secs = parseSeconds(byMonth.get(m.key) ?? 0);
        const hours = secs / 3600;
        return {
          status: hours >= MINIMUM_HOURS ? 'pass' : 'fail',
          text: formatHHMM(secs),
          seconds: secs,
        };
      });

      const totalSeconds = cells.reduce((acc, c) => acc + (c.seconds ?? 0), 0);

      // Keep old ordering: last name, then first name.
      const last = String(r?.last_name ?? '').trim().toLowerCase();
      const first = String(r?.first_name ?? '').trim().toLowerCase();
      const sortKey = `${last}|${first}|${cid}`;

      return { cid, name, rating, active, cells, totalSeconds, sortKey };
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return (
    <PageShell
      title="Roster"
      subtitle="Controller statistics (current + previous 2 months)"
      crumbs={[{ href: '/', label: 'Home' }, { href: '/roster', label: 'Roster' }, { label: 'Controller Statistics' }]}
    >
      <div className="ui-card">
        <div className="ui-card__header">
          <div className="text-sm font-semibold text-white">Controller Statistics</div>
          <span className="ui-badge">Hours</span>
        </div>
        <div className="ui-card__body">
          {!hasStats ? (
            <div className="text-sm text-white/70">
              No existing controller statistics table was found in the database.
              <div className="mt-2 text-xs text-white/55">
                Expected table: <span className="font-mono text-white/80">stats</span>.
              </div>
            </div>
          ) : (
            <>
              <div className="mb-3 text-xs text-white/65">
                <span className="font-semibold text-white/80">Minimums:</span> {MINIMUM_HOURS}h per month (rated controllers), {MINIMUM_TICKETS} tickets (OBS).
                <span className="ml-2">Rows turn green at ≥ 3:00 total across these 3 months.</span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-white/80">
                      <th className="text-left py-2 pr-4" rowSpan={2}>Name</th>
                      <th className="text-center py-2 pr-4" rowSpan={2}>Rating</th>
                      <th className="text-left py-2 pr-4" rowSpan={2}>CID</th>
                      {months.map((m) => (
                        <th key={m.key} colSpan={2} className="text-center py-2 pr-4">{m.label}</th>
                      ))}
                      <th className="text-right py-2" rowSpan={2}>Total</th>
                    </tr>
                    <tr className="text-white/70">
                      {months.map((m) => (
                        <Fragment key={m.key}>
                          <th className="text-center py-2 pr-2">✓</th>
                          <th className="text-right py-2 pr-4">HH:MM</th>
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {viewRows.map((r) => (
                      <tr
                        key={r.cid}
                        className={`border-t border-white/10 ${r.totalSeconds >= QUARTER_GREEN_SECONDS ? 'bg-emerald-500/5 text-emerald-100' : 'text-white/75'}`}
                      >
                        <td className="py-2 pr-4">{r.name}</td>
                        <td className="py-2 pr-4 text-center font-mono">{r.rating}</td>
                        <td className="py-2 pr-4 font-mono">
                          <Link
                            href={`/roster?cid=${encodeURIComponent(String(r.cid))}`}
                            className={r.totalSeconds >= QUARTER_GREEN_SECONDS ? 'underline decoration-emerald-300/40 hover:decoration-emerald-300' : 'underline decoration-white/25 hover:decoration-white/60'}
                          >
                            {r.cid}
                          </Link>
                        </td>

                        {r.cells.map((c, idx) => {
                          const icon = statusIcon(c.status);
                          const isObs = r.rating.toUpperCase() === 'OBS';
                          const pass = c.status === 'pass';
                          const loa = c.status === 'loa';

                          const valueTitle = isObs
                            ? (loa ? 'LOA' : `${c.tickets ?? 0} tickets (min ${MINIMUM_TICKETS})`)
                            : (loa ? 'LOA' : `${(Number(c.seconds ?? 0) / 3600).toFixed(2)} hours`);

                          const valueCls = loa
                            ? 'text-white/80 font-semibold'
                            : pass
                              ? (r.totalSeconds >= QUARTER_GREEN_SECONDS ? 'text-emerald-200 font-semibold' : 'text-white/90 font-semibold')
                              : 'text-white/50';

                          return (
                            <Fragment key={`${r.cid}-${idx}`}>
                              <td className={`py-2 pr-2 text-center ${icon.cls}`} title={loa ? 'LOA' : pass ? 'Meets minimum' : 'Below minimum'}>
                                {icon.glyph}
                              </td>
                              <td className={`py-2 pr-4 text-right ${valueCls}`} title={valueTitle}>
                                {c.text}
                              </td>
                            </Fragment>
                          );
                        })}

                        <td className={`py-2 text-right font-semibold ${r.totalSeconds >= QUARTER_GREEN_SECONDS ? 'text-emerald-300' : 'text-white/85'}`}>
                          {formatHHMM(r.totalSeconds)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
