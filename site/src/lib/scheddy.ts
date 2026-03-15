export type ScheddyUserSession = {
  session?: {
    id?: string;
    mentor?: number;
    student?: number;
    type?: any;
    start?: string;
    timezone?: string;
    cancelled?: boolean;
  };
  mentor?: { id?: number; firstName?: string; lastName?: string; first_name?: string; last_name?: string; name?: string };
  student?: { id?: number; firstName?: string; lastName?: string; first_name?: string; last_name?: string; name?: string };
  // Older deployments used `type`, newer ones use `sessionType`.
  type?: { id?: string; name?: string };
  sessionType?: { id?: string; name?: string; category?: string; length?: number; rating?: number; bookable?: boolean };
};

export type ScheddyAllSession = ScheddyUserSession;

function getScheddyKey(): string | null {
  const v = process.env.SCHEDDY_API_MASTER_KEY;
  if (!v) return null;
  const s = String(v).trim();
  return s ? s : null;
}

async function fetchScheddy<T = any>(url: string): Promise<T> {
  const key = getScheddyKey();
  if (!key) {
    throw new Error('Missing SCHEDDY_API_MASTER_KEY environment variable.');
  }

  const res = await fetch(url, {
    headers: {
      // Different deployments use different header conventions; we send both.
      'x-api-key': key,
      Authorization: `Bearer ${key}`,
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`Scheddy API request failed: ${res.status}`);
  }

  return (await res.json()) as T;
}

function normalizeScheddyArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    for (const k of ['sessions', 'items', 'rows', 'data', 'result', 'results']) {
      const v = (data as any)[k];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}


export async function fetchScheddyUserSessions(cid: number): Promise<ScheddyUserSession[]> {
  const url = `https://scheddy.clevelandcenter.org/api/userSessions/${cid}`;

  const data = (await fetchScheddy<any>(url)) as any;
  return normalizeScheddyArray(data) as ScheddyUserSession[];
}

export async function fetchScheddyAllSessions(): Promise<ScheddyAllSession[]> {
  const url = 'https://scheddy.clevelandcenter.org/api/allSessions';
  const data = (await fetchScheddy<any>(url)) as any;
  return normalizeScheddyArray(data) as ScheddyAllSession[];
}

export function getSessionTypeName(r: ScheddyUserSession | null | undefined): string {
  if (!r) return '';
  return String((r as any)?.sessionType?.name ?? (r as any)?.type?.name ?? '').trim();
}

export function pickUpcomingSessions(rows: ScheddyUserSession[], opts?: { limit?: number }): ScheddyUserSession[] {
  const now = Date.now();
  const limit = typeof opts?.limit === 'number' ? Math.max(0, opts.limit) : 25;

  const upcoming = (Array.isArray(rows) ? rows : [])
    .filter((r) => {
      const s = r?.session;
      if (!s) return false;
      if (s.cancelled) return false;
      if (!s.start) return false;
      const t = new Date(String(s.start)).getTime();
      if (Number.isNaN(t)) return false;
      return t >= now;
    })
    .sort((a, b) => {
      const ta = new Date(String(a.session?.start ?? '')).getTime();
      const tb = new Date(String(b.session?.start ?? '')).getTime();
      return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
    });

  return limit ? upcoming.slice(0, limit) : upcoming;
}

export function pickNextUpcomingSession(rows: ScheddyUserSession[]): ScheddyUserSession | null {
  const now = Date.now();

  const upcoming = (Array.isArray(rows) ? rows : [])
    .filter((r) => {
      const s = r?.session;
      if (!s) return false;
      if (s.cancelled) return false;
      if (!s.start) return false;
      const t = new Date(String(s.start)).getTime();
      if (Number.isNaN(t)) return false;
      return t >= now;
    })
    .sort((a, b) => {
      const ta = new Date(String(a.session?.start ?? '')).getTime();
      const tb = new Date(String(b.session?.start ?? '')).getTime();
      return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
    });

  return upcoming.length ? upcoming[0] : null;
}

export function formatPerson(p: any): string {
  if (!p) return '—';
  if (p.name) return String(p.name).trim();
  const fn = String(p.firstName ?? p.first_name ?? '').trim();
  const ln = String(p.lastName ?? p.last_name ?? '').trim();
  const full = `${fn} ${ln}`.trim();
  return full || '—';
}

export function formatCountdown(from: Date, to: Date): string {
  const ms = to.getTime() - from.getTime();
  if (Number.isNaN(ms)) return '';
  if (ms <= 0) return 'Starting now';

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60);
  const minutes = totalMinutes - days * 60 * 24 - hours * 60;

  if (days >= 1) {
    return `Starts in ${days}d ${hours}h`;
  }
  if (hours >= 1) {
    return `Starts in ${hours}h ${minutes}m`;
  }
  return `Starts in ${minutes}m`;
}
