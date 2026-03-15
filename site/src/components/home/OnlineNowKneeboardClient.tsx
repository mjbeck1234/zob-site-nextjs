'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import LiveFreshness from '@/components/home/LiveFreshness';

export type OnlineNowKneeboardPosition = {
  cid?: number;
  callsign: string;
  controllerName?: string;
  frequency?: string;
};

type FacilityGroupKey = 'center' | 'tracon' | 'cab' | 'other';

function groupForCallsign(callsign: string): FacilityGroupKey {
  const cs = String(callsign ?? '').trim().toUpperCase();
  if (cs.endsWith('_CTR')) return 'center';
  if (cs.endsWith('_APP') || cs.endsWith('_DEP')) return 'tracon';
  if (cs.endsWith('_TWR') || cs.endsWith('_GND') || cs.endsWith('_DEL') || cs.endsWith('_ATIS')) return 'cab';
  return 'other';
}

function fmtFreq(freq?: string): string {
  const f = String(freq ?? '').trim();
  return f || '—';
}

export default function OnlineNowKneeboardClient(props: {
  title?: string;
  subtitle?: string;
  positions: OnlineNowKneeboardPosition[];
  currentCid?: number | null;
  ctaHref?: string;
  ctaLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  showNames?: boolean;
  emptyMode?: 'controller' | 'pilot';
  lastUpdatedIso?: string;
}) {
  const {
    title = 'ATC online',
    subtitle = 'ZOB positions',
    positions,
    currentCid,
    ctaHref,
    ctaLabel,
    secondaryHref,
    secondaryLabel,
    showNames = true,
    emptyMode = 'controller',
    lastUpdatedIso,
  } = props;

  const me = useMemo(() => {
    const cidNum = currentCid ? Number(currentCid) : NaN;
    if (!Number.isFinite(cidNum)) return null;
    return positions.find((p) => Number(p.cid) === cidNum) ?? null;
  }, [positions, currentCid]);

  const total = positions.length;

  const grouped = useMemo(() => {
    const out: Record<FacilityGroupKey, OnlineNowKneeboardPosition[]> = {
      center: [],
      tracon: [],
      cab: [],
      other: [],
    };
    for (const p of positions ?? []) out[groupForCallsign(p.callsign)].push(p);
    for (const k of Object.keys(out) as FacilityGroupKey[]) {
      out[k] = out[k].slice().sort((a, b) => {
        const ac = String(a.callsign ?? '');
        const bc = String(b.callsign ?? '');
        if (ac !== bc) return ac.localeCompare(bc);
        return fmtFreq(a.frequency).localeCompare(fmtFreq(b.frequency));
      });
    }
    return out;
  }, [positions]);

  const counts = {
    center: grouped.center.length,
    tracon: grouped.tracon.length,
    cab: grouped.cab.length,
    other: grouped.other.length,
  };

  const meGroup = me ? groupForCallsign(String(me.callsign ?? '')) : null;

  const isMe = (p: OnlineNowKneeboardPosition) => {
    const cidNum = currentCid ? Number(currentCid) : NaN;
    return Number.isFinite(cidNum) && Number(p.cid) === cidNum;
  };

  const pillCls = () => 'border-white/15 bg-white/10 text-white/80';

  const EmptyState = () => {
    if (emptyMode === 'pilot') {
      return (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4 text-sm text-white/70">
          <div className="font-semibold text-white/85">Quiet right now.</div>
          <div className="mt-1 text-white/60">Perfect for a smooth hop, pattern work, or trying a new route through ZOB.</div>
        </div>
      );
    }
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4 text-sm text-white/70">
        <div className="font-semibold text-white/85">No ZOB controllers online right now.</div>
        <div className="mt-1 text-white/60">Good time to prep for the next push, review procedures, or open IDS and stage things early.</div>
      </div>
    );
  };

  const Group = (props2: { keyName: FacilityGroupKey; label: string }) => {
    const list = grouped[props2.keyName] ?? [];
    const n = list.length;
    if (!n) return null;
    const shouldOpen = total <= 4 || meGroup === props2.keyName;
    return (
      <details open={shouldOpen} className="group rounded-2xl border border-white/10 bg-white/[0.02]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 select-none [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <div className="truncate text-sm font-semibold text-white/85">{props2.label}</div>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${pillCls()}`}>{n}</span>
          </div>
          <svg viewBox="0 0 20 20" className="h-4 w-4 text-white/55 transition-transform group-open:rotate-180" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
          </svg>
        </summary>

        <div className="px-4 pb-3">
          <ul className="space-y-2">
            {list.slice(0, 120).map((p, idx) => {
              const callsign = String(p.callsign ?? '').trim() || '—';
              const name = String(p.controllerName ?? '').trim();
              const freq = fmtFreq(p.frequency);
              const meRow = isMe(p);
              return (
                <li
                  key={`${callsign}-${freq}-${idx}`}
                  className={`rounded-2xl border px-3 py-2.5 ${meRow ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/10 bg-white/[0.02]'}`}
                >
                  <div className="grid grid-cols-[1fr_auto] items-start gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate text-sm font-semibold text-white">{callsign}</div>
                        {meRow ? (
                          <span className="shrink-0 inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                            You
                          </span>
                        ) : null}
                      </div>
                      {showNames && name ? <div className="mt-0.5 truncate text-[11px] text-white/55">{name}</div> : null}
                    </div>
                    <div className="text-[11px] font-semibold tabular-nums text-white/75">{freq}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </details>
    );
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur flex flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/55">{title}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 tabular-nums">
              {total}
            </span>
            <span className="truncate text-xs text-white/55">{subtitle}</span>
          </div>

          {total ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums ${pillCls()}`}>Center {counts.center}</span>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums ${pillCls()}`}>TRACON {counts.tracon}</span>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums ${pillCls()}`}>Cab {counts.cab}</span>
              {counts.other ? <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums ${pillCls()}`}>Other {counts.other}</span> : null}
            </div>
          ) : null}
        </div>

        {ctaHref && ctaLabel ? (
          <Link href={ctaHref} className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white/90 backdrop-blur hover:bg-white/[0.14] hover:text-white">
            {ctaLabel}
          </Link>
        ) : null}
      </div>

      <div className="px-5 py-4 flex flex-col min-h-0">
        {me ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-100">
            You’re online as <span className="font-semibold">{String(me.callsign ?? '').trim() || '—'}</span>
            <span className="text-emerald-100/70"> • {fmtFreq(me.frequency)}</span>
          </div>
        ) : null}

        {total ? (
          <div className="mt-4 space-y-2">
            <Group keyName="center" label="Center" />
            <Group keyName="tracon" label="TRACON" />
            <Group keyName="cab" label="Cab" />
            <Group keyName="other" label="Other" />
          </div>
        ) : (
          <EmptyState />
        )}

        {(secondaryHref && secondaryLabel) || lastUpdatedIso ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            {secondaryHref && secondaryLabel ? (
              <Link href={secondaryHref} className="text-sm font-semibold text-amber-200/90 hover:text-amber-200">
                {secondaryLabel} →
              </Link>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2 text-[11px] text-white/45">
              {lastUpdatedIso ? <LiveFreshness sinceIso={lastUpdatedIso} prefix="Updated" /> : null}
              <span>VATSIM</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
