'use client';

import Link from 'next/link';

export type OnlineNowPosition = {
  callsign: string;
  controllerName?: string;
  frequency?: string;
};

function fmtFreq(freq?: string): string {
  const f = String(freq ?? '').trim();
  return f || '—';
}

export default function OnlineNowCardClient(props: {
  title?: string;
  subtitle?: string;
  positions: OnlineNowPosition[];
  ctaHref?: string;
  ctaLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  showNames?: boolean;
}) {
  const {
    title = 'On the network right now',
    subtitle = 'ZOB positions online',
    positions,
    ctaHref,
    ctaLabel,
    secondaryHref,
    secondaryLabel,
    showNames = true,
  } = props;

  const total = positions.length;
  const useTwoCol = total >= 10;
  const compact = total >= 14;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-white/55">{title}</div>
          <div className="mt-2 text-4xl font-extrabold text-white tabular-nums">{total}</div>
          <div className="mt-1 text-sm text-white/65">{subtitle}</div>
        </div>

        {ctaHref && ctaLabel ? (
          <Link
            href={ctaHref}
            className="mt-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur hover:bg-white/[0.14] hover:text-white"
          >
            {ctaLabel}
          </Link>
        ) : null}
      </div>

      <div className="px-6 py-5">
        {total ? (
          <div className="relative mt-4">
            <div className="max-h-[310px] overflow-y-auto pr-1">
              <ul className={useTwoCol ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
                {positions.slice(0, 60).map((p, idx) => {
                  const callsign = String(p.callsign ?? '').trim() || '—';
                  const name = String(p.controllerName ?? '').trim();
                  const freq = fmtFreq(p.frequency);
                  return (
                    <li
                      key={`${callsign}-${freq}-${idx}`}
                      className={`rounded-2xl border border-white/10 bg-white/[0.02] px-4 ${compact ? 'py-2' : 'py-3'}`}
                    >
                      <div className="grid grid-cols-[1fr_auto] items-start gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{callsign}</div>
                          {showNames && name && !compact ? (
                            <div className="mt-1 text-xs text-white/55 truncate">{name}</div>
                          ) : null}
                        </div>
                        <div className="text-xs font-semibold text-white/75 tabular-nums">{freq}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {total > 60 ? (
              <div className="mt-3 text-xs text-white/55">Showing first 60 • {total - 60} more online</div>
            ) : null}

            {total > 8 ? (
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-slate-950/80 to-transparent" />
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/70">
            No ZOB controllers are online right now.
          </div>
        )}

        {(secondaryHref && secondaryLabel) || total ? (
          <div className="mt-4 flex items-center justify-between">
            {secondaryHref && secondaryLabel ? (
              <Link href={secondaryHref} className="text-sm font-semibold text-amber-200/90 hover:text-amber-200">
                {secondaryLabel} →
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-white/45">Live from VATSIM</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
