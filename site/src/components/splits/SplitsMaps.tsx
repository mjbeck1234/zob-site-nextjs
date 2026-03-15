"use client";

import { useEffect, useMemo, useRef, useState } from 'react';

import { HIGH_SECTORS, LOW_SECTORS, normSplitType } from '@/lib/splits/sectorGroups';

export type SplitRow = {
  id: number;
  callsign: string;
  frequency: string;
  type: string;
  splits: unknown;
};


type SplitPreset = {
  id: string;
  name: string;
  rows: Array<{
    callsign: string;
    frequency: string;
    type: 'high' | 'low';
    splits: string[];
  }>;
};

const BUILTIN_PRESETS: SplitPreset[] = [
  {
    id: 'all-hi-lo-single',
    name: 'All sectors (single freq each)',
    rows: [
      {
        callsign: 'CLE_HI_CTR',
        frequency: '119.875',
        type: 'high',
        splits: Array.from(HIGH_SECTORS),
      },
      {
        callsign: 'CLE_LO_CTR',
        frequency: '120.700',
        type: 'low',
        splits: Array.from(LOW_SECTORS),
      },
    ],
  },
  {
    id: 'sample-3hi',
    name: 'Sample: 48/66/77 High',
    rows: [
      {
        callsign: 'CLE_48_CTR',
        frequency: '119.875',
        type: 'high',
        splits: ['ZOB18', 'ZOB28', 'ZOB27', 'ZOB48', 'ZOB07'],
      },
      {
        callsign: 'CLE_66_CTR',
        frequency: '125.425',
        type: 'high',
        splits: ['ZOB57', 'ZOB66', 'ZOB67'],
      },
      {
        callsign: 'CLE_77_CTR',
        frequency: '134.125',
        type: 'high',
        splits: ['ZOB37', 'ZOB36', 'ZOB77'],
      },
    ],
  },
];

const PRESET_STORAGE_KEY = 'zob_split_presets_v1';

function warnSplitsMapIssue(context: string, error?: unknown) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[splits-map] ${context}`, error);
  }
}

// High-contrast palette used for assigning colors to unique frequencies (stable per page render).
// Ordered to keep adjacent picks maximally distinct for the common case of only a few frequencies.
const FREQ_PALETTE = [
  '#00A6FF', // bright blue
  '#FF006E', // magenta
  '#2BD955', // green
  '#FFB000', // amber
  '#8338EC', // purple
  '#00E5FF', // cyan
  '#FF4D4D', // red
  '#B4FF00', // lime
  '#FFD166', // yellow
  '#3A86FF', // blue-alt
  '#06D6A0', // teal
  '#EF476F', // pink-red
  '#118AB2', // steel blue
  '#F72585', // hot pink
  '#FB5607', // orange
  '#8AC926', // green-alt
  '#FFCA3A', // gold
  '#1982C4', // azure
  '#6A4C93', // violet
];

function normalizeFrequency(value: unknown): string {
  if (value == null) return '';

  // Common shape in older code: ["119.875"].
  if (Array.isArray(value)) return String(value[0] ?? '').trim();

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Keep common 3-decimal aviation format without trailing zeros noise.
    const s = value.toFixed(3);
    return s.replace(/0+$/g, '').replace(/\.$/, '');
  }

  const s = String(value).trim();
  // If someone stored a JSON array string, try to parse it.
  if (s.startsWith('[') && s.endsWith(']')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return String(parsed[0] ?? '').trim();
    } catch {}
  }

  return s;
}

function normalizeSectorCodes(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((v) => String(v ?? '').trim())
      .filter(Boolean)
      .map((s) => s.toUpperCase());
  }

  // Sometimes stored as a JSON array string (e.g. "[\"ZOB18\",\"ZOB28\"]").
  // If so, parse and reuse the array codepath.
  if (typeof value === 'string') {
    const raw = value.trim();

    // Most robust path: extract known sector codes even if the string contains
    // brackets/quotes/trailing commas/extra text (e.g. "ZOB18,ZOB28," or
    // "[\"ZOB18\",\"ZOB28\"]").
    const matches = raw.match(/ZOB\d{2}/gi);
    if (matches && matches.length) {
      return Array.from(new Set(matches.map((s) => s.trim().toUpperCase())));
    }

    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return normalizeSectorCodes(parsed);
      } catch {}
    }

    // Otherwise treat as CSV/whitespace string, but strip common punctuation/quotes.
    return raw
      .split(/[\s,]+/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/^\[+/, '').replace(/\]+$/, '').replace(/^"+|"+$/g, ''))
      .filter(Boolean)
      .map((s) => s.toUpperCase());
  }

  return [];
}


function hashString(input: string): number {
  // Deterministic, fast hash (djb2-ish). Good enough for stable palette indexing.
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
  }
  // Force unsigned
  return h >>> 0;
}

function colorForFrequency(freq: string): string {
  // High-contrast categorical palette (stable per frequency).
  const key = normalizeFrequency(freq).trim() || 'NOFREQ';
  const palette = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf', '#393b79', '#637939', '#8c6d31', '#843c39', '#7b4173', '#3182bd', '#31a354', '#756bb1', '#636363', '#e6550d'];
  const idx = hashString(key) % palette.length;
  return palette[idx];
}

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

type MapProps = {
  title: string;
  description: string;
  rows: SplitRow[];
  sectorSet: Set<string>;
  freqColors: Record<string, string>;
  geojsonUrl?: string;
};

function SplitsMap({ title, description, rows, sectorSet, freqColors, geojsonUrl = '/maps/zob_sectors.geojson' }: MapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const geoRef = useRef<any>(null);
  const geoUrlRef = useRef<string | null>(null);
  const fittedRef = useRef<boolean>(false);
  const [hasGeo, setHasGeo] = useState<boolean | null>(null);
  // Leaflet is loaded dynamically; in dev, the geojson effect can run before the map exists.
  // We use this flag to trigger a re-run once the map has actually been created.
  const [mapReady, setMapReady] = useState(false);

  const normalized = useMemo(() => {
    return rows.map((r) => ({
      ...r,
      callsign: String(r.callsign ?? '').trim().toUpperCase(),
      frequency: normalizeFrequency((r as any).frequency),
      sectors: normalizeSectorCodes(r.splits),
    }));
  }, [rows]);

  const sectorToRow = useMemo(() => {
    const m = new Map<string, { callsign: string; frequency: string }>();
    for (const r of normalized) {
      for (const s of r.sectors) m.set(s, { callsign: r.callsign, frequency: r.frequency });
    }
    return m;
  }, [normalized]);

  const counts = useMemo(() => {
    const total = sectorSet.size;
    let highlighted = 0;
    for (const s of sectorSet) if (sectorToRow.has(s)) highlighted++;
    return { total, highlighted };
  }, [sectorSet, sectorToRow]);

  // Initialize the Leaflet map once.
  // IMPORTANT: In Next.js dev (Fast Refresh / React StrictMode), effects can run multiple times.
  // We guard with mapRef and also clear any stale Leaflet container id to avoid:
  // "Map container is already initialized."
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!containerRef.current) return;
      if (mapRef.current) return;

      const L = (await import('leaflet')).default;
      leafletRef.current = L;

      // If a previous Leaflet instance was attached to this div (HMR), Leaflet will refuse to init.
      const container: any = containerRef.current;
      if (container && container._leaflet_id) {
        try {
          delete container._leaflet_id;
        } catch {}
      }

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 19,
      }).addTo(map);

      // Default view (will be overridden by fitBounds when geojson is loaded)
      map.setView([41.3, -82.5], 6);

      // Disable all user-initiated zooming (wheel, pinch, dblclick, box).
      // Keeps the map readable and prevents accidental zoom while scrolling the page.
      try {
        map.scrollWheelZoom?.disable();
        map.doubleClickZoom?.disable();
        map.boxZoom?.disable();
        map.keyboard?.disable();
        map.touchZoom?.disable();
      } catch {}

      if (!cancelled) setMapReady(true);
    })();

    return () => {
      cancelled = true;
      try {
        if (layerRef.current) layerRef.current.remove();
      } catch {}
      try {
        if (mapRef.current) mapRef.current.remove();
      } catch (error) {
        warnSplitsMapIssue('Failed to remove split layer during cleanup', error);
      }
      layerRef.current = null;
      mapRef.current = null;
      leafletRef.current = null;
      geoRef.current = null;
      geoUrlRef.current = null;
      fittedRef.current = false;
      void cancelled;
    };
  }, []);

  // Load/re-style the GeoJSON layer when splits change (or URL changes), without re-initializing the map.
  useEffect(() => {
    let cancelled = false;

    async function loadAndRender() {
      if (!mapReady) return;
      const map = mapRef.current;
      const L = leafletRef.current;
      if (!map || !L) return;

      // Use one canonical file path everywhere to keep map debugging predictable.
      const candidates = Array.from(new Set([geojsonUrl, '/maps/zob_sectors.geojson'].filter(Boolean)));

      try {
        // Fetch only when URL changes; otherwise reuse cached geo and just re-style.
        if (!geoRef.current || geoUrlRef.current !== geojsonUrl) {
          geoRef.current = null;
          geoUrlRef.current = geojsonUrl;
          fittedRef.current = false;

          let geo: any | null = null;
          for (const url of candidates) {
            const res = await fetch(url, { cache: 'force-cache' });
            if (!res.ok) continue;
            geo = await res.json();
            break;
          }

          if (!geo) {
            if (!cancelled) setHasGeo(false);
            return;
          }

          geoRef.current = geo;
          if (!cancelled) setHasGeo(true);
        } else {
          if (!cancelled) setHasGeo(true);
        }

        // Replace layer to apply new styling/tooltips.
        try {
          if (layerRef.current) layerRef.current.remove();
        } catch {}
        layerRef.current = null;

        const geo = geoRef.current;
        if (!geo) return;

        const layer = L.geoJSON(geo, {
          // Render ONLY the sectors for this map (High set on the left, Low set on the right).
          filter: (feature: any) => {
            const sector = getSectorCode(feature);
            return sectorSet.has(sector);
          },
          style: (feature: any) => {
            const sector = getSectorCode(feature);
            const meta = sectorToRow.get(sector);

            // Base outline so the map never looks "blank".
            if (!meta) {
              return {
                color: '#ffffff80',
                weight: 2,
                opacity: 0.9,
                fillColor: '#000000',
                fillOpacity: 0.04,
              } as any;
            }

            const color = freqColors[meta.frequency] ?? FREQ_PALETTE[0];
            return {
              color,
              weight: 3.5,
              opacity: 1,
              fillColor: color,
              fillOpacity: 0.35,
            } as any;
          },
          onEachFeature: (feature: any, l: any) => {
            const sector = getSectorCode(feature);
            const meta = sectorToRow.get(sector);
            if (meta) {
              l.bindTooltip(
                `<div style="font-weight:600">${sector}</div><div style="opacity:.85">${meta.callsign} (${meta.frequency})</div>`,
                { sticky: true, direction: 'top' }
              );
            } else {
              l.bindTooltip(`<div style="font-weight:600">${sector}</div>`, {
                sticky: true,
                direction: 'top',
              });
            }
          },
        }).addTo(map);

        layerRef.current = layer;

        // Fit once per URL load; don't "yoink" the user's view on every refresh.
        const bounds = layer.getBounds?.();
        if (!fittedRef.current && bounds && bounds.isValid && bounds.isValid()) {
          map.fitBounds(bounds, { padding: [20, 20] });
          fittedRef.current = true;
        }
      } catch (error) {
        warnSplitsMapIssue('Failed to load sector geometry for splits map', error);
        if (!cancelled) setHasGeo(false);
      }
    }

    loadAndRender();

    return () => {
      cancelled = true;
      // Only remove the layer for this effect; the map is owned by the init effect.
      try {
        if (layerRef.current) layerRef.current.remove();
      } catch (error) {
        warnSplitsMapIssue('Failed to remove split layer during cleanup', error);
      }
      layerRef.current = null;
    };
  }, [geojsonUrl, sectorToRow, mapReady]);

  const legend = useMemo(() => {
    const byFreq = new Map<string, Set<string>>();
    for (const r of normalized) {
      const freq = r.frequency?.trim();
      if (!freq) continue;
      if (!byFreq.has(freq)) byFreq.set(freq, new Set());
      if (r.callsign) byFreq.get(freq)!.add(r.callsign);
    }

    return Array.from(byFreq.entries()).map(([frequency, callsigns]) => ({
      frequency,
      callsigns: Array.from(callsigns).sort(),
      color: freqColors[frequency] ?? FREQ_PALETTE[0],
    }));
  }, [normalized]);

  return (
    <div className="ui-card">
      <div className="ui-card__header">
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="ui-card__body space-y-3">
        <p className="text-sm text-white/70">{description}</p>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div ref={containerRef} className="h-[460px] w-full" />
        </div>

        <div className="text-xs text-white/60">
          Highlighted sectors: <span className="text-white/80">{counts.highlighted}</span> / {counts.total}
        </div>

        {hasGeo === false ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
            <div className="font-semibold text-white/90">Sector geometry file missing</div>
            <div className="mt-1">
              Upload a GeoJSON of ZOB sectors to{' '}
              <code className="rounded bg-black/40 px-1 py-0.5">public/maps/zob_sectors.geojson</code>.
              Features should include an <code className="rounded bg-black/40 px-1 py-0.5">id</code> or <code className="rounded bg-black/40 px-1 py-0.5">name</code> like <code className="rounded bg-black/40 px-1 py-0.5">ZOB12</code>.
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {legend.map((l) => {
            const label =
              l.callsigns.length <= 2
                ? l.callsigns.join(', ')
                : `${l.callsigns[0]} +${l.callsigns.length - 1}`;
            return (
              <span
                key={l.frequency}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/85"
              >
                <span className="h-2 w-2 rounded" style={{ background: l.color }} />
                <span className="font-semibold">{l.frequency}</span>
                {label ? <span className="text-white/60">({label})</span> : null}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}


export default function SplitsMaps({ rows }: { rows: SplitRow[] }) {
  // Normalize + defensively parse sector code lists.
  const normalized = useMemo(() => {
    return (rows ?? []).map((r) => ({
      id: Number((r as any)?.id ?? 0),
      callsign: String((r as any)?.callsign ?? ''),
      frequency: normalizeFrequency(String((r as any)?.frequency ?? '')),
      type: String((r as any)?.type ?? ''),
      splits: normalizeSectorCodes((r as any)?.splits),
    })) as Array<{ id: number; callsign: string; frequency: string; type: string; splits: string[] }>;
  }, [rows]);

  const high = useMemo(() => normalized.filter((r) => normSplitType(r.type) === 'high'), [normalized]);
  const low = useMemo(() => normalized.filter((r) => normSplitType(r.type) === 'low'), [normalized]);

  // Assign colors to each unique frequency (stable across both maps).
  const freqColors = useMemo(() => {
    const set = new Set<string>();
    for (const r of normalized) {
      const f = normalizeFrequency(r.frequency);
      if (f) set.add(f);
    }

    const freqs = Array.from(set);
    freqs.sort((a, b) => {
      const na = Number.parseFloat(a);
      const nb = Number.parseFloat(b);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
      return a.localeCompare(b);
    });

    const map: Record<string, string> = {};
    freqs.forEach((f, i) => {
      map[f] = FREQ_PALETTE[i % FREQ_PALETTE.length];
    });
    return map;
  }, [normalized]);

  return (
    <div className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-2">
        <SplitsMap
          title="High Splits"
          description="All ZOB High Splits cover FL240-UNL with the exception of areas spanning BUF, ROC, and JHW covering FL280-UNL."
          rows={high as any}
          sectorSet={HIGH_SECTORS}
          freqColors={freqColors}
        />
        <SplitsMap
          title="Low Splits"
          description="All ZOB Low Splits cover SFC-FL230 with the exception of areas spanning BUF, ROC, and JHW covering SFC-FL270."
          rows={low as any}
          sectorSet={LOW_SECTORS}
          freqColors={freqColors}
        />
      </div>
    </div>
  );
}
