'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapView } from '@/components/map/mapView';

type RampRole = 'ARR' | 'DEP';

type PilotSelfResponse = {
  ok: boolean;
  cid?: number;
  callsign?: string;
  connected?: boolean;
  source?: 'pilot' | 'prefile';
  flightPlan?: { departure?: string | null; arrival?: string | null } | null;
  ramp?: {
    airport?: string | null;
    role?: RampRole | null;
    canReserve?: boolean;
    canAssign?: boolean;
    reason?: string | null;
  };
  reservation?: {
    airport?: string | null;
    standId?: string | null;
    standRef?: string | null;
    note?: string | null;
    expiresAtMs?: number | null;
  } | null;
  error?: string;
};

function upIcao(v: unknown): string {
  return String(v ?? '').trim().toUpperCase();
}

export default function RampGateClient() {
  const [loading, setLoading] = useState(true);
  const [pilot, setPilot] = useState<PilotSelfResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);
      const res = await fetch('/api/pilot/self', { cache: 'no-store' });
      const json = (await res.json().catch(() => null)) as PilotSelfResponse | null;
      setPilot(json);
      if (!res.ok) {
        setErr(json?.error || 'Failed to read pilot status');
      }
    } catch (e: any) {
      setErr(e?.message || 'Failed to read pilot status');
      setPilot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);


  const airport = useMemo(() => {
    const a = upIcao(pilot?.ramp?.airport ?? 'KDTW');
    return a || 'KDTW';
  }, [pilot?.ramp?.airport]);


  // Auto-extend a pilot reservation when the pilot remains connected.
  // This prevents the "Held until" timer from expiring mid-turn while they're still online.
  const lastAutoExtendMsRef = useRef<number>(0);

  useEffect(() => {
    const standId = pilot?.reservation?.standId;
    const expiresAtMs = pilot?.reservation?.expiresAtMs;
    const canAutoExtend = Boolean(pilot?.ok && pilot?.connected && pilot?.ramp?.canReserve && standId && expiresAtMs);

    if (!canAutoExtend) return;

    const interval = window.setInterval(async () => {
      try {
        const now = Date.now();
        const exp = Number(pilot?.reservation?.expiresAtMs || 0);
        const sid = String(pilot?.reservation?.standId || '').trim();
        if (!sid || !exp) return;

        // Extend when within 10 minutes of expiration.
        if (exp - now > 10 * 60 * 1000) return;

        // Avoid spamming the endpoint.
        if (now - lastAutoExtendMsRef.current < 60 * 1000) return;

        lastAutoExtendMsRef.current = now;

        await fetch('/api/ids/ramp/hold', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            icao: airport,
            standId: sid,
            hold: true,
            mode: 'pilot',
            note: '',
          }),
        });

        // Refresh to update Held-until time and any server-side changes.
        refresh();
      } catch {
        // ignore
      }
    }, 60 * 1000);

    return () => window.clearInterval(interval);
  }, [pilot?.ok, pilot?.connected, pilot?.ramp?.canReserve, pilot?.reservation?.standId, pilot?.reservation?.expiresAtMs, airport, refresh]);


  useEffect(() => {
    const onHold = () => refresh();
    window.addEventListener('rampHoldChanged', onHold as any);
    return () => window.removeEventListener('rampHoldChanged', onHold as any);
  }, [refresh]);

  const callsign = useMemo(() => upIcao(pilot?.callsign), [pilot?.callsign]);
  const connected = Boolean(pilot?.connected);
  const source = pilot?.source;

  const fpDep = upIcao(pilot?.flightPlan?.departure ?? '');
  const fpArr = upIcao(pilot?.flightPlan?.arrival ?? '');


  const role = (pilot?.ramp?.role ?? null) as RampRole | null;
  const canReserve = Boolean(pilot?.ramp?.canReserve);
  const reason = pilot?.ramp?.reason ? String(pilot.ramp.reason) : null;

  const reservation = useMemo(() => {
    const r = pilot?.reservation ?? null;
    if (!r) return null;
    const standId = String(r.standId ?? '').trim().toUpperCase();
    const standRef = String(r.standRef ?? '').trim().toUpperCase();
    const ex = Number(r.expiresAtMs ?? 0);
    if (!standId || !Number.isFinite(ex) || ex <= nowMs) return null;
    return {
      airport: upIcao(r.airport ?? ''),
      standId,
      standRef: standRef || null,
      note: r.note ? String(r.note) : null,
      expiresAtMs: ex,
    };
  }, [pilot?.reservation, nowMs]);

  const reservationText = useMemo(() => {
    if (!reservation) return null;
    const ex = reservation.expiresAtMs;
    const minsLeft = Math.max(0, Math.ceil((ex - nowMs) / 60_000));
    const expStr = new Date(ex).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const leftStr =
      minsLeft >= 60 ? `${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m` : `${minsLeft}m`;
    return { expStr, leftStr };
  }, [reservation, nowMs]);

  const pilotHoldPrefix = useMemo(() => {
    if (!callsign) return '';
    if (!role) return callsign;
    return `${callsign} ${role}`;
  }, [callsign, role]);

  const statusLine = useMemo(() => {
    if (loading) return 'Checking network feed…';
    if (!pilot) return 'Unable to load pilot status.';

    if (!pilot.ok) {
      if (pilot.error === 'not_on_network_feed') {
        return 'No pilot/prefile found for your CID.';
      }
      if (pilot.error === 'not_logged_in') {
        return 'Not logged in.';
      }
      return pilot.error ? `Error: ${pilot.error}` : 'Unavailable.';
    }

    if (connected) return `Connected as ${callsign}`;
    if (source === 'prefile') return `Prefiled as ${callsign} (not yet connected)`;
    return `Detected as ${callsign}`;
  }, [loading, pilot, callsign, connected, source]);

  const detailLine = useMemo(() => {
    if (!pilot?.ok) return '';
    const parts: string[] = [];
    if (fpDep || fpArr) {
      parts.push(`Flight plan: ${fpDep || '—'} → ${fpArr || '—'}`);
    }
    if (role) parts.push(`Mode: ${role}`);
    return parts.join(' • ');
  }, [pilot?.ok, fpDep, fpArr, role]);

  const enableHint = useMemo(() => {
    if (!pilot?.ok) {
      return 'Connect as a pilot with a flight plan for your CID to enable gate reservations.';
    }
    if (!fpDep && !fpArr) {
      return 'No flight plan detected for your CID. The map is view-only until a plan appears on the network feed.';
    }
    if (!canReserve) {
      if (reason === 'requires_connected') {
        return 'You must be connected on the network to reserve a gate.';
      }
      return reason || 'Ramp selection is disabled for this flight plan.';
    }
    return 'Click a gate badge to reserve it.';
  }, [pilot?.ok, fpDep, fpArr, canReserve, reason, role, connected]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      <div className="xl:col-span-4 space-y-4">
        <Card className="p-4">
          <div className="text-sm font-semibold text-white/90">How it works</div>
          <div className="mt-2 text-sm text-white/70 leading-relaxed">
            This tool reads your pilot callsign from the VATSIM data feed (by CID). The map is always visible.
            You must be <span className="font-semibold">connected on the network</span> with a DTW flight plan to reserve a gate.
            <div className="mt-3">Reserve a gate to create a temporary <span className="font-semibold">HELD</span> note visible to controllers in IDS.</div>
            <div className="mt-3 text-white/75">
              <span className="font-semibold">Important:</span> ZOB cannot guarantee the gate will be available. We cannot force other pilots to use this tool,
              so controllers may assign a different gate if needed.
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white/90">Pilot status</div>
              <div className="mt-1 text-sm text-white/70">{statusLine}</div>
              {detailLine ? <div className="mt-1 text-xs text-white/55">{detailLine}</div> : null}
            </div>
            <Button variant="secondary" className="h-9 rounded-xl" onClick={refresh} disabled={loading}>
              Refresh
            </Button>
          </div>

          <div className="mt-3 text-xs text-white/60 leading-relaxed">
            {enableHint}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold text-white/90">Your reserved gate</div>
          {!reservation ? (
            <div className="mt-2 text-sm text-white/70">
              No active reservation.
              <div className="mt-1 text-xs text-white/55">If you reserve a gate, it will appear here with the local expire time.</div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-white/80">
              <div>
                <span className="font-semibold text-white/90">Stand {reservation.standRef || reservation.standId}</span>
                {reservation.airport ? <span className="text-white/55"> • {reservation.airport}</span> : null}
              </div>
              <div className="mt-1 text-xs text-white/60">
                Held until <span className="font-semibold text-white/80">{reservationText?.expStr}</span> (local)
                {reservationText?.leftStr ? <span className="text-white/55"> • {reservationText.leftStr} remaining</span> : null}
              </div>
            </div>
          )}
        </Card>

        {err ? (
          <Card className="p-4 border border-red-500/30 bg-red-500/10">
            <div className="text-sm font-semibold text-red-200">Error</div>
            <div className="mt-2 text-sm text-red-100/80">{err}</div>
          </Card>
        ) : null}
      </div>

      <div className="xl:col-span-8">
        <MapView
          mode="pilot"
          rampAirport={airport}
          defaultCallsign={callsign}
          rampIconScale={1}
          pilotCanReserve={canReserve}
          pilotCanAssign={false}
          pilotHoldPrefix={pilotHoldPrefix}
        />
      </div>
    </div>
  );
}
