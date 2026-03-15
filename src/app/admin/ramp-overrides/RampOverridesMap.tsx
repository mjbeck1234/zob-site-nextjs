'use client';

import { useEffect, useMemo, useRef } from 'react';

type RampOccStand = {
  id: string;
  ref?: string;
  name?: string;
  airline?: string;
  areaId?: string;
  lat?: number;
  lon?: number;
};

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
};

type Center = { lat: number; lon: number };
type Bbox = { south: number; west: number; north: number; east: number };

export default function RampOverridesMap(props: {
  icao: string;
  center: Center | null;
  bbox: Bbox | null;
  stands: RampOccStand[];
  overrides: OverrideRow[];
  placementEnabled: boolean;
  dragOverridesEnabled: boolean;
  canEdit: boolean;
  picked: { lat: number; lon: number } | null;
  onPick: (lat: number, lon: number) => void;
  onMoveOverride: (id: number, lat: number, lon: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  // The map click handler is registered once; use refs to read the latest props.
  const placementEnabledRef = useRef<boolean>(props.placementEnabled);
  const onPickRef = useRef<(lat: number, lon: number) => void>(props.onPick);

  useEffect(() => {
    placementEnabledRef.current = props.placementEnabled;
    onPickRef.current = props.onPick;
  }, [props.placementEnabled, props.onPick]);

  const center = useMemo(() => {
    const c = props.center;
    if (c && Number.isFinite(c.lat) && Number.isFinite(c.lon)) return c;
    // DTW fallback
    return { lat: 42.2124, lon: -83.3534 };
  }, [props.center]);

  useEffect(() => {
    let destroyed = false;

    async function init() {
      if (!containerRef.current || mapRef.current) return;

      const LModule = await import('leaflet');
      const L = (LModule as any)?.default ?? (LModule as any);
      leafletRef.current = L;

      // This map uses divIcon/circleMarker layers, so we intentionally avoid
      // overriding Leaflet's default marker asset URLs here. The repo does not
      // ship a public/leaflet asset folder, and leaving those overrides in place
      // can trigger broken image requests.

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
        preferCanvas: true,
      });

      mapRef.current = map;

      const tileUrl =
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

      L.tileLayer(tileUrl, {
        maxZoom: 20,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap &copy; CARTO',
      }).addTo(map);

      map.setView([center.lat, center.lon], 16);

      if (props.bbox) {
        try {
          const b = props.bbox;
          const bounds = L.latLngBounds(
            L.latLng(b.south, b.west),
            L.latLng(b.north, b.east)
          );
          map.fitBounds(bounds, { padding: [18, 18] });
        } catch {
          // ignore
        }
      }

      if (destroyed) return;

      // Click-to-place marker
      map.on('click', (e: any) => {
        if (!placementEnabledRef.current) return;
        const lat = Number(e?.latlng?.lat);
        const lon = Number(e?.latlng?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        onPickRef.current(lat, lon);
      });
    }

    init();

    return () => {
      destroyed = true;
      try {
        mapRef.current?.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
      leafletRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render layers whenever inputs change
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    // Clear previous layers we added.
    (map as any).__zobLayers = (map as any).__zobLayers || [];
    for (const layer of (map as any).__zobLayers) {
      try {
        map.removeLayer(layer);
      } catch {
        // ignore
      }
    }
    (map as any).__zobLayers = [];

    // Stands render strategy:
    // - Zoomed out: tiny dots
    // - Zoomed in: labeled gate/stand markers (refs)
    const STAND_LABEL_MIN_ZOOM = 12;

    const standsDotsLayer = L.layerGroup();
    const standsLabelsLayer = L.layerGroup();
    const overridesLayer = L.layerGroup();
    const pickLayer = L.layerGroup();

    standsDotsLayer.addTo(map);
    standsLabelsLayer.addTo(map);
    overridesLayer.addTo(map);
    pickLayer.addTo(map);

    (map as any).__zobLayers.push(
      standsDotsLayer,
      standsLabelsLayer,
      overridesLayer,
      pickLayer
    );

    const renderStands = () => {
      try {
        standsDotsLayer.clearLayers();
        standsLabelsLayer.clearLayers();
      } catch {
        // ignore
      }

      const showLabels = Number(map.getZoom?.() ?? 0) >= STAND_LABEL_MIN_ZOOM;

      for (const s of props.stands || []) {
        const lat = Number(s.lat);
        const lon = Number(s.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        const ref = String(s.ref || '').trim().toUpperCase();
        const tooltipLabel = `${(s.ref || s.name || s.airline || 'Stand').toString()}\n${s.id}`;

        if (showLabels && ref) {
          try {
            const iconHtml = `<div class="ids-ramp-gate open" style="height:16px;padding:0 6px;border-radius:7px;font-size:10px;">${ref}</div>`;
            const icon = L.divIcon({
              className: '',
              html: iconHtml,
              iconSize: [Math.min(100, Math.max(20, 10 + ref.length * 7)), 16],
              iconAnchor: [10, 8],
            });

            L.marker([lat, lon], { icon, interactive: false })
              .bindTooltip(tooltipLabel, { direction: 'top', opacity: 0.85 })
              .addTo(standsLabelsLayer);
          } catch {
            // ignore
          }
        } else {
          // Zoomed out or no ref available: draw a small dot.
          try {
            L.circleMarker([lat, lon], {
              radius: 2,
              weight: 1,
              opacity: 0.7,
              fillOpacity: 0.35,
            })
              .bindTooltip(tooltipLabel, { direction: 'top', opacity: 0.85 })
              .addTo(standsDotsLayer);
          } catch {
            // ignore
          }
        }
      }
    };

    renderStands();
    map.on('zoomend', renderStands);

    // Existing ADD overrides (draggable when enabled)
    for (const o of props.overrides || []) {
      if (o.type !== 'add') continue;
      if (!o.active) continue;
      const lat = Number(o.lat);
      const lon = Number(o.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const label = String(o.stand_ref || o.name || o.stand_id || '').trim().toUpperCase();

      const iconHtml = `<div class="ids-ramp-gate held" style="height:18px;padding:0 8px;border-radius:8px;font-size:11px;">${label || 'ADD'}</div>`;
      const icon = L.divIcon({
        className: '',
        html: iconHtml,
        iconSize: [Math.min(110, Math.max(26, 14 + label.length * 7)), 18],
        iconAnchor: [20, 9],
      });

      const draggable = props.canEdit && props.dragOverridesEnabled;

      const m = L.marker([lat, lon], { icon, draggable });
      m.bindTooltip(`ADD override #${o.id}\n${label || o.stand_id}`, { direction: 'top', opacity: 0.9 });

      if (draggable) {
        m.on('dragend', (e: any) => {
          const ll = e?.target?.getLatLng?.();
          const nlat = Number(ll?.lat);
          const nlon = Number(ll?.lng);
          if (!Number.isFinite(nlat) || !Number.isFinite(nlon)) return;
          props.onMoveOverride(o.id, nlat, nlon);
        });
      }

      m.addTo(overridesLayer);
    }

    // Pick marker (draggable)
    const picked = props.picked;
    if (picked && Number.isFinite(picked.lat) && Number.isFinite(picked.lon)) {
      const iconHtml = `<div class="ids-ramp-gate open" style="height:18px;padding:0 8px;border-radius:8px;font-size:11px;">NEW</div>`;
      const icon = L.divIcon({ className: '', html: iconHtml, iconSize: [44, 18], iconAnchor: [22, 9] });

      const pm = L.marker([picked.lat, picked.lon], { icon, draggable: props.placementEnabled });
      pm.bindTooltip('New stand coordinate (drag to adjust)', { direction: 'top', opacity: 0.9 });

      if (props.placementEnabled) {
        pm.on('dragend', (e: any) => {
          const ll = e?.target?.getLatLng?.();
          const nlat = Number(ll?.lat);
          const nlon = Number(ll?.lng);
          if (!Number.isFinite(nlat) || !Number.isFinite(nlon)) return;
          props.onPick(nlat, nlon);
        });
      }

      pm.addTo(pickLayer);
    }

    // Cleanup zoom handler when layers rerender
    return () => {
      try {
        map.off('zoomend', renderStands);
      } catch {
        // ignore
      }
    };
  }, [
    props.stands,
    props.overrides,
    props.picked,
    props.placementEnabled,
    props.dragOverridesEnabled,
    props.canEdit,
    props.onPick,
    props.onMoveOverride,
  ]);

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
