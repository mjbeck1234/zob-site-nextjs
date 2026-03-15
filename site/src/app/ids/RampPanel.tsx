'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type RampArea = {
  id: string;
  label: string;
  bbox: { south: number; west: number; north: number; east: number };
  standCount: number;
};

type Occupied = {
  standId: string;
  ref?: string;
  callsign: string;
  groundspeed?: number;
  aircraftType?: string;
};

type RampSummary = {
  totalStands: number;
  occupied: number;
  open: number;
  held?: number;
  unassignedParked: number;
  updatedAtIso?: string;
};

type RampOccupancyResponse = {
  ok: boolean;
  icao: string;
  center?: { lat: number; lon: number };
  bbox?: { south: number; west: number; north: number; east: number };
  stands?: any[];
  areas?: RampArea[];
  occupiedList?: Occupied[];
  unassigned?: any[];
  summary?: RampSummary;
  error?: string;
};

type GroundTrafficItem = {
  callsign: string;
  latitude: number;
  longitude: number;
  groundspeed?: number;
  aircraftType?: string;
  parked?: boolean;
  stoppedSeconds?: number;
  state?: 'parked' | 'taxi' | 'ground';
  intent?: 'arriving' | 'departing';
  areaId?: string;
  departure?: string;
  arrival?: string;
};

type GroundTrafficResponse = {
  ok: boolean;
  icao: string;
  traffic?: GroundTrafficItem[];
  error?: string;
};

type CoordEntry = {
  callsign: string;
  status: string;
  note?: string;
  updatedAt: number;
};

type CoordResponse = {
  ok: boolean;
  icao: string;
  queue?: { callsign: string; status: string; note?: string; updatedAt: number }[];
  error?: string;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function fmtStopped(sec?: number) {
  const s = Math.max(0, Number(sec || 0));
  if (!Number.isFinite(s) || s <= 0) return '';
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return mm > 0 ? `${mm}:${String(ss).padStart(2, '0')}` : `${ss}s`;
}

const STATUS_LABEL: Record<string, string> = {
  ready_taxi: 'Ready taxi',
  hold: 'Hold',
  push_approved: 'Push approved',
  monitor: 'Monitor',
};

export function RampPanel({
  airport,
  setAirport,
  iconScale,
  setIconScale,
  areaId,
  setAreaId,
  focusMode,
  setFocusMode,
  showBackground,
  setShowBackground,
  showTrails,
  setShowTrails,
}: {
  airport: string;
  setAirport: (icao: string) => void;
  iconScale: number;
  setIconScale: (n: number) => void;
  areaId: string;
  setAreaId: (v: string) => void;
  focusMode: boolean;
  setFocusMode: (v: boolean) => void;
  showBackground: boolean;
  setShowBackground: (v: boolean) => void;
  showTrails: boolean;
  setShowTrails: (v: boolean) => void;
}) {
  const [occ, setOcc] = useState<RampOccupancyResponse | null>(null);
  const [ground, setGround] = useState<GroundTrafficItem[]>([]);
  const [coord, setCoord] = useState<CoordEntry[]>([]);

  // Keep a live ref so our interval fetch callbacks can decide whether to overwrite the list.
  const groundRef = useRef<GroundTrafficItem[]>([]);
  useEffect(() => {
    groundRef.current = ground;
  }, [ground]);

  const [loadingOcc, setLoadingOcc] = useState(false);
  const [loadingGround, setLoadingGround] = useState(false);
  const [loadingCoord, setLoadingCoord] = useState(false);

  const [staleOcc, setStaleOcc] = useState(false);
  const [staleGround, setStaleGround] = useState(false);
  const [staleCoord, setStaleCoord] = useState(false);

  const lastGoodOccRef = useRef<RampOccupancyResponse | null>(null);

  // Persist last-good occupancy so a tab switch (which may unmount this component) doesn't show a "blank" ramp.
  const occStorageKey = useMemo(() => `zob.ids.ramp.occ.${String(airport || '').toUpperCase()}`, [airport]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(occStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as RampOccupancyResponse;
      if (parsed?.ok && String(parsed.icao || '').toUpperCase() === String(airport || '').toUpperCase()) {
        lastGoodOccRef.current = parsed;
        setOcc(parsed);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occStorageKey]);

  const airports = useMemo(() => [{ icao: 'KDTW', label: 'KDTW – Detroit Metro' }], []);

  const scale = clamp(Number(iconScale) || 1, 0.6, 1.8);

  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const heldRows = useMemo(() => {
    const stands = Array.isArray(occ?.stands) ? (occ!.stands as any[]) : [];
    return stands
      .filter((st) => !!st?.held)
      .map((st) => ({
        id: String(st.id ?? ''),
        label: String(st.ref ?? st.name ?? st.id ?? '').trim() || String(st.id ?? ''),
        note: st.holdNote ? String(st.holdNote) : '',
        expiresAt: Number(st.holdExpiresAt ?? 0),
        byMode: st.holdCreatedByMode ? String(st.holdCreatedByMode).toLowerCase() : '',
        byCid: st.holdCreatedByCid != null ? Number(st.holdCreatedByCid) : null,
      }))
      .filter((r) => !!r.id)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [occ]);

  const releaseHold = async (standId: string) => {
    try {
      await fetch('/api/ids/ramp/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icao: airport, standId, hold: false }),
      });
    } finally {
      await loadOcc();
    }
  };

  const loadOcc = async () => {
    try {
      setLoadingOcc(true);
      const res = await fetch(`/api/ids/ramp/occupancy?icao=${encodeURIComponent(airport)}`, { cache: 'no-store' });
      const json = (await res.json()) as RampOccupancyResponse;

      if (json?.ok) {
        const stands = Array.isArray(json?.stands) ? json.stands : [];
        const hadStands = (Array.isArray(lastGoodOccRef.current?.stands) ? lastGoodOccRef.current?.stands : []).length > 0;

        // Some refreshes can transiently return ok:true but an empty stand list (or missing center/bbox).
        // If we previously had valid stand data, treat this as a stale update and keep the last-good payload.
        if (stands.length === 0 && hadStands) {
          setStaleOcc(true);
          return;
        }

        lastGoodOccRef.current = json;
        setOcc(json);
        setStaleOcc(false);
        try {
          localStorage.setItem(occStorageKey, JSON.stringify(json));
        } catch {
          // ignore
        }
      } else {
        setStaleOcc(true);
        if (!lastGoodOccRef.current) setOcc(json);
      }
    } catch {
      setStaleOcc(true);
    } finally {
      setLoadingOcc(false);
    }
  };

  const loadGround = async () => {
    try {
      setLoadingGround(true);
      const res = await fetch(`/api/ids/ramp/ground?icao=${encodeURIComponent(airport)}`, { cache: 'no-store' });
      const json = (await res.json()) as GroundTrafficResponse;
      if (json?.ok && Array.isArray(json.traffic)) {
        if (json.traffic.length === 0 && groundRef.current.length > 0) {
          setStaleGround(true);
          return;
        }
        setGround(json.traffic);
        setStaleGround(false);
      } else {
        setStaleGround(true);
      }
    } catch {
      setStaleGround(true);
    } finally {
      setLoadingGround(false);
    }
  };

  const loadCoord = async () => {
    try {
      setLoadingCoord(true);
      const res = await fetch(`/api/ids/ramp/coord?icao=${encodeURIComponent(airport)}`, { cache: 'no-store' });
      const json = (await res.json()) as CoordResponse;
      if (json?.ok && Array.isArray(json.queue)) {
        setCoord(
          json.queue.map((q) => ({
            callsign: String(q.callsign || '').toUpperCase(),
            status: String(q.status || 'ready_taxi'),
            note: q.note ? String(q.note) : undefined,
            updatedAt: Number(q.updatedAt || Date.now()),
          }))
        );
        setStaleCoord(false);
      } else {
        setStaleCoord(true);
      }
    } catch {
      setStaleCoord(true);
    } finally {
      setLoadingCoord(false);
    }
  };

  const saveCoord = async (callsign: string, status: string, note?: string) => {
    await fetch('/api/ids/ramp/coord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icao: airport, callsign, status, note: note || '' }),
    });
    loadCoord();
  };

  const deleteCoord = async (callsign: string) => {
    await fetch('/api/ids/ramp/coord', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icao: airport, callsign }),
    });
    loadCoord();
  };

  const smartAssign = async (callsign: string, inferredAreaId?: string) => {
    const preferred = areaId && areaId !== 'all' ? areaId : inferredAreaId || '';
    const res = await fetch('/api/ids/ramp/smartAssign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icao: airport, callsign, preferredAreaId: preferred }),
    });
    // Always refresh the UI; even on error, occupancy may have changed.
    await loadOcc();
    await loadGround();
    return res.ok;
  };

  useEffect(() => {
    let cancelled = false;
    let occInterval: number | undefined;
    let groundInterval: number | undefined;
    let coordInterval: number | undefined;

    const init = async () => {
      await loadOcc();
      await loadGround();
      await loadCoord();
    };

    init();

    // Occupancy/stands update
    occInterval = window.setInterval(() => {
      if (cancelled) return;
      loadOcc();
    }, 15_000);

    // Ground aircraft list update
    groundInterval = window.setInterval(() => {
      if (cancelled) return;
      loadGround();
    }, 5_000);

    // Coordination queue update
    coordInterval = window.setInterval(() => {
      if (cancelled) return;
      loadCoord();
    }, 10_000);

    return () => {
      cancelled = true;
      if (occInterval) clearInterval(occInterval);
      if (groundInterval) clearInterval(groundInterval);
      if (coordInterval) clearInterval(coordInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airport]);

  const summary = (occ?.ok ? occ?.summary : null) ?? lastGoodOccRef.current?.summary ?? null;
  const occupiedList = (occ?.ok ? occ?.occupiedList : null) ?? lastGoodOccRef.current?.occupiedList ?? [];
  const areas = useMemo(() => {
    const a = (occ?.ok ? occ?.areas : null) ?? lastGoodOccRef.current?.areas ?? [];
    return Array.isArray(a) ? a : [];
  }, [occ]);

  const gateByCallsign = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of occupiedList ?? []) {
      const cs = String(o.callsign ?? '').toUpperCase();
      if (!cs) continue;
      m.set(cs, String(o.ref ?? '—'));
    }
    return m;
  }, [occupiedList]);

  const areaByCallsignFromStands = useMemo(() => {
    const m = new Map<string, string>();
    const stands = ((occ?.ok ? occ?.stands : null) ?? lastGoodOccRef.current?.stands ?? []) as any[];
    for (const s of stands) {
      const cs = String(s?.aircraft?.callsign ?? '').toUpperCase();
      if (!cs) continue;
      const a = String(s?.areaId ?? '').trim();
      if (a) m.set(cs, a);
    }
    return m;
  }, [occ]);

  const areaOptions = useMemo(() => {
    const opts = areas
      .filter((a) => a && a.id && a.standCount > 0)
      .map((a) => ({ id: a.id, label: `${a.label} (${a.standCount})` }));
    return [{ id: 'all', label: 'All areas' }, ...opts];
  }, [areas]);

  const groundRows = useMemo(() => {
    const rows = (Array.isArray(ground) ? ground : []).map((t) => {
      const cs = String(t?.callsign ?? '').toUpperCase();
      const gate = gateByCallsign.get(cs) ?? '';
      const parked = !!t?.parked;
      const gs = t?.groundspeed != null ? Number(t.groundspeed) : null;
      const type = String(t?.aircraftType ?? '').trim();
      const dep = t?.departure ? String(t.departure).toUpperCase() : '';
      const arr = t?.arrival ? String(t.arrival).toUpperCase() : '';
      const stopped = fmtStopped(t?.stoppedSeconds);

      const status = gate
        ? 'gate'
        : parked
          ? stopped ? `parked ${stopped}` : 'parked'
          : gs != null && gs > 2
            ? 'taxi'
            : 'ground';

      const inferredArea = areaByCallsignFromStands.get(cs) || String(t?.areaId ?? '') || 'other';
      const intent =
        t?.intent === 'departing' ? 'dep' : t?.intent === 'arriving' ? 'arr' : '';

      return {
        callsign: cs,
        gate: gate || '—',
        status,
        intent,
        areaId: inferredArea,
        groundspeed: gs,
        aircraftType: type || '—',
        route: dep || arr ? `${dep || '----'} → ${arr || '----'}` : '—',
      };
    });

    const filtered = areaId && areaId !== 'all' ? rows.filter((r) => r.areaId === areaId) : rows;

    // Prefer assigned gates first, then parked, then callsign.
    filtered.sort((a, b) => {
      const aGate = a.gate !== '—' ? 1 : 0;
      const bGate = b.gate !== '—' ? 1 : 0;
      if (bGate !== aGate) return bGate - aGate;
      const aPark = a.status.startsWith('parked') ? 1 : 0;
      const bPark = b.status.startsWith('parked') ? 1 : 0;
      if (bPark !== aPark) return bPark - aPark;
      return a.callsign.localeCompare(b.callsign);
    });

    return filtered;
  }, [ground, gateByCallsign, areaByCallsignFromStands, areaId]);

  const coordSorted = useMemo(() => {
    const list = [...coord];
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    return list;
  }, [coord]);

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Ramp view</div>
            <div className="text-sm text-muted-foreground">
              Gate occupancy + on-ground list + coordination queue.
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loadingOcc || loadingGround || loadingCoord ? (
              <Badge variant="secondary">Updating…</Badge>
            ) : (
              <Badge variant="secondary">Live</Badge>
            )}
            {(staleOcc || staleGround || staleCoord) && <Badge variant="destructive">Stale</Badge>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Airport</label>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={airport}
              onChange={(e) => setAirport(e.target.value)}
            >
              {airports.map((a) => (
                <option key={a.icao} value={a.icao}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Area</label>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
            >
              {areaOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={focusMode}
              onChange={(e) => setFocusMode(e.target.checked)}
            />
            Focus mode
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showBackground}
              onChange={(e) => setShowBackground(e.target.checked)}
            />
            Background
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showTrails}
              onChange={(e) => setShowTrails(e.target.checked)}
            />
            Trails
          </label>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Icon size</label>
            <Button
              variant="secondary"
              className="h-9 px-3"
              onClick={() => setIconScale(Number(clamp(scale - 0.1, 0.6, 1.8).toFixed(1)))}
              title="Smaller"
            >
              –
            </Button>
            <input
              type="range"
              min={0.6}
              max={1.8}
              step={0.1}
              value={scale}
              onChange={(e) => setIconScale(Number(parseFloat(e.target.value).toFixed(1)))}
              className="h-2 w-40"
            />
            <Button
              variant="secondary"
              className="h-9 px-3"
              onClick={() => setIconScale(Number(clamp(scale + 0.1, 0.6, 1.8).toFixed(1)))}
              title="Bigger"
            >
              +
            </Button>
            <div className="text-xs text-muted-foreground w-12 text-right tabular-nums">
              {Math.round(scale * 100)}%
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" className="h-9" onClick={loadOcc} disabled={loadingOcc}>
              Refresh
            </Button>
          </div>
        </div>

        {heldRows.length ? (
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Gate reservations</div>
              <Badge variant="secondary">{heldRows.length}</Badge>
            </div>

            <div className="max-h-52 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="text-left px-3 py-2 font-medium">Gate</th>
                    <th className="text-left px-3 py-2 font-medium">Note</th>
                    <th className="text-left px-3 py-2 font-medium">Expires</th>
                    <th className="text-left px-3 py-2 font-medium">By</th>
                    <th className="text-left px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {heldRows.map((r) => {
                    const mins = r.expiresAt ? Math.max(0, Math.round((r.expiresAt - nowTick) / 60000)) : null;
                    const expires = r.expiresAt
                      ? new Date(r.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                      : '—';
                    const by = r.byMode || (r.byCid ? 'controller' : 'unknown');
                    return (
                      <tr key={r.id} className="border-b last:border-b-0">
                        <td className="px-3 py-2 font-mono">{r.label}</td>
                        <td className="px-3 py-2">{r.note || '—'}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {expires}
                          {mins != null ? (
                            <span className="ml-2 text-xs text-muted-foreground">({mins}m)</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary" className="capitalize">{by}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Button variant="secondary" className="h-8 px-2" onClick={() => releaseHold(r.id)}
                            title="Release this reservation"
                          >
                            Release
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {summary ? (
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">Stands: {summary.totalStands}</Badge>
            <Badge variant="secondary">Occupied: {summary.occupied}</Badge>
            <Badge variant="secondary">Open: {summary.open}</Badge>
            {summary.held != null ? <Badge variant="secondary">Held: {summary.held}</Badge> : null}
            <Badge variant="secondary">On ground (unassigned): {summary.unassignedParked}</Badge>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Loading ramp data…</div>
        )}

        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">On-ground @ {airport}{areaId !== 'all' ? ` (${areaOptions.find(x=>x.id===areaId)?.label ?? areaId})` : ''}</div>
            <div className="text-xs text-muted-foreground">
              {groundRows.length ? `${groundRows.length} aircraft` : ''}
            </div>
          </div>

          <div className="max-h-80 overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left px-3 py-2 font-medium">Callsign</th>
                  <th className="text-left px-3 py-2 font-medium">Gate</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">GS</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-left px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groundRows.length ? (
                  groundRows.slice(0, 80).map((r) => (
                    <tr key={r.callsign} className="border-b last:border-b-0">
                      <td className="px-3 py-2 font-mono">
                        {r.callsign}
                        {r.intent ? <span className="ml-2 text-xs text-muted-foreground">{r.intent}</span> : null}
                      </td>
                      <td className="px-3 py-2">{r.gate}</td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary" className="capitalize">
                          {r.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {r.groundspeed != null && Number.isFinite(r.groundspeed) ? `${Math.round(r.groundspeed)}kt` : '—'}
                      </td>
                      <td className="px-3 py-2">{r.aircraftType}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            className="h-8 px-2"
                            disabled={r.gate !== '—'}
                            title={r.gate !== '—' ? 'Already assigned' : 'Assign nearest open gate (respects area filter)'}
                            onClick={() => smartAssign(r.callsign, r.areaId)}
                          >
                            Assign
                          </Button>
                          <Button
                            variant="secondary"
                            className="h-8 px-2"
                            title="Add/update in coordination queue"
                            onClick={() => saveCoord(r.callsign, 'ready_taxi')}
                          >
                            Queue
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-3 text-sm text-muted-foreground" colSpan={6}>
                      {loadingGround ? 'Loading on-ground aircraft…' : `No on-ground aircraft found at ${airport}.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {groundRows.length ? (
            <div className="text-xs text-muted-foreground mt-2">
              Area filter is <span className="font-medium">{areaId === 'all' ? 'All areas' : (areaOptions.find(x => x.id === areaId)?.label ?? areaId)}</span>. Smart Assign uses your area selection first, then nearest.
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Coordination queue</div>
            <div className="text-xs text-muted-foreground">
              Quick ramp→ground reminders (push/taxi holds). Click “Queue” next to a callsign to add it.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="h-8" onClick={loadCoord} disabled={loadingCoord}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="max-h-56 overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b">
                <th className="text-left px-3 py-2 font-medium">Callsign</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Note</th>
                <th className="text-left px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coordSorted.length ? (
                coordSorted.map((c) => (
                  <tr key={c.callsign} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-mono">{c.callsign}</td>
                    <td className="px-3 py-2">
                      <select
                        className="h-8 rounded-md border bg-background px-2 text-sm"
                        value={c.status}
                        onChange={(e) => saveCoord(c.callsign, e.target.value, c.note)}
                      >
                        {['ready_taxi', 'push_approved', 'hold', 'monitor'].map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s] ?? s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                        defaultValue={c.note ?? ''}
                        placeholder="Optional note…"
                        onBlur={(e) => saveCoord(c.callsign, c.status, e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Button variant="secondary" className="h-8" onClick={() => deleteCoord(c.callsign)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-3 text-sm text-muted-foreground" colSpan={4}>
                    {loadingCoord ? 'Loading queue…' : 'No items in the queue.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
}
