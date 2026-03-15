'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

import { LoadAircraft, type AircraftSnapshot } from './loadAircraft';
import { RoutePlanner } from '@/components/map/routePlotter';
import { useOptionalRoutePlanner } from '@/components/map/routePlannerContext';
import { ZOB_NEIGHBOR_ARTCCS } from '@/lib/ids/config';

const TILE_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

// Show stand/gate labels at most practical zoom levels.
// We still hide them if zoomed way out to avoid unreadable clutter.
const STAND_LABEL_MIN_ZOOM = 12;
const GROUP_LABEL_MIN_ZOOM = 13;

export function MapView({
  rampAirport = null,
  rampIconScale = 1,
  mode = 'controller',
  defaultCallsign = '',
  pilotCanReserve = true,
  pilotCanAssign = true,
  pilotHoldPrefix = '',
}: {
  rampAirport?: string | null;
  rampIconScale?: number;
  mode?: 'controller' | 'pilot';
  defaultCallsign?: string;
  /**
   * Pilot mode: allow creating/removing HELD reservations.
   * When false, the map is view-only.
   */
  pilotCanReserve?: boolean;
  /**
   * Pilot mode: allow assigning a gate (requires being connected on the network).
   * When false, pilots can still reserve (if pilotCanReserve=true).
   */
  pilotCanAssign?: boolean;
  /**
   * Pilot mode: how we prefix HELD notes in the UI (server is authoritative).
   * Example: "DAL143 ARR" or "DAL143 DEP".
   */
  pilotHoldPrefix?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const initialized = useRef(false);
  const destroyed = useRef(false);
  const initInFlightRef = useRef(false);
  const initAttemptsRef = useRef(0);
  const leafletRef = useRef<any>(null);

  const pathname = usePathname();
  const routePlanner = useOptionalRoutePlanner();

  const [mapReady, setMapReady] = useState(false);
  const formatLocalTime = (ms: number) => {
    try {
      const d = new Date(ms);
      return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '';
    }
  };
  const artccLayerRef = useRef<any>(null);

  // Ramp mode (gate occupancy)
  const rampStandsLayerRef = useRef<any>(null);
  const rampTrafficLayerRef = useRef<any>(null);
  const rampStandMarkersRef = useRef<Map<string, any>>(new Map());
  const rampStandLabelShowRef = useRef<boolean>(true);
  // Group/cluster labels (shown when zoomed out)
  const rampStandGroupLabelsLayerRef = useRef<any>(null);
  const rampStandGroupDataRef = useRef<Map<string, { label: string; lat: number; lon: number; count: number }>>(
    new Map()
  );
  const didShowRampStandGroupLabelsRef = useRef<boolean>(false);
  const rampLastOccRef = useRef<number>(0);
  const rampIntervalRef = useRef<number | null>(null);
  const prevViewRef = useRef<{ lat: number; lon: number; zoom: number } | null>(null);
  const activeRampRef = useRef<string | null>(null);
  const didSetRampViewRef = useRef(false);
  // Cache last-good ramp view per airport so re-entering the Ramp tab never feels "blank".
  const lastRampCenterRef = useRef<Record<string, { lat: number; lon: number; zoom?: number }>>({});

  // Avoid spamming toasts when ramp endpoints fail.
  const rampOccFailToastAtRef = useRef<number>(0);

  // Fallback centers so pilots still get zoomed to the field even if the occupancy endpoint fails.
  const RAMP_FALLBACK_CENTERS: Record<string, { lat: number; lon: number; zoom: number }> = {
    KDTW: { lat: 42.2124, lon: -83.3534, zoom: 16 },
  };

  // Ramp "claim" dialog state
  type ClaimStand = {
    icao: string;
    standId: string;
    label: string;
    occupied: boolean;
    manual: boolean;
    held?: boolean;
    holdNote?: string;
    currentCallsign?: string;
  };

  const [claimOpen, setClaimOpen] = useState(false);
  const [claimStand, setClaimStand] = useState<ClaimStand | null>(null);
  const [callInput, setCallInput] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [groundLoading, setGroundLoading] = useState(false);
  const [groundTraffic, setGroundTraffic] = useState<any[]>([]);
  const [claimBusy, setClaimBusy] = useState(false);
  const [holdBusy, setHoldBusy] = useState(false);
  const [holdNote, setHoldNote] = useState<string>('');
  const [pilotNote, setPilotNote] = useState<string>('');
  const [softMapError, setSoftMapError] = useState<string | null>(null);
  const [aircraftSearch, setAircraftSearch] = useState<string>('');
  const [aircraftSnapshots, setAircraftSnapshots] = useState<AircraftSnapshot[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftSnapshot | null>(null);
  const [aircraftSearchMessage, setAircraftSearchMessage] = useState<string | null>(null);

  const reportSoftMapIssue = (context: string, error?: unknown, userMessage?: string) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[ids-map] ${context}`, error);
    }
    if (userMessage) {
      setSoftMapError((prev) => prev ?? userMessage);
    }
  };

  const isPilot = mode === 'pilot';
  const defaultCs = (defaultCallsign ?? '').trim().toUpperCase();
  const holdPrefix = (pilotHoldPrefix ?? '').trim();

  // Leaflet event handlers are attached once per marker and will otherwise capture stale React props.
  // Keep pilot context in refs so popup buttons (Reserve/Assign) always use the latest callsign and permissions.
  const pilotCtxRef = useRef({
    cs: '',
    canReserve: true,
    canAssign: true,
    holdPrefix: '',
  });

  useEffect(() => {
    pilotCtxRef.current = {
      cs: defaultCs,
      canReserve: Boolean(pilotCanReserve),
      canAssign: Boolean(pilotCanAssign),
      holdPrefix,
    };
  }, [defaultCs, pilotCanReserve, pilotCanAssign, holdPrefix]);

  const claimIcao = (claimStand?.icao ?? 'KDTW').trim().toUpperCase();

  const normalize = (id: string | undefined) => (id ?? '').replace(/^K/, '').trim().toUpperCase();

  const escapeHtml = (s: string) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const filteredTraffic = useMemo(() => {
    const q = search.trim().toUpperCase();
    const list = Array.isArray(groundTraffic) ? groundTraffic : [];
    if (!q) return list;
    return list.filter((t: any) => String(t?.callsign ?? '').toUpperCase().includes(q));
  }, [groundTraffic, search]);

  const aircraftSuggestions = useMemo(() => {
    return aircraftSnapshots
      .map((a) => String(a?.callsign ?? '').trim().toUpperCase())
      .filter(Boolean)
      .slice()
      .sort((a, b) => a.localeCompare(b));
  }, [aircraftSnapshots]);

  const highlightedAircraftCallsign = useMemo(() => {
    return String(selectedAircraft?.callsign ?? '').trim().toUpperCase();
  }, [selectedAircraft]);

  const formatWakeDisplay = (aircraft: AircraftSnapshot | null) => {
    if (!aircraft) return '—';
    const label = String(aircraft.wakeLabel ?? '').trim();
    const code = String(aircraft.wakeCategory ?? '').trim();
    if (!label || label === 'Unknown') return code || '—';
    return code ? `${label} (${code})` : label;
  };

  const displaySelectedAircraftRoute = (aircraft?: AircraftSnapshot | null) => {
    const target = aircraft ?? selectedAircraft;
    const rawRoute = String(target?.route ?? '').trim();

    if (!target) {
      setAircraftSearchMessage('Select an aircraft first to display its route.');
      return;
    }

    if (!rawRoute) {
      setAircraftSearchMessage(`No filed route is available for ${target.callsign}.`);
      return;
    }

    if (!routePlanner) {
      setAircraftSearchMessage('Route plotting is unavailable on this page.');
      return;
    }

    const queued = routePlanner.queueRoute({ route: rawRoute, source: 'custom' });
    if (!queued) {
      setAircraftSearchMessage(`${target.callsign}'s filed route is already displayed.`);
      toast.warning(`Route for ${target.callsign} is already displayed`);
      return;
    }

    setAircraftSearchMessage(`Displaying ${target.callsign}'s filed route on the map.`);
    toast.success(`Displaying route for ${target.callsign}`);
  };

  const focusAircraftByCallsign = (rawCallsign?: string) => {
    const query = String(rawCallsign ?? aircraftSearch).trim().toUpperCase();
    if (!query) {
      setAircraftSearchMessage('Enter a callsign to search the map.');
      return;
    }

    const exact = aircraftSnapshots.find((a) => String(a?.callsign ?? '').toUpperCase() === query);
    const partial = exact
      ? exact
      : aircraftSnapshots.find((a) => String(a?.callsign ?? '').toUpperCase().includes(query));

    if (!partial) {
      setAircraftSearch(query);
      setSelectedAircraft(null);
      setAircraftSearchMessage(`No tracked aircraft matched ${query}.`);
      return;
    }

    setAircraftSearch(partial.callsign);
    setSelectedAircraft(partial);
    setAircraftSearchMessage(null);

    const map = mapRef.current;
    if (!map) return;
    const currentZoom = Number(map.getZoom?.() ?? 0);
    const targetZoom = Math.max(currentZoom, 9);
    safeSetView(map, Number(partial.latitude), Number(partial.longitude), targetZoom);
  };

  // Load list of "on-ground" callsigns when claim UI opens.
  useEffect(() => {
    if (!claimOpen) return;
    const icao = claimIcao;
    let cancelled = false;

    setGroundLoading(true);
    setGroundTraffic([]);

    fetch(`/api/ids/ramp/ground?icao=${encodeURIComponent(icao)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setGroundTraffic(Array.isArray(j?.traffic) ? j.traffic : []);
      })
      .catch((error) => {
        if (cancelled) return;
        reportSoftMapIssue('Failed to load on-ground callsigns for claim dialog', error, 'The gate picker could not load current on-ground callsigns.');
        setGroundTraffic([]);
      })
      .finally(() => {
        if (cancelled) return;
        setGroundLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [claimOpen, claimIcao]);

  const deriveArtccId = (ctrl: any): string => {
    // Prefer explicit artccId, but fall back to parsing from callsign.
    const raw = (ctrl?.artccId ?? '').toString().trim();
    if (raw) return normalize(raw);
    const callsign = String(ctrl?.callsign ?? '').trim().toUpperCase();
    // Typical enroute callsigns look like ZOB_48_CTR, ZNY_CTR, CZYZ_CTR, etc.
    const prefix = callsign.includes('_') ? callsign.split('_')[0] : callsign.slice(0, 4);
    return normalize(prefix);
  };

  const loadSectors = async (map: any) => {
    const L = leafletRef.current;
    if (!L || !map || destroyed.current) return;
    // If the map was removed/unmounted, Leaflet tears down panes; guard against late async work.
    if (!map._container || !map._mapPane || !map.getPane || !map.getPane('artccPane')) return;

    try {
      const [artccGeo, controllerData] = await Promise.all([
        fetch('/boundaries.geojson').then((res) => res.json()),
        fetch('/api/ids/controllers', { cache: 'no-store' }).then((res) => res.json()),
      ]);

      const activeArtccs = new Set((controllerData.enroute ?? []).map((ctrl: any) => deriveArtccId(ctrl)));
      const neighborSet = new Set(ZOB_NEIGHBOR_ARTCCS.map((id) => normalize(id)));

      const artccFeatures: any[] = artccGeo.features ?? [];

      // Always highlight ZOB so the “map of ZOB” is obvious at a glance.
      const zobFeatures = artccFeatures.filter((f: any) => normalize(f?.properties?.id) === 'ZOB');
      const nonZobFeatures = artccFeatures.filter((f: any) => normalize(f?.properties?.id) !== 'ZOB');

      // Highlight *neighbors* distinctly (active vs inactive), but still show other ARTCCs faintly for context.
      const nonZobNeighbors = nonZobFeatures.filter((f: any) => neighborSet.has(normalize(f?.properties?.id)));
      const nonZobOthers = nonZobFeatures.filter((f: any) => !neighborSet.has(normalize(f?.properties?.id)));

      const neighborActive = nonZobNeighbors.filter((f: any) => activeArtccs.has(normalize(f?.properties?.id)));
      const neighborInactive = nonZobNeighbors.filter((f: any) => !activeArtccs.has(normalize(f?.properties?.id)));

      const otherActive = nonZobOthers.filter((f: any) => activeArtccs.has(normalize(f?.properties?.id)));
      const otherInactive = nonZobOthers.filter((f: any) => !activeArtccs.has(normalize(f?.properties?.id)));

      const inactiveArtccLayer = L.geoJSON(otherInactive, {
        pane: 'artccPane',
        interactive: false,
        style: { color: '#808080', weight: 1, fillOpacity: 0.04 },
      });
      const activeArtccLayer = L.geoJSON(otherActive, {
        pane: 'artccPane',
        interactive: false,
        style: { color: '#00cc44', weight: 1, fillOpacity: 0.08 },
      });

      const neighborInactiveLayer = L.geoJSON(neighborInactive, {
        pane: 'artccPane',
        interactive: false,
        style: { color: '#a855f7', weight: 2, fillOpacity: 0.05 },
      });
      const neighborActiveLayer = L.geoJSON(neighborActive, {
        pane: 'artccPane',
        interactive: false,
        style: { color: '#22c55e', weight: 2, fillOpacity: 0.14 },
      });
      const zobLayer = L.geoJSON(zobFeatures, {
        pane: 'artccPane',
        interactive: false,
        style: { color: '#3b82f6', weight: 2, fillOpacity: 0.08 },
      });

      // Re-check map state after async fetches.
      if (destroyed.current || !map._container || !map.getPane('artccPane')) return;

      const newArtccLayer = L.layerGroup([
        inactiveArtccLayer,
        activeArtccLayer,
        neighborInactiveLayer,
        neighborActiveLayer,
        zobLayer,
      ]);

      if (artccLayerRef.current) map.removeLayer(artccLayerRef.current);
      artccLayerRef.current = newArtccLayer;
      // Leaflet will try to append into the pane during addTo; only do this if the pane still exists.
      if (!destroyed.current && map._container && map.getPane('artccPane')) {
        newArtccLayer.addTo(map);
      }
    } catch (error) {
      console.error('Error loading sectors:', error);
    }
  };


function isUsableLeafletMap(map: any): boolean {
  try {
    if (!map || destroyed.current) return false;
    if (mapRef.current !== map) return false;
    const container = (map.getContainer?.() ?? map._container) as HTMLElement | undefined;
    if (!container || !container.isConnected) return false;
    // Leaflet internals can be torn down during route transitions; guard against that.
    if (!map._mapPane) return false;
    return true;
  } catch {
    return false;
  }
}

function safeSetView(map: any, lat: number, lon: number, zoom: number): boolean {
  if (!isUsableLeafletMap(map)) return false;
  // Defer until the next paint; avoids _leaflet_pos errors when containers are mid-transition.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!isUsableLeafletMap(map)) return;
      try {
        map.setView([lat, lon], zoom, { animate: false });
      } catch {
        // ignore
      }
    });
  });
  return true;
}

function safeInvalidateSize(map: any): boolean {
  if (!isUsableLeafletMap(map)) return false;
  requestAnimationFrame(() => {
    if (!isUsableLeafletMap(map)) return;
    try {
      map.invalidateSize();
    } catch {
      // ignore
    }
  });
  return true;
}



const updateRampStandGroupLabelsForZoom = (map: any, show: boolean) => {
  const L = leafletRef.current;
  if (!L || destroyed.current || !map) return;

  if (!rampStandGroupLabelsLayerRef.current) {
    try {
      rampStandGroupLabelsLayerRef.current = L.layerGroup([], { pane: 'rampPane' });
      rampStandGroupLabelsLayerRef.current.addTo(map);
    } catch {
      // ignore
      return;
    }
  }

  const layer = rampStandGroupLabelsLayerRef.current;

  if (!show) {
    if (didShowRampStandGroupLabelsRef.current) {
      try {
        layer.clearLayers();
      } catch {
        // ignore
      }
    }
    didShowRampStandGroupLabelsRef.current = false;
    return;
  }

  didShowRampStandGroupLabelsRef.current = true;

  // Rebuild markers each time (few groups, cheap), ensures updates when stands change.
  try {
    layer.clearLayers();
  } catch (error) {
    reportSoftMapIssue('Failed to clear ramp stand group labels layer', error);
  }

  const zoom = Number(map.getZoom?.() ?? 0);
  const data = rampStandGroupDataRef.current;

  for (const [, g] of data.entries()) {
	  const base = String(g.label || 'GROUP').toUpperCase();
	  // Never show noisy catch-all buckets like "OTHER (n)".
	  if (base === 'OTHER') continue;
	  const label = `${base} (${g.count})`;
    const width = Math.min(170, Math.max(58, 16 + label.length * 7));

    const icon = L.divIcon({
      className: '',
      html: `<div class="ids-ramp-gate group" style="height:18px;padding:0 10px;border-radius:9px;font-size:11px;opacity:${zoom >= 15 ? 1 : 0.92};">${label}</div>`,
      iconSize: [width, 18],
      iconAnchor: [Math.floor(width / 2), 9],
    });

    try {
      const m = L.marker([g.lat, g.lon], { icon, interactive: false, keyboard: false });
      m.addTo(layer);
    } catch {
      // ignore
    }
  }
};

const updateRampStandIconsForZoom = (map: any) => {

    const L = leafletRef.current;
    if (!L || !map || destroyed.current) return;

    const zoom = Number(map.getZoom?.() ?? 0);
    const showStand = zoom >= STAND_LABEL_MIN_ZOOM;

    // Group/area title bubbles (e.g., "MCNAMARA", "EVANS") are disabled.
    // Always ensure any previously-rendered group labels are removed.
    updateRampStandGroupLabelsForZoom(map, false);

    if (showStand === rampStandLabelShowRef.current) return;
    rampStandLabelShowRef.current = showStand;

    const scale = Math.min(2, Math.max(0.6, Number(rampIconScale) || 1));
    for (const [id, marker] of rampStandMarkersRef.current.entries()) {
      const s = (marker as any)?.__stand;
      if (!s) continue;
      const baseLabel = String(s.label ?? '').trim();
      const label = showStand ? baseLabel : '';
      const occupied = !!s.occupied;
      const held = !!s.held;
      const manual = !!s.manual;

      const baseW = label ? Math.min(86, Math.max(18, 12 + label.length * 7)) : 14;
      const baseH = 18;
      const w = Math.round(baseW * scale);
      const h = Math.round(baseH * scale);
      const padX = Math.max(0, Math.round(6 * scale));
      const fontSize = Math.max(8, Math.round(11 * scale));
      const radius = Math.max(2, Math.round(7 * scale));

      const cls = occupied
        ? 'ids-ramp-gate ids-ramp-gate-occ'
        : manual
          ? 'ids-ramp-gate ids-ramp-gate-occ ids-ramp-gate-manual'
          : held
            ? 'ids-ramp-gate ids-ramp-gate-held'
            : 'ids-ramp-gate';

      const html = `<div class="${cls}" style="width:${w}px;height:${h}px;padding:0 ${padX}px;font-size:${fontSize}px;border-radius:${radius}px;line-height:${h}px">${label || ''}</div>`;
      try {
        marker.setIcon(
          L.divIcon({
            className: '',
            html,
            iconSize: [w, h],
            iconAnchor: [Math.round(w / 2), Math.round(h / 2)],
            popupAnchor: [0, -Math.round(h / 2)],
          })
        );
      } catch {
        // ignore
      }
    }
  };

  const loadRamp = async (map: any, icao: string, forceSetView: boolean) => {
    const L = leafletRef.current;
    if (!L || !map || destroyed.current) return;

    const scale = Math.min(2, Math.max(0.6, Number(rampIconScale) || 1));

    // Ensure pane exists (z-index above boundaries; below tooltips)
    if (!map.getPane('rampPane')) {
      map.createPane('rampPane').style.zIndex = '900';
    }

    // Create layers if needed (stands below, traffic above)
    if (!rampStandsLayerRef.current) {
      rampStandsLayerRef.current = L.layerGroup([], { pane: 'rampPane' });
      rampStandsLayerRef.current.addTo(map);
    }
    // If we previously removed the layer (leaving Ramp tab), re-add it without recreating markers.
    if (rampStandsLayerRef.current && !map.hasLayer(rampStandsLayerRef.current)) {
      rampStandsLayerRef.current.addTo(map);
    }
    if (!rampTrafficLayerRef.current) {
      rampTrafficLayerRef.current = L.layerGroup([], { pane: 'rampPane' });
      rampTrafficLayerRef.current.addTo(map);
    }
    if (rampTrafficLayerRef.current && !map.hasLayer(rampTrafficLayerRef.current)) {
      rampTrafficLayerRef.current.addTo(map);
    }

    const now = Date.now();
    const shouldReloadOcc = forceSetView || now - rampLastOccRef.current > 12_000;

    // 1) Occupancy / stands (less frequent)
    if (shouldReloadOcc) {
      try {
        const res = await fetch(`/api/ids/ramp/occupancy?icao=${encodeURIComponent(icao)}`, { cache: 'no-store' });
        let json: any | null = null;
        if (res.ok) {
          json = await res.json().catch(() => null);
        } else {
          // Some deployments may block outbound calls needed by occupancy (VATSIM/Overpass), causing the ramp
          // endpoint to error. Fallback to the static stands endpoint so gates still render.
          const res2 = await fetch(`/api/ids/ramp/stands?icao=${encodeURIComponent(icao)}`, { cache: 'no-store' });
          if (res2.ok) {
            json = await res2.json().catch(() => null);
          }

          const nowToast = Date.now();
          if (nowToast - (rampOccFailToastAtRef.current || 0) > 20_000) {
            rampOccFailToastAtRef.current = nowToast;
            toast.error('Unable to load live ramp occupancy. Showing gates only (no holds/claims).');
          }
        }

        if (json) {

          const center = json?.center;
          const key = String(icao).trim().toUpperCase();
          if (center?.lat != null && center?.lon != null) {
            // Cache last-good center for this airport.
            lastRampCenterRef.current[key] = { lat: Number(center.lat), lon: Number(center.lon), zoom: 16 };
            if (forceSetView || !didSetRampViewRef.current) {
              if (safeSetView(map, Number(center.lat), Number(center.lon), 16)) {
                didSetRampViewRef.current = true;
              }
            }
          } else {
            // Some refreshes can transiently return ok:true but no center/stands. Fall back to cached view.
            const cached = lastRampCenterRef.current[key];
            if (cached && (forceSetView || !didSetRampViewRef.current)) {
              if (safeSetView(map, cached.lat, cached.lon, cached.zoom ?? 16)) {
                didSetRampViewRef.current = true;
              }
            }
          }

let stands = Array.isArray(json?.stands) ? json.stands : [];

// If we have nothing to render yet (common right after navigation / cache warm-up), fall back to the
// static stands endpoint so the ramp doesn't look empty even when the occupancy call succeeds.
if (stands.length === 0 && (rampStandMarkersRef.current?.size ?? 0) === 0) {
  try {
    const res2 = await fetch(`/api/ids/ramp/stands?icao=${encodeURIComponent(String(icao))}`, { cache: 'no-store' });
    if (res2.ok) {
      const j2 = await res2.json().catch(() => ({}));
      const s2 = Array.isArray(j2?.stands) ? j2.stands : [];
      if (s2.length) stands = s2;

      // If the occupancy payload had no center, adopt the center from /stands.
      const c2 = j2?.center;
      if ((!center || center?.lat == null || center?.lon == null) && c2?.lat != null && c2?.lon != null) {
        const key2 = String(icao).trim().toUpperCase();
        lastRampCenterRef.current[key2] = { lat: Number(c2.lat), lon: Number(c2.lon), zoom: 16 };
        if (forceSetView || !didSetRampViewRef.current) {
          if (safeSetView(map, Number(c2.lat), Number(c2.lon), 16)) {
            didSetRampViewRef.current = true;
          }
        }
      }
    }
  } catch (error) {
    reportSoftMapIssue('Failed to load static stands fallback', error);
  }
}
          // IMPORTANT: Avoid flicker / disappearing gates.
          // Some refresh cycles can transiently return an error/empty payload; in that case keep the last good stand markers.
          if (stands.length > 0) {
            const group = rampStandsLayerRef.current;
            const markerMap = rampStandMarkersRef.current;
            const nextIds = new Set<string>();

      // Precompute group/cluster labels for lower zooms (areas/operators).
try {
  const areaLabelMap = new Map<string, string>();
  const areasRaw = Array.isArray((json as any)?.areas) ? (json as any).areas : [];
  for (const a of areasRaw) {
    const id = String((a as any)?.id ?? '').trim();
    const label = String((a as any)?.label ?? '').trim();
    if (!id) continue;
    areaLabelMap.set(id, label || id);
  }

  const groups = new Map<string, { label: string; sumLat: number; sumLon: number; count: number }>();
  for (const s of stands) {
    const lat = Number((s as any).lat);
    const lon = Number((s as any).lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const areaId = String((s as any)?.areaId ?? (s as any)?.area_id ?? '').trim();
    const airline = String((s as any)?.airline ?? (s as any)?.operator ?? '').trim();

	    // Don't create an "OTHER" group label bucket. Users prefer no group-title
	    // over a noisy "OTHER (n)" label.
	    if (!areaId && !airline) continue;
    const key = areaId || (airline ? `AIRLINE:${airline.toUpperCase()}` : 'OTHER');
	    const label = areaId ? areaLabelMap.get(areaId) ?? areaId : airline ? airline.toUpperCase() : 'OTHER';

    const cur = groups.get(key);
    if (cur) {
      cur.sumLat += lat;
      cur.sumLon += lon;
      cur.count += 1;
    } else {
      groups.set(key, { label, sumLat: lat, sumLon: lon, count: 1 });
    }
  }

  const out = new Map<string, { label: string; lat: number; lon: number; count: number }>();
  for (const [k, v] of groups.entries()) {
    out.set(k, { label: v.label, lat: v.sumLat / v.count, lon: v.sumLon / v.count, count: v.count });
  }
  rampStandGroupDataRef.current = out;
} catch (error) {
  reportSoftMapIssue('Failed to build ramp stand group labels', error);
  rampStandGroupDataRef.current = new Map();
}

      for (const s of stands) {
              const id = String((s as any).id ?? '');
              if (!id) continue;
              nextIds.add(id);

              const lat = Number(s?.lat);
              const lon = Number(s?.lon);
              if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

              const occupied = !!s?.occupied;
              const manual = !!(s as any)?.manual;
              const held = !!(s as any)?.held;
              const holdNote = String((s as any)?.holdNote ?? '').trim();
              const holdExpiresAt = (s as any)?.holdExpiresAt != null ? Number((s as any).holdExpiresAt) : undefined;

              const ref = (s?.ref ?? '').toString().trim();
              const name = (s?.name ?? '').toString().trim();
              // Some cargo ramps in OSM have no ref/name on parking_position points, but do have operator/airline tags.
              const airline = ((s as any)?.airline ?? (s as any)?.operator ?? '').toString().trim();
              const baseLabel = (() => {
                // If a stand has an explicit ref (especially manual overrides), always show the full ref.
                // This preserves labels like "UPS 3" instead of collapsing to just "UPS".
                if (ref) {
                  const upRef = ref.toUpperCase().replace(/\s+/g, ' ').trim();
                  return upRef.length > 10 ? upRef.slice(0, 10) : upRef;
                }

                const base = (name || airline || '').trim();
                if (base) {
                  const up = base.toUpperCase();
                  // Prefer familiar cargo ramp names when present (only when we don't have a ref).
                  if (up.includes('FEDEX') || up.includes('FED EX') || up.includes('FEDERAL EXPRESS')) return 'FEDEX';
                  if (up === 'UPS' || up.includes('UNITED PARCEL') || up.includes(' UPS')) return 'UPS';

                  // Try to extract a concise stand/gate token from common names.
                  const m = up.match(/\b(?:STAND|GATE)\s*([A-Z0-9][A-Z0-9\-]{0,9})\b/);
                  const token = (m?.[1] || up.split(/\s+/)[0] || up).trim();
                  return token.length > 10 ? token.slice(0, 10) : token;
                }

                // Last-resort: show a short stable suffix of the OSM id so the stand is visible/clickable.
                // Example id formats: "node:123", "way:456".
                const parts = id.split(':');
                const n = parts.length === 2 ? parts[1] : id;
                return `#${n.slice(-4)}`;
              })();

              const showLabelsNow = Number(map.getZoom?.() ?? 0) >= STAND_LABEL_MIN_ZOOM;
              rampStandLabelShowRef.current = showLabelsNow;
              const label = showLabelsNow ? baseLabel : '';

              const callsign = (s?.aircraft?.callsign ?? '').toString().trim();
              const type = (s?.aircraft?.aircraftType ?? '').toString().trim();

              // Gate/stand symbol (not a dot): a small "gate badge" with optional ref text.
              // Support user-controlled scaling without relying on global CSS changes.
              const baseW = label ? Math.min(86, Math.max(18, 12 + label.length * 7)) : 14;
              const baseH = 18;
              const w = Math.round(baseW * scale);
              const h = Math.round(baseH * scale);
              const padX = Math.max(0, Math.round(6 * scale));
              const fontSize = Math.max(8, Math.round(11 * scale));
              const radius = Math.max(2, Math.round(7 * scale));
              const emptyW = Math.max(8, Math.round(12 * scale));
              const emptyRadius = Math.max(2, Math.round(4 * scale));

              const style = label
                ? `height:${h}px;padding:0 ${padX}px;font-size:${fontSize}px;border-radius:${radius}px;`
                : `height:${h}px;width:${emptyW}px;padding:0;border-radius:${emptyRadius}px;`;

              const html = `<div class="ids-ramp-gate ${occupied ? 'occ' : 'open'} ${manual ? 'manual' : ''} ${held ? 'held' : ''}" style="${style}">${label ? escapeHtml(label) : ''}</div>`;
              const icon = L.divIcon({
                className: '',
                html,
                iconSize: [w, h],
                iconAnchor: [w / 2, h / 2],
                popupAnchor: [0, -10],
              });

              const title = baseLabel ? `Stand ${baseLabel}` : 'Stand';
              const sub = occupied ? `${manual ? 'Manual: ' : ''}${callsign}${type ? ` (${type})` : ''}` : held ? (holdNote ? `Held: ${holdNote}` : 'Held') : 'Open';

              const popupHtml = (() => {
                if (!isPilot) {
                  const hint = occupied
                    ? manual
                      ? '<div style="margin-top:6px; font-size:12px; opacity:0.8;">Click to reassign/clear</div>'
                      : '<div style="margin-top:6px; font-size:12px; opacity:0.8;">Click to override claim</div>'
                    : '<div style="margin-top:6px; font-size:12px; opacity:0.8;">Click to claim</div>';
                  return `<div style="font-size: 13px;"><div style="font-weight: 700;">${escapeHtml(title)}</div><div style="margin-top: 4px;">${escapeHtml(sub)}</div>${hint}</div>`;
                }

                const ctx = pilotCtxRef.current || { cs: '', canReserve: true, canAssign: true, holdPrefix: '' };
                const csNow = String(ctx.cs || '').trim().toUpperCase();
                const canReserveNow = !!ctx.canReserve;
                const holdPrefixNow = String(ctx.holdPrefix || '').trim().toUpperCase();

                const locked = !csNow || !canReserveNow;
                const inferredRole = (() => {
                  const p = holdPrefixNow;
                  if (p.endsWith(' ARR')) return 'ARR';
                  if (p.endsWith(' DEP')) return 'DEP';
                  return '';
                })();

                const lockedMsg = !csNow
                  ? 'Ramp actions are locked until we can match your CID to a pilot or prefile on the VATSIM feed.'
                  : 'You must be connected on the network to reserve a gate.';
                const prefix = (holdPrefixNow || csNow).trim().toUpperCase();
                const heldBySelf = !!(held && prefix && holdNote.toUpperCase().startsWith(prefix));
                const canReserveHere = !locked && canReserveNow && !occupied && !held;

                const reserveUntil = formatLocalTime(Date.now() + 30 * 60_000);
                const heldUntil = holdExpiresAt ? formatLocalTime(holdExpiresAt) : '';

                const actions = `
                  <div class="ramp-popup-actions">
                    ${canReserveHere ? `<button data-action="pilot-reserve" class="ramp-popup-btn ramp-popup-btn-reserve">Reserve 30 min</button>` : ''}
                  </div>
                `;

                const footer = locked
                  ? `<div style="margin-top:8px; font-size:12px; opacity:0.85;">${escapeHtml(lockedMsg)}</div>`
                  : held
                    ? heldUntil
                      ? `<div style="margin-top:8px; font-size:12px; opacity:0.85;">Hold expires at ${escapeHtml(heldUntil)} (local).</div>`
                      : '<div style="margin-top:8px; font-size:12px; opacity:0.85;">This gate is currently held.</div>'
                    : canReserveHere
                      ? `<div style="margin-top:8px; font-size:12px; opacity:0.85;">Reserve will expire at ${escapeHtml(reserveUntil)} (local).</div>`
                      : '';

                return `<div style="font-size: 13px; min-width: 170px;">
                  <div style="font-weight: 800;">${escapeHtml(title)}</div>
                  <div style="margin-top: 4px;">${escapeHtml(sub)}</div>
                  ${actions}
                  ${footer}
                </div>`;
              })();

              let marker = markerMap.get(id);

              if (!marker) {
                marker = L.marker([lat, lon], { pane: 'rampPane', icon, interactive: true });
                (marker as any).__stand = {
                  icao: String(icao).trim().toUpperCase(),
                  standId: id,
                  label: baseLabel || 'stand',
                  occupied,
                  manual,
                  held,
                  holdNote: holdNote || undefined,
                  holdExpiresAt: holdExpiresAt,
                  currentCallsign: callsign || undefined,
                };

                marker.bindPopup(popupHtml);

                // Pilot-mode popup actions (Reserve/Assign) live inside the Leaflet popup.
                marker.on('popupopen', (e: any) => {
                  if (!isPilot) return;
                  try {
                    const root = e?.popup?.getElement?.() as HTMLElement | null;
                    if (!root) return;

                    // IMPORTANT: Leaflet popups are not React. Direct `onclick` handlers are fragile on mobile.
                    // Use event delegation on the popup root so taps always register.
                    const st = (marker as any).__stand ?? {};
                    const stIcao = String(st.icao ?? icao).trim().toUpperCase();
                    const stId = String(st.standId ?? id).trim();
                    const stLabel = String(st.label ?? label ?? 'stand');

                    const doReserve = async (btn: HTMLButtonElement | null) => {
                      // Immediate visual feedback.
                      if (btn) {
                        btn.disabled = true;
                        btn.textContent = 'Reserving…';
                      }

                      const csNow = (pilotCtxRef.current?.cs || '').trim().toUpperCase();
                      const canReserveNow = !!pilotCtxRef.current?.canReserve;
                      if (!csNow) {
                        toast.error('Ramp actions are locked until we can match your CID to a pilot or prefile on the VATSIM feed.');
                        if (btn) {
                          btn.disabled = false;
                          btn.textContent = 'Reserve 30 min';
                        }
                        return;
                      }
                      if (!canReserveNow) {
                        toast.error('Reserving a gate is not enabled for your current flight plan / status.');
                        if (btn) {
                          btn.disabled = false;
                          btn.textContent = 'Reserve 30 min';
                        }
                        return;
                      }

                      try {
                        const resp = await fetch('/api/ids/ramp/hold', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ icao: stIcao, standId: stId, hold: true, mode: 'pilot', note: '' }),
                        });
                        const j = await resp.json().catch(() => ({} as any));
                        if (!resp.ok || !j?.ok) throw new Error(j?.error || 'Failed to reserve');

                        const until = j?.expiresAt ? formatLocalTime(Number(j.expiresAt)) : '';
                        toast.success(until ? `Reserved ${stLabel} until ${until}` : `Reserved ${stLabel}`);

                        // Notify any non-map UI (Pilot sidebar, IDS panels) that holds changed.
                        try {
                          if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('rampHoldChanged', { detail: { icao: stIcao } }));
                          }
                        } catch {}

                        if (j?.dbEnabled === true && j?.persisted === false) {
                          toast.warning('Reserved, but the DB hold did not persist. This is usually a schema mismatch (expires_at_ms must be BIGINT). Run sql/alter_table_ids_ramp_holds_bigint.sql and restart.');
                        }

                        if (btn) {
                          btn.disabled = true;
                          btn.textContent = 'Reserved';
                        }

                        // Force an immediate occupancy refresh so the badge color updates right away.
                        rampLastOccRef.current = 0;
                        if (mapRef.current) {
                          await loadRamp(mapRef.current, stIcao, false);
                          try { marker.openPopup(); } catch {}
                        }
                      } catch (err: any) {
                        toast.error(err?.message || 'Failed to reserve');
                        if (btn) {
                          btn.disabled = false;
                          btn.textContent = 'Reserve 30 min';
                        }
                      }
                    };

                    // Remove any previously wired handler for this popup element.
                    const anyRoot = root as any;
                    if (anyRoot.__pilotRampHandler) {
                      try {
                        root.removeEventListener('click', anyRoot.__pilotRampHandler);
                        root.removeEventListener('pointerup', anyRoot.__pilotRampHandler);
                      } catch {}
                    }

                    const handler = (ev: Event) => {
                      const target = ev.target as HTMLElement | null;
                      const btn = target?.closest?.('button[data-action="pilot-reserve"]') as HTMLButtonElement | null;
                      if (!btn) return;
                      // Prevent double-fire (pointerup + click) or re-entry while busy.
                      if (btn.disabled) return;
                      ev.preventDefault();
                      ev.stopPropagation();
                      // Stop Leaflet from treating this as a map click.
                      (L as any).DomEvent?.stop?.(ev);
                      void doReserve(btn);
                    };

                    anyRoot.__pilotRampHandler = handler;
                    root.addEventListener('click', handler);
                    root.addEventListener('pointerup', handler);
                  } catch (err) {
                    console.error('pilot popup wire error', err);
                  }
                });

                marker.on('click', () => {
                  try {
                    marker.openPopup();
                    // Pilot mode uses popup buttons (Reserve/Assign). Do not open the controller dialog.
                    if (isPilot) return;
                    const st = (marker as any).__stand ?? {};
                    setClaimStand({
                      icao: String(st.icao ?? icao).trim().toUpperCase(),
                      standId: String(st.standId ?? id),
                      label: String(st.label ?? label ?? 'stand'),
                      occupied: !!st.occupied,
                      manual: !!st.manual,
                      held: !!st.held,
                      holdNote: st.holdNote || undefined,
                      currentCallsign: st.currentCallsign || undefined,
                    });
                    const csPrefill = st.manual ? String(st.currentCallsign || '').toUpperCase() : '';
                    setCallInput(csPrefill);
                    const notePrefill = String(st.holdNote ?? '').trim();
                    setHoldNote(notePrefill);
                    setPilotNote('');
                    setSearch('');
                    setClaimOpen(true);
                  } catch (err) {
                    console.error('Open claim dialog error:', err);
                  }
                });

                marker.addTo(group);
                markerMap.set(id, marker);
              } else {
                // Update existing marker in place (no clearLayers), so gates never "blink" off.
                try {
                  marker.setLatLng([lat, lon]);
                } catch {
                  // ignore
                }
                marker.setIcon(icon);
                (marker as any).__stand = {
                  icao: String(icao).trim().toUpperCase(),
                  standId: id,
                  label: baseLabel || 'stand',
                  occupied,
                  manual,
                  held,
                  holdNote: holdNote || undefined,
                  holdExpiresAt: holdExpiresAt,
                  currentCallsign: callsign || undefined,
                };
                marker.bindPopup(popupHtml);
              }
            }

            // Remove markers that no longer exist in the newest stand set.
            for (const [id, mk] of markerMap.entries()) {
              if (!nextIds.has(id)) {
                try {
                  group.removeLayer(mk);
                } catch {
                  // ignore
                }
                markerMap.delete(id);
              }
            }
            rampLastOccRef.current = now;
          } else {
            // If we already have stand markers, keep them and consider this update "good enough".
            // If we don't, don't advance the timer so we retry soon instead of showing an empty ramp for 12s.
            if ((rampStandMarkersRef.current?.size ?? 0) > 0) {
              rampLastOccRef.current = now;
            }
          }
        }
      } catch (e) {
        console.error('Error loading ramp occupancy:', e);
      }
    }

    // 2) Ground traffic (more frequent): draw little airplanes that move with the pilots.
    try {
      const res = await fetch(`/api/ids/ramp/ground?icao=${encodeURIComponent(icao)}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      const traffic = Array.isArray(json?.traffic) ? json.traffic : [];

      const groupT = rampTrafficLayerRef.current;
      groupT.clearLayers();

      // Simple aircraft icon (SVG), rotated by heading if available. Scale with the ramp icon setting.
      const svg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="display:block;">
  <path d="M2.5 19.5l1.5 1.5 7-3v5l2 1 2-1v-5l7 3 1.5-1.5-8.5-5V9.5c0-2-1.5-3.5-3.5-3.5S8.5 7.5 8.5 9.5v5L2.5 19.5z"/>
</svg>`;

      for (const a of traffic) {
        const lat = Number(a?.latitude ?? a?.lat);
        const lon = Number(a?.longitude ?? a?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        const callsign = String(a?.callsign ?? '').trim().toUpperCase();
        if (!callsign) continue;

        const gs = Number(a?.groundspeed ?? 0);
        const parked = !!a?.parked;
        const headingRaw = Number(a?.heading ?? a?.true_track ?? a?.track ?? 0);
        const heading = Number.isFinite(headingRaw) ? headingRaw : 0;
        const aircraftType = String(a?.aircraftType ?? '').trim();

        const cls = parked ? 'parked' : gs > 2 ? 'moving' : 'parked';
        const planeHtml = `<div class="ids-ramp-plane ${cls}" style="transform: rotate(${heading}deg) scale(${scale})">${svg}</div>`;

        const px = Math.round(18 * scale);

        const icon = L.divIcon({
          className: '',
          html: planeHtml,
          iconSize: [px, px],
          iconAnchor: [px / 2, px / 2],
        });

        const m = L.marker([lat, lon], { pane: 'rampPane', icon, interactive: true });

        m.bindTooltip(escapeHtml(callsign), { direction: 'top', opacity: 0.9, offset: [0, -8] });

        const subtitle = `${aircraftType ? escapeHtml(aircraftType) + ' · ' : ''}${Number.isFinite(gs) ? `${gs.toFixed(0)}kt` : ''}${parked ? ' · parked' : ''}`;
        m.bindPopup(
          `<div style="font-size: 13px;"><div style="font-weight: 700;">${escapeHtml(callsign)}</div><div style="margin-top: 4px;">${subtitle}</div></div>`
        );

        m.addTo(groupT);
      }
    } catch (e) {
      console.error('Error loading ramp ground traffic:', e);
    }
  };

  useEffect(() => {
    if (!selectedAircraft) return;
    const match = aircraftSnapshots.find((a) => String(a?.callsign ?? '').toUpperCase() === String(selectedAircraft.callsign ?? '').toUpperCase());
    if (!match) return;
    const same =
      match.latitude === selectedAircraft.latitude &&
      match.longitude === selectedAircraft.longitude &&
      match.altitude === selectedAircraft.altitude &&
      match.groundspeed === selectedAircraft.groundspeed &&
      match.route === selectedAircraft.route;
    if (!same) setSelectedAircraft(match);
  }, [aircraftSnapshots, selectedAircraft]);

  // Pilot mode: the callsign / permissions often arrive after the map is already mounted.
  // Force a ramp refresh when these props change so gate popups immediately show Reserve/Assign.
  useEffect(() => {
    if (!isPilot) return;
    const map = mapRef.current;
    const L = leafletRef.current;
    const airport = String(rampAirport ?? '').trim().toUpperCase();
    if (!map || !L || destroyed.current || !airport) return;
    // Only refresh if ramp mode is active for this airport.
    const active = (activeRampRef.current ?? '').trim().toUpperCase();
    if (active && active !== airport) return;

    // Reset the occupancy timer so the next loadRamp call recomputes popup HTML immediately.
    rampLastOccRef.current = 0;
    // Do not force-set the view; just refresh stand state & popup content.
    loadRamp(map, airport, false);
  }, [isPilot, rampAirport, defaultCs, pilotCanReserve, pilotCanAssign, pilotHoldPrefix]);

  useEffect(() => {
    destroyed.current = false;

    const el = containerRef.current;
    if (!el) return;

    // Leaflet can leave an internal id on the container between mounts; clear it defensively.
    if ((el as any)._leaflet_id) {
      try {
        delete (el as any)._leaflet_id;
      } catch {
        (el as any)._leaflet_id = undefined;
      }
    }

    let intervalId: number | undefined;
    let watchdogId: number | undefined;

    const initMap = async () => {
      if (destroyed.current) return;
      if (mapRef.current) return;
      if (initInFlightRef.current) return;

      const elNow = containerRef.current;
      if (!elNow) return;

      initInFlightRef.current = true;
      initAttemptsRef.current += 1;

      try {
        const LModule = await import('leaflet');
        const L = (LModule as any)?.default ?? (LModule as any);
        leafletRef.current = L;

        // Leaflet can render a blank/incorrect overlay if the map is created while the container
        // is hidden or has zero size during Next.js route transitions. Wait for a real layout.
        const waitForSize = async () => {
          for (let i = 0; i < 180; i++) {
            if (destroyed.current) return false;
            const r = elNow.getBoundingClientRect();
            if (r.width > 40 && r.height > 40) return true;
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          }
          return false;
        };

        const ok = await waitForSize();
        if (!ok || destroyed.current) return;

        // Container might have stale Leaflet state if we retried initialization.
        if ((elNow as any)._leaflet_id) {
          try {
            delete (elNow as any)._leaflet_id;
          } catch {
            (elNow as any)._leaflet_id = undefined;
          }
        }
        // Also clear any leftover DOM children from a previous failed init.
        try {
          elNow.innerHTML = '';
        } catch {
          // ignore
        }

        const map = L.map(elNow, {
          zoomControl: true,
        });
        map.setView([41.5346, -80.6708], 6);

        mapRef.current = map;

        map.createPane('artccPane').style.zIndex = '400';
        map.createPane('aircraftPane').style.zIndex = '650';
        map.createPane('routePane').style.zIndex = '1000';
        // Ensure popups/dialogs render above our custom panes (especially rampPane).
        map.getPane('popupPane')!.style.zIndex = '2100';
        map.getPane('tooltipPane')!.style.zIndex = '2200';

        const tileLayer = L.tileLayer(TILE_DARK, {
          attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19,
        });

        tileLayer.addTo(map);
        tileLayerRef.current = tileLayer;

        map.whenReady(() => {
          if (destroyed.current) return;
          setMapReady(true);
          // Toggle stand labels based on zoom.
          try {
            rampStandLabelShowRef.current = Number(map.getZoom?.() ?? 0) >= STAND_LABEL_MIN_ZOOM;
            map.on('zoomend', () => updateRampStandIconsForZoom(map));
          } catch {
            // ignore
          }
          loadSectors(map);
          if (intervalId) window.clearInterval(intervalId);
          intervalId = window.setInterval(() => loadSectors(map), 60 * 1000);

          // Force a size recalculation shortly after first paint (helps after navigation).
          window.setTimeout(() => {
            if (destroyed.current) return;
            try {
              map.invalidateSize();
            } catch {
              // ignore
            }
          }, 150);
        });
      } catch (e) {
        console.error('Leaflet init failed:', e);
        reportSoftMapIssue('Leaflet init failed', e, 'The map did not finish loading. Try the page again or switch tabs once.');
      } finally {
        initInFlightRef.current = false;
      }
    };

    // Initial attempt.
    initMap();

    // Watchdog: if navigation/tab transitions cause Leaflet to fail to mount, retry once the
    // container has a real size. This avoids "blank map" after switching IDS <-> Pilot.
    watchdogId = window.setInterval(() => {
      if (destroyed.current) return;
      if (mapRef.current) return;
      const elNow = containerRef.current;
      if (!elNow) return;
      const r = elNow.getBoundingClientRect();
      if (r.width > 40 && r.height > 40) {
        // Avoid infinite retries.
        if (initAttemptsRef.current < 5) initMap();
        else window.clearInterval(watchdogId);
      }
    }, 350);

    return () => {
      destroyed.current = true;
      if (intervalId) clearInterval(intervalId);
      if (watchdogId) clearInterval(watchdogId);
      if (rampIntervalRef.current) {
        clearInterval(rampIntervalRef.current);
        rampIntervalRef.current = null;
      }
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {
          // ignore
        }
        mapRef.current = null;
      }
    };
  }, []);

  // Handle ramp mode activation/deactivation.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || destroyed.current) return;

    const nextRamp = rampAirport ? String(rampAirport).trim().toUpperCase() : null;

    // Deactivate ramp mode
    if (!nextRamp) {
      if (rampIntervalRef.current) {
        clearInterval(rampIntervalRef.current);
        rampIntervalRef.current = null;
      }
      // IMPORTANT: When users switch away from the Ramp tab, Radix Tabs often unmounts the left panel.
      // If we fully destroy our stand markers here, a single transient empty API response on re-entry can
      // make the ramp feel "blank". Instead, keep the last good stand markers in memory and simply
      // detach the layer group from the map.
      if (rampStandsLayerRef.current) {
        try {
          map.removeLayer(rampStandsLayerRef.current);
        } catch {
          // ignore
        }
      }

      // Traffic moves frequently; clear it when leaving ramp mode so we don't show stale positions.
      if (rampTrafficLayerRef.current) {
        try {
          rampTrafficLayerRef.current.clearLayers();
        } catch {
          // ignore
        }
        try {
          map.removeLayer(rampTrafficLayerRef.current);
        } catch {
          // ignore
        }
      }
      activeRampRef.current = null;
      didSetRampViewRef.current = false;

      if (prevViewRef.current) {
        safeSetView(map, prevViewRef.current.lat, prevViewRef.current.lon, prevViewRef.current.zoom);
        prevViewRef.current = null;
      }
      return;
    }

    // Activate / switch ramp airport
    if (activeRampRef.current !== nextRamp) {
      activeRampRef.current = nextRamp;
      didSetRampViewRef.current = false;

      if (!prevViewRef.current) {
        const c = map.getCenter();
        prevViewRef.current = { lat: c.lat, lon: c.lng, zoom: map.getZoom() };
      }

      if (rampStandsLayerRef.current) {
        try {
          map.removeLayer(rampStandsLayerRef.current);
        } catch {
          // ignore
        }
        rampStandsLayerRef.current = null;
      }
if (rampStandGroupLabelsLayerRef.current) {
  try {
    map.removeLayer(rampStandGroupLabelsLayerRef.current);
  } catch {
    // ignore
  }
  rampStandGroupLabelsLayerRef.current = null;
}
      if (rampTrafficLayerRef.current) {
        try {
          map.removeLayer(rampTrafficLayerRef.current);
        } catch {
          // ignore
        }
        rampTrafficLayerRef.current = null;
      }
      // Reset cached stand markers when switching ramp airports.
      rampStandMarkersRef.current = new Map();
      rampStandGroupDataRef.current = new Map();
      didShowRampStandGroupLabelsRef.current = false;
    }

    // Initial load + refresh
    // If the occupancy endpoint is slow or fails, at least zoom the user to a sensible airport center
    // so the ramp view never appears "blank".
    if (!didSetRampViewRef.current) {
      const fb = RAMP_FALLBACK_CENTERS[nextRamp];
      if (fb) {
        try {
          if (safeSetView(map, fb.lat, fb.lon, fb.zoom)) {
            didSetRampViewRef.current = true;
          }
          lastRampCenterRef.current[nextRamp] = { lat: fb.lat, lon: fb.lon, zoom: fb.zoom };
        } catch {
          // ignore
        }
      }
    }
    loadRamp(map, nextRamp, true);
    // Leaflet does not always render correctly when its container size changes (e.g. tab switches / panel mount).
    // Force a size recalculation immediately and again after layout settles.
    try {
      map.invalidateSize();
      window.setTimeout(() => {
        try {
          map.invalidateSize();
        } catch {
          // ignore
        }
      }, 200);
    } catch {
      // ignore
    }
    if (rampIntervalRef.current) clearInterval(rampIntervalRef.current);
    rampIntervalRef.current = window.setInterval(() => loadRamp(map, nextRamp, false), 5_000);

    return () => {
      // If we switch airports, interval gets replaced. If we unmount, the top-level cleanup handles it.
      if (rampIntervalRef.current) {
        clearInterval(rampIntervalRef.current);
        rampIntervalRef.current = null;
      }
    };
  }, [rampAirport, mapReady, rampIconScale]);


// Leaflet can render incorrectly when its container is hidden/shown or resized (common with tab/page switches).
// Keep it in sync automatically and refresh ramp overlays if we're in ramp mode.
useEffect(() => {
  if (!mapReady || destroyed.current) return;
  const map = mapRef.current;
  const el = containerRef.current;
  if (!map || !el) return;

  let raf = 0;
  const ro = new ResizeObserver(() => {
    if (destroyed.current) return;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      try {
        map.invalidateSize();
      } catch {
        // ignore
      }
    });
  });

  try {
    ro.observe(el);
  } catch {
    // ignore
  }

  return () => {
    try {
      ro.disconnect();
    } catch {
      // ignore
    }
    if (raf) cancelAnimationFrame(raf);
  };
}, [mapReady]);

// When navigating between pages/tabs, Next.js can keep client components alive and simply hide/show them.
// Force a size recalculation and a ramp refresh on route change so the gate layer always reappears instantly.
useEffect(() => {
  if (!mapReady || destroyed.current) return;
  const map = mapRef.current;
  if (!map) return;

  const t = window.setTimeout(() => {
    if (destroyed.current) return;
    try {
      map.invalidateSize();
    } catch {
      // ignore
    }
    const active = (activeRampRef.current ?? '').trim().toUpperCase();
    if (active) {
      // If we somehow lost markers, retry immediately.
      if ((rampStandMarkersRef.current?.size ?? 0) === 0) rampLastOccRef.current = 0;
      loadRamp(map, active, false);
    }
  }, 50);

  return () => window.clearTimeout(t);
}, [pathname, mapReady]);

// Also refresh when the browser tab regains focus / becomes visible.
useEffect(() => {
  if (!mapReady || destroyed.current) return;
  const map = mapRef.current;
  if (!map) return;

  const refresh = () => {
    if (destroyed.current) return;
    try {
      map.invalidateSize();
    } catch {
      // ignore
    }
    const active = (activeRampRef.current ?? '').trim().toUpperCase();
    if (active) {
      rampLastOccRef.current = 0;
      loadRamp(map, active, false);
    }
  };

  const onVis = () => {
    if (document.visibilityState === 'visible') refresh();
  };

  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('focus', refresh);

  return () => {
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('focus', refresh);
  };
}, [mapReady]);

  const submitClaim = async () => {
    if (!claimStand) return;
    if (claimBusy) return;
    if (isPilot && !pilotCanAssign) {
      toast.error('Assigning a gate is not available for your current pilot status/flight plan.');
      return;
    }
    const icao = claimStand.icao;
    const standId = claimStand.standId;
    const cs = (isPilot ? defaultCs : callInput).trim().toUpperCase();
    if (!cs) {
      toast.error(isPilot ? 'Ramp actions are locked until we can match your CID to a pilot or prefile on the VATSIM feed.' : 'Pick a callsign to assign.');
      return;
    }

    try {
      setClaimBusy(true);
      const resp = await fetch('/api/ids/ramp/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isPilot ? { icao, standId, mode: 'pilot' } : { icao, standId, callsign: cs }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        toast.error(j?.error || 'Failed to claim stand');
        return;
      }
      toast.success(`Assigned ${cs} to ${claimStand.label}`);
      setClaimOpen(false);
      setClaimStand(null);
      if (!isPilot) setCallInput('');

      if (mapRef.current) {
        await loadRamp(mapRef.current, icao, false);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to claim stand');
    } finally {
      setClaimBusy(false);
    }
  };

  const clearClaim = async () => {
    if (!claimStand) return;
    if (claimBusy) return;
    try {
      setClaimBusy(true);
      const resp = await fetch('/api/ids/ramp/claim', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icao: claimStand.icao, standId: claimStand.standId }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        toast.error(j?.error || 'Failed to clear claim');
        return;
      }
      toast.success(`Cleared claim on ${claimStand.label}`);
      setClaimOpen(false);
      setClaimStand(null);
      setCallInput('');

      if (mapRef.current) {
        await loadRamp(mapRef.current, claimStand.icao, false);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to clear claim');
    } finally {
      setClaimBusy(false);
    }
  };


  const toggleHold = async (nextHold: boolean) => {
    if (!claimStand) return;
    if (holdBusy) return;
    if (isPilot && nextHold && !pilotCanReserve) {
      toast.error('Reserving a gate requires an eligible flight plan for this airport.');
      return;
    }
    try {
      setHoldBusy(true);
      const pilotExtra = pilotNote.trim();
      const prefix = (pilotHoldPrefix || defaultCs).trim();
      const nextHoldNote = nextHold
        ? isPilot
          ? pilotExtra
            ? `${prefix} - ${pilotExtra}`
            : prefix
          : holdNote
        : '';
      const resp = await fetch('/api/ids/ramp/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          icao: claimStand.icao,
          standId: claimStand.standId,
          hold: nextHold,
          ...(isPilot
            ? { mode: 'pilot', note: nextHold ? pilotExtra : '' }
            : { note: nextHold ? holdNote : '' }),
        }),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j?.ok) {
        throw new Error(j?.error || 'Failed to update hold');
      }

      toast.success(nextHold ? `Held ${claimStand.label}` : `Released hold on ${claimStand.label}`);
      setClaimStand({ ...claimStand, held: nextHold, holdNote: nextHoldNote });

      // Force an immediate occupancy refresh so the badge color updates right away.
      rampLastOccRef.current = 0;
      if (mapRef.current) {
        await loadRamp(mapRef.current, claimStand.icao, false);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update hold');
    } finally {
      setHoldBusy(false);
    }
  };

  const pilotReserve = async (nextHold: boolean) => {
    await toggleHold(nextHold);
    // Close the dialog after the action to keep the flow snappy for pilots.
    if (isPilot) setClaimOpen(false);
  };

  const rampActive = !!rampAirport;

  return (
    <div className="relative z-0">
      {softMapError ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] px-4 py-3 text-sm text-amber-100/90">
          <span>{softMapError}</span>
          <button
            type="button"
            onClick={() => setSoftMapError(null)}
            className="rounded-full border border-amber-200/20 px-3 py-1 text-xs font-semibold text-amber-100 transition hover:bg-amber-100/10"
          >
            Dismiss
          </button>
        </div>
      ) : null}
      {!rampActive ? (
        <div className="pointer-events-none absolute left-3 right-3 top-3 z-[1200] sm:right-auto sm:w-full sm:max-w-sm">
          <div className="pointer-events-auto rounded-2xl border border-white/10 bg-slate-950/85 p-3 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-2">
              <Input
                value={aircraftSearch}
                onChange={(e) => setAircraftSearch(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    focusAircraftByCallsign();
                  }
                }}
                list="ids-aircraft-callsigns"
                placeholder="Find callsign on map"
                className="h-9 border-white/10 bg-white/5 text-sm text-white placeholder:text-white/40"
              />
              <Button type="button" size="sm" onClick={() => focusAircraftByCallsign()} className="shrink-0">
                Locate
              </Button>
            </div>
            <datalist id="ids-aircraft-callsigns">
              {aircraftSuggestions.map((callsign) => (
                <option key={callsign} value={callsign} />
              ))}
            </datalist>
            {aircraftSearchMessage ? <div className="mt-2 text-xs text-amber-200/90">{aircraftSearchMessage}</div> : null}
            {selectedAircraft ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/80">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{selectedAircraft.callsign}</div>
                    <div className="text-[11px] text-white/55">Live aircraft details</div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 border-white/10 bg-transparent px-2 text-[11px] text-white hover:bg-white/10"
                      onClick={() => focusAircraftByCallsign(selectedAircraft.callsign)}
                    >
                      Recenter
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!selectedAircraft.route}
                      className="h-7 border-white/10 bg-transparent px-2 text-[11px] text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:text-white/35"
                      onClick={() => displaySelectedAircraftRoute(selectedAircraft)}
                    >
                      Display route
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                  <div><span className="text-white/45">Type:</span> {selectedAircraft.aircraftType || '—'}</div>
                  <div><span className="text-white/45">Altitude:</span> {Number.isFinite(selectedAircraft.altitude) ? `${selectedAircraft.altitude.toLocaleString()} ft` : '—'}</div>
                  <div><span className="text-white/45">Dep:</span> {selectedAircraft.departure || '—'}</div>
                  <div><span className="text-white/45">Arr:</span> {selectedAircraft.arrival || '—'}</div>
                  <div><span className="text-white/45">Wake:</span> {formatWakeDisplay(selectedAircraft)}</div>
                  <div><span className="text-white/45">Groundspeed:</span> {Number.isFinite(selectedAircraft.groundspeed) ? `${selectedAircraft.groundspeed} kt` : '—'}</div>
                  <div><span className="text-white/45">Wingspan:</span> {selectedAircraft.wingspanFt ? `${selectedAircraft.wingspanFt} ft` : 'Unavailable'}</div>
                  <div><span className="text-white/45">Squawk:</span> {selectedAircraft.transponder ? String(selectedAircraft.transponder).padStart(4, '0') : '—'}</div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-white/45">Route</div>
                  <div className="max-h-24 overflow-y-auto rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-[11px] leading-relaxed text-white/80">
                    {selectedAircraft.route || 'No route filed.'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-white/55">Search any tracked callsign to ping it on the map, review details, and plot its filed route.</div>
            )}
          </div>
        </div>
      ) : null}

      <div ref={containerRef} className="h-[700px] w-full rounded-lg" />

      {mapReady && mapRef.current && (
        <>
          {!rampActive && (
            <LoadAircraft
              map={mapRef.current}
              highlightedCallsign={highlightedAircraftCallsign}
              onAircraftSnapshot={setAircraftSnapshots}
              onSelectAircraft={(aircraft) => {
                setSelectedAircraft(aircraft);
                setAircraftSearch(aircraft.callsign);
                setAircraftSearchMessage(null);
              }}
            />
          )}
          {!rampActive && (
            <div className="mt-6">
              <RoutePlanner map={mapRef.current} />
            </div>
          )}
        </>
      )}

      <Dialog
        open={claimOpen}
        onOpenChange={(o: boolean) => {
          setClaimOpen(o);
          if (!o) {
            setClaimStand(null);
            setCallInput('');
            setSearch('');
            setHoldNote('');
            setPilotNote('');
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
          <DialogTitle>
            {claimStand ? (isPilot ? `Select ${claimStand.label}` : `Claim ${claimStand.label}`) : isPilot ? 'Select gate' : 'Claim stand'}
          </DialogTitle>
            <DialogDescription>
            {isPilot
              ? 'Click a gate badge to reserve it with your callsign. Your reservation shows up as a HELD gate for controllers.'
              : claimStand
                ? claimStand.manual
                  ? `Currently manually assigned to ${claimStand.currentCallsign ?? '—'}. Pick a new callsign to reassign, or clear the claim.`
                  : claimStand.occupied
                    ? 'This stand looks occupied. Selecting a callsign will override-claim it.'
                    : 'Select an on-ground callsign to assign to this stand.'
                : 'Select an on-ground callsign to assign to this stand.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">

            {claimStand && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white/90">{isPilot ? 'Reserve this gate' : 'Hold / reserve'}</div>
                    <div className="text-xs text-white/60">
                      {isPilot
                        ? `Your callsign is auto-detected as ${(pilotHoldPrefix || defaultCs) || '—'}. Reserving creates a HELD gate note for controllers.`
                        : 'Reserve a gate for an inbound. Claiming a callsign will clear any hold.'}
                    </div>
                  </div>
                  <div className="text-xs font-semibold">
                    {claimStand.held ? (
                      <span className="rounded-full px-2 py-1 bg-amber-500/15 text-amber-200 border border-amber-500/40">
                        HELD
                      </span>
                    ) : (
                      <span className="rounded-full px-2 py-1 bg-emerald-500/10 text-emerald-200 border border-emerald-500/35">
                        OPEN
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <Input
                    value={isPilot ? pilotNote : holdNote}
                    onChange={(e) => (isPilot ? setPilotNote(e.target.value) : setHoldNote(e.target.value))}
                    placeholder={isPilot ? 'Optional note (e.g., inbound from KATL)…' : 'Optional note (e.g., DAL123 inbound)…'}
                    disabled={holdBusy || (isPilot && (!defaultCs || !pilotCanReserve))}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="whitespace-nowrap"
                    disabled={
                      holdBusy ||
                      (isPilot && !defaultCs) ||
                      (isPilot && !claimStand.held && !pilotCanReserve)
                    }
                    onClick={() => (isPilot ? pilotReserve(!claimStand.held) : toggleHold(!claimStand.held))}
                  >
                    {claimStand.held ? (isPilot ? 'Release' : 'Release') : isPilot ? 'Reserve' : 'Hold'}
                  </Button>
                </div>
              </div>
            )}
            {!isPilot ? (
              <>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={`Search on-ground callsigns @ ${claimIcao}`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <Button
                    variant="secondary"
                    disabled={groundLoading}
                    onClick={() => {
                      setGroundLoading(true);
                      fetch(`/api/ids/ramp/ground?icao=${encodeURIComponent(claimIcao)}`, { cache: 'no-store' })
                        .then((r) => r.json())
                        .then((j) => setGroundTraffic(Array.isArray(j?.traffic) ? j.traffic : []))
                        .catch((error) => {
                          reportSoftMapIssue('Manual on-ground callsign refresh failed', error, 'The gate picker could not refresh the current on-ground callsigns.');
                          setGroundTraffic([]);
                        })
                        .finally(() => setGroundLoading(false));
                    }}
                  >
                    Refresh
                  </Button>
                </div>

                <div className="rounded-md border border-white/10">
                  <div className="max-h-64 overflow-auto">
                    {groundLoading ? (
                      <div className="p-3 text-sm text-white/70">Loading on-ground callsigns…</div>
                    ) : filteredTraffic.length ? (
                      <div className="divide-y divide-white/5">
                        {filteredTraffic.map((t: any) => {
                          const cs = String(t?.callsign ?? '').toUpperCase();
                          const type = String(t?.aircraftType ?? '').trim();
                          const gs = t?.groundspeed != null ? Number(t.groundspeed) : null;
                          const parked = !!t?.parked;
                          const dep = t?.departure ? String(t.departure) : '';
                          const arr = t?.arrival ? String(t.arrival) : '';
                          const selected = cs && cs === callInput.trim().toUpperCase();
                          return (
                            <button
                              key={cs}
                              type="button"
                              onClick={() => setCallInput(cs)}
                              className={`w-full px-3 py-2 text-left text-sm hover:bg-white/5 ${selected ? 'bg-white/10' : ''}`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="font-semibold text-white">{cs}</div>
                                <div className="text-xs text-white/60">
                                  {parked ? 'parked' : 'ground'}
                                  {gs != null ? ` • ${gs.toFixed(0)}kt` : ''}
                                  {type ? ` • ${type}` : ''}
                                </div>
                              </div>
                              {(dep || arr) && <div className="mt-0.5 text-xs text-white/50">{dep || '----'} → {arr || '----'}</div>}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-3 text-sm text-white/70">No on-ground callsigns found at {claimIcao}.</div>
                    )}
                  </div>
                </div>
              </>
            ) : null}

            {isPilot ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
                Your callsign: <span className="font-semibold text-white">{(pilotHoldPrefix || defaultCs) || '—'}</span>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-xs text-white/60">Selected callsign (you can also type):</div>
                <Input value={callInput} onChange={(e) => setCallInput(e.target.value)} placeholder="E.g. DAL123" />
              </div>
            )}
          </div>

          <DialogFooter>
            {claimStand?.manual && !isPilot && (
              <Button variant="destructive" onClick={clearClaim} disabled={claimBusy}>
                Clear claim
              </Button>
            )}
            <Button variant="secondary" onClick={() => setClaimOpen(false)} disabled={claimBusy || holdBusy}>
              Cancel
            </Button>
            <Button onClick={submitClaim} disabled={claimBusy || (isPilot && (!defaultCs || !pilotCanAssign))}>
              {isPilot ? 'Assign (if on ground)' : claimStand?.manual ? 'Reassign' : claimStand?.occupied ? 'Override assign' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}