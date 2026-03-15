'use client';

import { useEffect, useMemo, useState } from 'react';
import { HIGH_SECTORS, LOW_SECTORS } from '@/lib/splits/sectorGroups';
import { AREAS, getSectorMeta } from '@/lib/splits/sectorCatalog';

function getSectorCode(feature: any): string {
  return String(
    feature?.properties?.sector ??
      feature?.properties?.id ??
      feature?.properties?.name ??
      feature?.id ??
      ''
  )
    .trim()
    .toUpperCase();
}

export default function SectorMultiSelect({
  name,
  mode,
  defaultSelected,
}: {
  name: string;
  mode: 'high' | 'low' | 'all';
  defaultSelected?: string[];
}) {
  // Codes found in the sector geometry file.
  const [allSectors, setAllSectors] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(
    new Set((defaultSelected ?? []).map((s) => String(s).trim().toUpperCase()).filter(Boolean))
  );
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/maps/zob_sectors.geojson', { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const geo = await res.json();
        const features = Array.isArray(geo?.features) ? geo.features : [];
        const codes: string[] = Array.from(
          new Set<string>(
            features
              .map(getSectorCode)
              .map((s: string) => s.trim().toUpperCase())
              .filter((s: string) => /^ZOB\d+$/i.test(s))
          )
        ).sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }));

        if (!cancelled) setAllSectors(codes);
      } catch {
        // If the file is missing, leave list empty. The hidden input will still submit whatever is selected.
        if (!cancelled) setAllSectors([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const allowed = useMemo(() => {
    if (mode === 'high') return HIGH_SECTORS;
    if (mode === 'low') return LOW_SECTORS;
    return new Set<string>([...HIGH_SECTORS, ...LOW_SECTORS]);
  }, [mode]);

  type Item = {
    code: string;
    area: number | null;
    label: string;
  };

  const items: Item[] = useMemo(() => {
    // Build items from geometry-backed sector codes.
    return allSectors
      .filter((s) => allowed.has(s))
      .map((code) => {
        const meta = getSectorMeta(code);
        return {
          code,
          area: meta?.area ?? null,
          label: meta?.label ?? code,
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [allSectors, allowed]);

  const visibleItems = useMemo(() => {
    const needleRaw = q.trim().toLowerCase();
    if (!needleRaw) return items;

    // Search matches:
    // - sector code (ZOB27)
    // - friendly label (Hudson 27 (HI))
    // - "area 2" / "area2"
    return items.filter((it) => {
      const areaStr = it.area ? `area ${it.area}` : '';
      const hay = `${it.code} ${it.label} ${areaStr} ${areaStr.replace(' ', '')}`.toLowerCase();
      return hay.includes(needleRaw);
    });
  }, [items, q]);

  const visibleCodes = useMemo(() => visibleItems.map((it) => it.code), [visibleItems]);

  const grouped = useMemo(() => {
    const map = new Map<number | 'other', Item[]>();
    for (const it of visibleItems) {
      const key: number | 'other' = it.area ?? 'other';
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    // Ensure consistent area order.
    const out: Array<{ key: number | 'other'; title: string; items: Item[] }> = [];
    for (const a of AREAS) {
      const arr = map.get(a);
      if (arr && arr.length) out.push({ key: a, title: `Area ${a}`, items: arr });
    }
    const other = map.get('other');
    if (other && other.length) out.push({ key: 'other', title: 'Other', items: other });
    return out;
  }, [visibleItems]);

  const selectedArray = useMemo(() => Array.from(selected).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [selected]);

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function selectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of visibleCodes) next.add(s);
      return next;
    });
  }

  function clearAll() {
    setSelected(new Set());
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      {/* Hidden input consumed by server actions */}
      <input type="hidden" name={name} value={JSON.stringify(selectedArray)} />

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-xs text-white/70">
          Selected: <span className="font-semibold text-white">{selected.size}</span>
          {mode !== 'all' ? (
            <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
              {mode.toUpperCase()}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            className="ui-input h-9 w-40"
            placeholder="Search sectors (e.g. ZOB27 or Area 2)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="button" className="ui-btn ui-btn--ghost h-9" onClick={selectAll}>
            Select visible
          </button>
          <button type="button" className="ui-btn ui-btn--ghost h-9" onClick={clearAll}>
            Clear
          </button>
        </div>
      </div>

      <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-white/10 bg-black/10 p-2">
        {visibleItems.length === 0 ? (
          <div className="text-sm text-white/60 px-2 py-3">
            No sectors available. (Is <span className="font-mono">/public/maps/zob_sectors.geojson</span> present?)
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map((g) => (
              <div key={String(g.key)}>
                <div className="sticky top-0 z-10 -mx-2 mb-2 border-b border-white/10 bg-black/20 px-2 py-2 text-xs font-semibold text-white/80 backdrop-blur">
                  {g.title} <span className="font-normal text-white/50">({g.items.length})</span>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {g.items.map((it) => {
                    const checked = selected.has(it.code);
                    return (
                      <label
                        key={it.code}
                        className={
                          'flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1 text-sm ' +
                          (checked
                            ? 'border-white/30 bg-white/10 text-white'
                            : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/8')
                        }
                        title={it.label}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(it.code)}
                          className="accent-white"
                        />
                        <div className="min-w-0">
                          <div className="font-mono text-[12px] leading-4">{it.code}</div>
                          {it.label !== it.code ? (
                            <div className="truncate text-[11px] text-white/55 leading-4">{it.label}</div>
                          ) : null}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
</div>
  );
}
