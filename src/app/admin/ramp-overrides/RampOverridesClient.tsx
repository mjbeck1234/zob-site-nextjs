'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import RampOverridesMap from './RampOverridesMap';

type OverrideRow = {
  id: number;
  icao: string;
  type: 'add' | 'hide';
  stand_id: string;
  stand_ref: string | null;
  lat: number | null;
  lon: number | null;
  name: string | null;
  airline: string | null;
  area_id: string | null;
  active: number;
  created_by_cid: number | null;
  created_at_ms: number;
  updated_at_ms: number;
};

type RampOccStand = {
  id: string;
  ref?: string;
  name?: string;
  airline?: string;
  areaId?: string;
  lat?: number;
  lon?: number;
};

type RampArea = { id: string; label: string };

type RampCenter = { lat: number; lon: number };
type RampBbox = { south: number; west: number; north: number; east: number };

function fmtMs(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(ms)) return '';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const s = String(text || '');
  let i = 0;
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };

  const pushRow = () => {
    // ignore fully-empty trailing rows
    if (row.length === 1 && row[0].trim() === '' && rows.length) {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  while (i < s.length) {
    const ch = s[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = s[i + 1];
        if (next === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ',') {
      pushField();
      i += 1;
      continue;
    }

    if (ch === '\n') {
      pushField();
      pushRow();
      i += 1;
      continue;
    }

    if (ch === '\r') {
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  pushField();
  pushRow();
  return rows;
}

type CsvImportRow = {
  type: 'add' | 'hide';
  icao?: string;
  standId?: string;
  standRef?: string;
  lat?: number;
  lon?: number;
  name?: string;
  airline?: string;
  areaId?: string;
  active?: boolean;
};

function normalizeCsvRows(icaoDefault: string, csv: string): { rows: CsvImportRow[]; error?: string } {
  const raw = parseCsv(csv);
  if (!raw.length) return { rows: [], error: 'CSV appears empty.' };

  const header = raw[0].map((h) => String(h || '').trim().toLowerCase());
  const idx = (k: string) => header.indexOf(k);

  const col = (row: string[], key: string) => {
    const i = idx(key);
    if (i < 0) return '';
    return String(row[i] ?? '').trim();
  };

  const rows: CsvImportRow[] = [];
  for (let r = 1; r < raw.length; r++) {
    const row = raw[r];
    if (!row || row.every((c) => String(c || '').trim() === '')) continue;

    const typeRaw = (col(row, 'type') || col(row, 'override_type') || '').toLowerCase();
    const type = typeRaw === 'hide' ? 'hide' : 'add';

    const icao = (col(row, 'icao') || icaoDefault || '').toUpperCase().trim();

    const standId = col(row, 'stand_id') || col(row, 'standid') || col(row, 'id');
    const standRef = col(row, 'stand_ref') || col(row, 'standref') || col(row, 'ref');
    const lat = Number(col(row, 'lat') || col(row, 'latitude'));
    const lon = Number(col(row, 'lon') || col(row, 'lng') || col(row, 'longitude'));

    const name = col(row, 'name') || undefined;
    const airline = col(row, 'airline') || col(row, 'operator') || undefined;
    const areaId = col(row, 'area_id') || col(row, 'areaid') || col(row, 'area') || undefined;

    const activeRaw = (col(row, 'active') || '').toLowerCase();
    const active =
      activeRaw === '' ? undefined : activeRaw === '1' || activeRaw === 'true' || activeRaw === 'yes' || activeRaw === 'y';

    rows.push({
      type,
      icao: icao || undefined,
      standId: standId || undefined,
      standRef: standRef || undefined,
      lat: Number.isFinite(lat) ? lat : undefined,
      lon: Number.isFinite(lon) ? lon : undefined,
      name,
      airline,
      areaId,
      active,
    });
  }

  if (!rows.length) return { rows: [], error: 'No data rows found.' };
  return { rows };
}

function dispatchOverridesChanged() {
  try {
    window.dispatchEvent(new Event('rampStandOverridesChanged'));
  } catch {
    // ignore
  }
}

export default function RampOverridesClient() {
  const [icao, setIcao] = useState('KDTW');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableExists, setTableExists] = useState<boolean | null>(null);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [stands, setStands] = useState<RampOccStand[]>([]);
  const [areas, setAreas] = useState<RampArea[]>([]);
  const [center, setCenter] = useState<RampCenter | null>(null);
  const [bbox, setBbox] = useState<RampBbox | null>(null);

  // Map tool mode is mutually exclusive: either click-to-place OR drag existing overrides.
  type MapToolMode = 'place' | 'drag' | 'off';
  const [mapToolMode, setMapToolMode] = useState<MapToolMode>('place');
  const placementEnabled = mapToolMode === 'place';
  const dragOverridesEnabled = mapToolMode === 'drag';
  const [picked, setPicked] = useState<{ lat: number; lon: number } | null>(null);

  // CSV import
  const [csvText, setCsvText] = useState('');
  const [csvRows, setCsvRows] = useState<CsvImportRow[]>([]);
  const [csvParseError, setCsvParseError] = useState<string | null>(null);
  const csvFileRef = useRef<HTMLInputElement | null>(null);

  // Add form
  const [addRef, setAddRef] = useState('');
  const [addLat, setAddLat] = useState('');
  const [addLon, setAddLon] = useState('');
  const [addArea, setAddArea] = useState('');
  const [addAirline, setAddAirline] = useState('');
  const [addName, setAddName] = useState('');

  // Hide form
  const [hideQuery, setHideQuery] = useState('');
  const [hideStandId, setHideStandId] = useState('');

  const filteredStands = useMemo(() => {
    const q = hideQuery.trim().toLowerCase();
    if (!q) return stands;
    return stands.filter((s) => {
      const label = `${s.ref ?? ''} ${s.name ?? ''} ${s.airline ?? ''} ${s.id}`.toLowerCase();
      return label.includes(q);
    });
  }, [stands, hideQuery]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovRes, occRes] = await Promise.all([
        fetch(`/api/admin/ramp-overrides?icao=${encodeURIComponent(icao)}`, { cache: 'no-store' }),
        fetch(`/api/ids/ramp/occupancy?icao=${encodeURIComponent(icao)}`, { cache: 'no-store' }),
      ]);

      const ovJson = await ovRes.json();
      setTableExists(Boolean(ovJson?.tableExists));
      setOverrides(Array.isArray(ovJson?.overrides) ? ovJson.overrides : []);

      const occJson = await occRes.json();
      const occStands = Array.isArray(occJson?.stands) ? occJson.stands : [];
      const occAreas = Array.isArray(occJson?.areas) ? occJson.areas : [];
      const occCenter = occJson?.center;
      const occBbox = occJson?.bbox;
      setCenter(
        occCenter && occCenter.lat != null && occCenter.lon != null
          ? { lat: Number(occCenter.lat), lon: Number(occCenter.lon) }
          : null
      );
      setBbox(
        occBbox && occBbox.south != null && occBbox.west != null && occBbox.north != null && occBbox.east != null
          ? {
              south: Number(occBbox.south),
              west: Number(occBbox.west),
              north: Number(occBbox.north),
              east: Number(occBbox.east),
            }
          : null
      );

      setStands(
        occStands.map((s: any) => ({
          id: String(s.id ?? ''),
          ref: s.ref ?? undefined,
          name: s.name ?? undefined,
          airline: s.airline ?? undefined,
          areaId: s.areaId ?? undefined,
          lat: s.lat != null ? Number(s.lat) : undefined,
          lon: s.lon != null ? Number(s.lon) : undefined,
        }))
      );
      setAreas(occAreas.map((a: any) => ({ id: String(a.id ?? ''), label: String(a.label ?? a.id ?? '') })));
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icao]);

  const postOverride = async (payload: any) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/ramp-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(String(json?.error ?? `Request failed (${res.status})`));
      }
      dispatchOverridesChanged();
      await refresh();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

const patchOverride = async (payload: any) => {
  setLoading(true);
  setError(null);
  try {
    const res = await fetch('/api/admin/ramp-overrides', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      throw new Error(String(json?.error ?? `Request failed (${res.status})`));
    }
    dispatchOverridesChanged();
    await refresh();
  } catch (e: any) {
    setError(e?.message ? String(e.message) : 'Request failed');
  } finally {
    setLoading(false);
  }
};

const patchOverrideActive = async (id: number, active: boolean) => patchOverride({ id, active });
const patchOverrideLocation = async (id: number, lat: number, lon: number) => patchOverride({ id, lat, lon });

  const addSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await postOverride({
      type: 'add',
      icao,
      standRef: addRef,
      lat: Number(addLat),
      lon: Number(addLon),
      areaId: addArea || undefined,
      airline: addAirline || undefined,
      name: addName || undefined,
    });
  };

  const hideSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!hideStandId) {
      setError('Choose a stand to hide.');
      return;
    }
    await postOverride({ type: 'hide', icao, standId: hideStandId });
  };

const onPick = useCallback(
  (lat: number, lon: number) => {
    setPicked({ lat, lon });
    setAddLat(lat.toFixed(6));
    setAddLon(lon.toFixed(6));
  },
  [setAddLat, setAddLon]
);

const onMoveOverride = useCallback(
  async (id: number, lat: number, lon: number) => {
    // optimistic update of picked marker is handled inside the map; we just persist.
    await patchOverrideLocation(id, Number(lat.toFixed(6)), Number(lon.toFixed(6)));
  },
  [patchOverrideLocation]
);

const onCsvFile = useCallback(async (file: File | null) => {
  if (!file) return;
  try {
    const text = await file.text();
    setCsvText(text);
    const normalized = normalizeCsvRows(icao, text);
    setCsvParseError(normalized.error ?? null);
    setCsvRows(normalized.rows ?? []);
  } catch (e: any) {
    setCsvParseError(e?.message ? String(e.message) : 'Failed to read CSV');
    setCsvRows([]);
  }
}, [icao]);

const importCsv = useCallback(async () => {
  if (!csvRows.length) {
    setCsvParseError('No CSV rows to import.');
    return;
  }
  setLoading(true);
  setError(null);
  try {
    const res = await fetch('/api/admin/ramp-overrides/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icao, rows: csvRows }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      throw new Error(String(json?.error ?? `Request failed (${res.status})`));
    }
    dispatchOverridesChanged();
    // clear file input
    try {
      if (csvFileRef.current) csvFileRef.current.value = '';
    } catch {
      // ignore
    }
    setCsvText('');
    setCsvRows([]);
    setCsvParseError(null);
    await refresh();
  } catch (e: any) {
    setError(e?.message ? String(e.message) : 'Import failed');
  } finally {
    setLoading(false);
  }
}, [csvRows, icao]);

  const canEdit = tableExists !== false;

  return (
    <div className="space-y-6">
      <div className="ui-card">
        <div className="ui-card__header">
          <div className="text-sm font-semibold">Controls</div>
          <button className="ui-button" type="button" onClick={refresh} disabled={loading}>
            Refresh
          </button>
        </div>
        <div className="ui-card__body">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/60">Airport</label>
              <input
                className="ui-input w-32"
                value={icao}
                onChange={(e) => setIcao(e.target.value.toUpperCase())}
                placeholder="KDTW"
              />
              <div className="text-xs text-white/45">Currently only the selected airport is edited.</div>
            </div>

            <div className="text-xs text-white/55">
              Table: {tableExists === null ? '...' : tableExists ? 'ids_ramp_stand_overrides' : 'missing'}
            </div>
          </div>

          {error ? <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

          {tableExists === false ? (
            <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
              Your database does not contain <span className="font-semibold">ids_ramp_stand_overrides</span>. Run the SQL file in <span className="font-mono">sql/create_table_ids_ramp_stand_overrides.sql</span>.
            </div>
          ) : null}
	  </div>
	</div>

	<div className="ui-card">
	  <div className="ui-card__header">
	    <div className="text-sm font-semibold">Map tools</div>
	    <div className="flex items-center gap-2">
	      <button
	        type="button"
	        aria-pressed={placementEnabled}
	        className={
	          [
	            'inline-flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition',
	            placementEnabled
	              ? 'border-white/25 bg-white/15 text-white'
	              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10',
	          ].join(' ')
	        }
	        onClick={() => setMapToolMode((m) => (m === 'place' ? 'off' : 'place'))}
	      >
	        Click-to-place
	      </button>

	      <button
	        type="button"
	        aria-pressed={dragOverridesEnabled}
	        disabled={!canEdit}
	        className={
	          [
	            'inline-flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition',
	            !canEdit ? 'cursor-not-allowed opacity-50' : '',
	            dragOverridesEnabled
	              ? 'border-white/25 bg-white/15 text-white'
	              : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10',
	          ].join(' ')
	        }
	        onClick={() => setMapToolMode((m) => (m === 'drag' ? 'off' : 'drag'))}
	      >
	        Drag existing
	      </button>
	    </div>
	  </div>
	  <div className="ui-card__body space-y-2">
	    <div className="text-xs text-white/60">
	      {placementEnabled
	        ? 'Click on the map to populate the Add override latitude/longitude fields.'
	        : dragOverridesEnabled
	        ? 'Drag a placed override marker on the map to update its coordinates.'
	        : 'Toggle a tool to interact with override markers on the map.'}
	    </div>
	    {!canEdit ? <div className="text-xs text-amber-100/80">Overrides table is missing — tools are view-only.</div> : null}
	  </div>
	</div>

<div className="ui-card">
  <div className="ui-card__header">
    <div className="text-sm font-semibold">Bulk CSV import</div>
    <span className="ui-badge">beta</span>
  </div>
  <div className="ui-card__body space-y-3">
    <div className="text-xs text-white/60">
      Columns (case-insensitive): <span className="font-mono">type</span> (add/hide), <span className="font-mono">stand_ref</span>, <span className="font-mono">stand_id</span>, <span className="font-mono">lat</span>, <span className="font-mono">lon</span>, <span className="font-mono">area_id</span>, <span className="font-mono">airline</span>, <span className="font-mono">name</span>, <span className="font-mono">active</span>.
      <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 font-mono text-[11px] leading-5 text-white/70">
        type,stand_ref,lat,lon,area_id,airline,name,active<br/>
        add,A36,42.216912,-83.356201,McNamara,DELTA,Gate A36,1<br/>
        hide,node:12345,,,,,,,1
      </div>
    </div>

    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <input
        ref={csvFileRef}
        type="file"
        accept=".csv,text/csv"
        className="ui-input w-full md:w-auto"
        onChange={(e) => onCsvFile(e.target.files?.[0] ?? null)}
        disabled={loading || !canEdit}
      />
      <button className="ui-button" type="button" onClick={importCsv} disabled={loading || !canEdit || !csvRows.length}>
        Import {csvRows.length ? `(${csvRows.length})` : ''}
      </button>
    </div>

    {csvParseError ? (
      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">{csvParseError}</div>
    ) : null}

    {csvRows.length ? (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="text-xs text-white/60">Preview (first 10):</div>
        <div className="mt-2 space-y-1 text-xs text-white/70">
          {csvRows.slice(0, 10).map((r, idx) => (
            <div key={idx} className="font-mono break-all">
              {r.type.toUpperCase()} · {(r.standRef ?? r.standId ?? '').toString()} · {r.lat ?? ''},{r.lon ?? ''} · {r.areaId ?? ''}
            </div>
          ))}
        </div>
      </div>
    ) : null}
  </div>
</div>

      <div className="ui-card">
        <div className="ui-card__header">
          <div className="text-sm font-semibold">Overrides</div>
          <span className="ui-badge">{overrides.length}</span>
        </div>
        <div className="ui-card__body">
          {overrides.length ? (
            <div className="space-y-3">
              {overrides.map((o) => {
                const label = o.type === 'add' ? (o.stand_ref ?? o.name ?? o.stand_id) : o.stand_id;
                return (
                  <div key={String(o.id)} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          <span className="ui-badge mr-2">{o.type.toUpperCase()}</span>
                          {label}
                        </div>
                        <div className="mt-1 text-xs text-white/60 break-all">
                          <span className="font-mono">{o.stand_id}</span>
                          {o.area_id ? ` · area: ${o.area_id}` : ''}
                          {o.lat != null && o.lon != null ? ` · ${Number(o.lat).toFixed(6)}, ${Number(o.lon).toFixed(6)}` : ''}
                          {o.airline ? ` · airline: ${o.airline}` : ''}
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          Created: {fmtMs(o.created_at_ms)} · Updated: {fmtMs(o.updated_at_ms)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {o.active ? (
                          <button className="ui-button danger" type="button" disabled={loading || !canEdit} onClick={() => patchOverrideActive(o.id, false)}>
                            Disable
                          </button>
                        ) : (
                          <button className="ui-button" type="button" disabled={loading || !canEdit} onClick={() => patchOverrideActive(o.id, true)}>
                            Enable
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-white/60">No overrides yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
