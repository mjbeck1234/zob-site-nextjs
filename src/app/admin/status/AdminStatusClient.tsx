'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type StatusCheck = {
  id: string;
  label: string;
  ok: boolean;
  severity: 'critical' | 'warning' | 'info';
  latencyMs: number;
  detail?: string;
};

type StatusResponse = {
  ok: boolean;
  generatedAtIso: string;
  checks: StatusCheck[];
};

function fmtMs(ms: number) {
  const n = Number(ms ?? 0);
  if (!Number.isFinite(n)) return '';
  if (n < 1000) return `${Math.round(n)}ms`;
  return `${(n / 1000).toFixed(1)}s`;
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function statusPillClass(ok: boolean, severity: StatusCheck['severity']) {
  if (ok) return 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30';
  if (severity === 'critical') return 'bg-rose-500/15 text-rose-200 border-rose-500/30';
  return 'bg-amber-500/15 text-amber-200 border-amber-500/30';
}

function statusLabel(ok: boolean, severity: StatusCheck['severity']) {
  if (ok) return 'OK';
  return severity === 'critical' ? 'DOWN' : 'WARN';
}

export default function AdminStatusClient() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setErrMsg(null);
    try {
      const res = await fetch('/api/admin/status', { cache: 'no-store' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ''}`);
      }
      const json = (await res.json()) as StatusResponse;
      setData(json);
      lastFetchRef.current = Date.now();
    } catch (e: any) {
      setErrMsg(e?.message ? String(e.message) : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 30_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const grouped = useMemo(() => {
    const out: Record<string, StatusCheck[]> = { Critical: [], Warning: [], Info: [] };
    for (const c of data?.checks ?? []) {
      if (c.severity === 'critical') out.Critical.push(c);
      else if (c.severity === 'warning') out.Warning.push(c);
      else out.Info.push(c);
    }
    return out;
  }, [data]);

  const overall = data?.ok ?? false;
  const overallText = data ? (overall ? 'All critical systems OK' : 'Some critical systems are down') : 'Loading…';
  const overallClass = data
    ? overall
      ? 'bg-emerald-500/10 border-emerald-500/25'
      : 'bg-rose-500/10 border-rose-500/25'
    : 'bg-white/5 border-white/10';

  const lastUpdated = data?.generatedAtIso ? fmtTime(data.generatedAtIso) : null;

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border ${overallClass} p-4`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-white">{overallText}</div>
            <div className="mt-1 text-xs text-white/70">
              {lastUpdated ? (
                <span>
                  Last update: <span className="text-white/85">{lastUpdated}</span>
                </span>
              ) : (
                <span>Fetching status…</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="ui-btn" onClick={fetchStatus} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh now'}
            </button>
            <div className="text-xs text-white/60">
              Auto-refresh: <span className="text-white/80">30s</span>
            </div>
          </div>
        </div>

        {errMsg ? (
          <div className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            {errMsg}
          </div>
        ) : null}
      </div>

      {data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {(['Critical', 'Warning', 'Info'] as const).map((group) => (
            <div key={group} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white">{group}</div>
                <div className="text-xs text-white/60">{grouped[group].length}</div>
              </div>

              <div className="mt-3 space-y-2">
                {grouped[group].length ? (
                  grouped[group].map((c) => (
                    <div key={c.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-white">{c.label}</div>
                          {c.detail ? <div className="mt-0.5 break-words text-[11px] text-white/65">{c.detail}</div> : null}
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <div className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusPillClass(c.ok, c.severity)}`}>
                            {statusLabel(c.ok, c.severity)}
                          </div>
                          <div className="text-[11px] text-white/50">{fmtMs(c.latencyMs)}</div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-white/60">No checks in this group.</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">Loading checks…</div>
      )}
    </div>
  );
}
