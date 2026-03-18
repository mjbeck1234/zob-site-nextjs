import { sql } from '@/lib/db';
import { getRosterEntryByCid } from '@/lib/content';
import { tableExists } from '@/lib/schema';

export type TopController = {
  cid: number;
  name: string;
  callsign?: string | null;
  seconds: number;
};

function logControllerHoursFallback(context: string, error?: unknown) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[controller-hours] ${context}`, error);
  }
}

function monthNameUtc(d = new Date()): string {
  const names = [
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
  return names[d.getUTCMonth()] ?? 'January';
}

function yearUtc(d = new Date()): string {
  return String(d.getUTCFullYear());
}

export function formatHours(seconds: number): string {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

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

function quarterInfoUtc(d = new Date()): { year: number; quarter: 1 | 2 | 3 | 4; monthNames: string[] } {
  const year = d.getUTCFullYear();
  const quarter = (Math.floor(d.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  const startMonthIdx = (quarter - 1) * 3;

  const monthNames: string[] = [];
  for (let i = 0; i < 3; i++) {
    monthNames.push(MONTH_NAMES[startMonthIdx + i] ?? 'January');
  }
  return { year, quarter, monthNames };
}

export async function getUserControlledSecondsThisQuarter(cid: number): Promise<{ seconds: number; year: number; quarter: 1 | 2 | 3 | 4 }> {
  const { year, quarter, monthNames } = quarterInfoUtc();
  const safeCid = Number(cid);
  if (!Number.isFinite(safeCid)) return { seconds: 0, year, quarter };

  const hasStoredStats = await tableExists('stats').catch(() => false);
  if (!hasStoredStats) return { seconds: 0, year, quarter };

  try {
    const rows = await sql<Array<{ minutes: number | string | null }>>`
      SELECT COALESCE(SUM(minutes), 0) AS minutes
      FROM stats
      WHERE cid = ${String(safeCid)}
        AND rec_year = ${String(year)}
        AND rec_month IN ${sql.in(monthNames)}
    `;
    const minutes = Number(rows?.[0]?.minutes ?? 0) || 0;
    return { seconds: minutes * 60, year, quarter };
  } catch (error) {
    logControllerHoursFallback('existing stats quarter lookup failed; returning zero', error);
    return { seconds: 0, year, quarter };
  }
}

export async function getTopControllersThisMonth(limit = 3): Promise<TopController[]> {
  const hasStoredStats = await tableExists('stats').catch(() => false);
  if (!hasStoredStats) return [];

  const recMonth = monthNameUtc();
  const recYear = yearUtc();
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 3));

  let rows: any[] = [];
  try {
    rows = await sql<any[]>`
      SELECT cid, minutes
      FROM stats
      WHERE rec_month = ${recMonth} AND rec_year = ${recYear}
      ORDER BY minutes DESC
      LIMIT ${sql.unsafe(String(safeLimit))}
    `;
  } catch (error) {
    logControllerHoursFallback('existing stats month leaderboard lookup failed; returning empty leaderboard', error);
    rows = [];
  }

  const out: TopController[] = [];
  for (const r of rows) {
    const cid = Number(r.cid);
    const seconds = (Number(r.minutes) || 0) * 60;
    const roster = Number.isFinite(cid) ? await getRosterEntryByCid(cid) : undefined;
    const rosterName = roster ? [roster.first_name, roster.last_name].filter(Boolean).join(' ').trim() : '';
    const name = rosterName || `CID ${cid}`;
    out.push({ cid, name, callsign: null, seconds });
  }
  return out;
}

export const controllerHours = {};
