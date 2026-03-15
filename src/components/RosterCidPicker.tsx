'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type RosterOption = { cid: string; fullName: string; rating?: string };

function ratingTone(rating: string) {
  const r = String(rating || '').trim().toUpperCase();
  if (r === 'OBS') return 'bg-white/10 text-white/70 border-white/10';
  if (r.startsWith('S')) return 'bg-amber-500/10 text-amber-200 border-amber-500/20';
  if (r.startsWith('C')) return 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20';
  if (r.startsWith('I')) return 'bg-purple-500/10 text-purple-200 border-purple-500/20';
  if (!r || r === '—') return 'bg-white/5 text-white/60 border-white/10';
  return 'bg-amber-500/10 text-amber-200 border-amber-500/20';
}

function RatingPill({ rating }: { rating: string }) {
  const r = String(rating || '—').trim().toUpperCase() || '—';
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-extrabold tracking-wide', ratingTone(r))}>
      {r}
    </span>
  );
}

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function RosterCidPicker({
  name,
  options,
  defaultCid,
  placeholder = '(unassigned)',
  style,
  className,
}: {
  name: string;
  options: RosterOption[];
  defaultCid: string;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [value, setValue] = useState<string>(defaultCid ?? '');
  const boxRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setValue(defaultCid ?? '');
  }, [defaultCid]);

  const normalizedOptions = useMemo(() => {
    const arr = Array.isArray(options) ? options : [];
    return arr
      .map((o) => ({
        cid: String(o.cid ?? '').trim(),
        fullName: String(o.fullName ?? '').trim(),
        rating: String((o as any).rating ?? '').trim(),
      }))
      .filter((o) => o.cid && o.fullName);
  }, [options]);

  const currentMissing = useMemo(() => {
    if (!value) return null;
    const has = normalizedOptions.some((o) => o.cid === value);
    if (has) return null;
    return { cid: value, fullName: `Current (${value})`, rating: '' };
  }, [normalizedOptions, value]);

  const selected = useMemo(() => {
    if (!value) return null;
    return normalizedOptions.find((o) => o.cid === value) ?? null;
  }, [normalizedOptions, value]);

  const selectedLabel = useMemo(() => {
    if (!value) return '';
    const found = normalizedOptions.find((o) => o.cid === value);
    if (found) {
      const r = String(found.rating ?? '').trim();
      return r ? `${found.fullName} • ${r} (${found.cid})` : `${found.fullName} (${found.cid})`;
    }
    if (currentMissing) return currentMissing.fullName;
    return value;
  }, [value, normalizedOptions, currentMissing]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter((o) => {
      const a = o.fullName.toLowerCase();
      const b = o.cid.toLowerCase();
      const c = String(o.rating ?? '').toLowerCase();
      return a.includes(q) || b.includes(q) || c.includes(q);
    });
  }, [normalizedOptions, query]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const el = boxRef.current;
      if (!el) return;
      if (e.target && el.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      // focus next tick
      setTimeout(() => searchRef.current?.focus(), 0);
    } else {
      setQuery('');
    }
  }, [open]);

  const choose = (cid: string) => {
    setValue(cid);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className={cn('relative w-full min-w-[280px] md:min-w-[340px]', className)} style={style}>
      {/* Hidden input so this works with standard <form action={...}> server actions */}
      <input type="hidden" name={name} value={value} />

      <button
        type="button"
        className={cn(
          'ui-input flex w-full items-center justify-between gap-2',
          'cursor-pointer select-none'
        )}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {value && selected ? (
          <div className="min-w-0 flex items-center gap-2">
            <span className="truncate text-white/90" title={selected.fullName}>{selected.fullName}</span>
            {selected.rating ? <RatingPill rating={selected.rating} /> : null}
            <span className="hidden shrink-0 text-xs text-white/55 md:inline">CID {selected.cid}</span>
          </div>
        ) : (
          <span className={cn('truncate', value ? 'text-white/90' : 'text-white/50')}>
            {value ? selectedLabel : placeholder}
          </span>
        )}
        <span className="text-white/50">▾</span>
      </button>

      {open ? (
        <div
          className="absolute z-[2000] mt-1 w-full rounded-xl border border-white/10 bg-[#070a12] p-2 shadow-2xl"
          role="listbox"
        >
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or CID…"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none placeholder:text-white/40"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
              }
            }}
          />

          <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-white/10">
            {/* Unassigned */}
            <button
              type="button"
              className={cn(
                'flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm',
                !value ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose('')}
            >
              <span className="truncate">(unassigned)</span>
              {!value ? <span className="text-xs text-white/60">selected</span> : null}
            </button>

            {currentMissing ? (
              <button
                type="button"
                className={cn(
                  'flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm',
                  value === currentMissing.cid ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(currentMissing.cid)}
              >
                <span className="truncate">{currentMissing.fullName}</span>
                <span className="text-xs text-white/50">{currentMissing.cid}</span>
              </button>
            ) : null}

            {filtered.length ? (
              filtered.map((o) => (
                <button
                  key={o.cid}
                  type="button"
                  className={cn(
                    'flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm',
                    value === o.cid ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(o.cid)}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white/90 whitespace-normal break-words leading-tight">{o.fullName}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-white/55">
                      {o.rating ? <RatingPill rating={o.rating} /> : null}
                      <span className="tabular-nums">CID {o.cid}</span>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-white/50">No matches.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
