"use client";

import { useEffect, useRef, useState, type RefObject } from 'react';
import Link from 'next/link';

import { HIGH_SECTORS, LOW_SECTORS } from '@/lib/splits/sectorGroups';

type AirportPoint = {
  icao: string;
  label: string;
  longName: string;
  classType: 'B' | 'C' | 'D';
  lon: number;
  lat: number;
};

type LeafletMap = any;
type LeafletModule = any;

type ResetViewFn = () => void;

function classTone(classType: AirportPoint['classType']) {
  if (classType === 'B') return { fill: '#ec4899', label: 'Class Bravo' };
  if (classType === 'C') return { fill: '#2563eb', label: 'Class Charlie' };
  return { fill: '#16a34a', label: 'Class Delta' };
}

function reportPilotMapIssue(context: string, error?: unknown) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[pilot-resource-map] ${context}`, error);
  }
}

function interactionMethods(map: LeafletMap): Array<[string, () => void]> {
  return [
    ['dragging', () => map.dragging?.disable?.()],
    ['scrollWheelZoom', () => map.scrollWheelZoom?.disable?.()],
    ['doubleClickZoom', () => map.doubleClickZoom?.disable?.()],
    ['boxZoom', () => map.boxZoom?.disable?.()],
    ['keyboard', () => map.keyboard?.disable?.()],
    ['touchZoom', () => map.touchZoom?.disable?.()],
    ['tap', () => map.tap?.disable?.()],
  ];
}

function disableMapInteraction(map: LeafletMap) {
  for (const [name, disable] of interactionMethods(map)) {
    try {
      disable();
    } catch (error) {
      reportPilotMapIssue(`Failed to disable ${name}`, error);
    }
  }
}

function fitPadding() {
  if (typeof window === 'undefined') return [10, 10] as [number, number];
  if (window.innerWidth >= 1280) return [6, 6] as [number, number];
  if (window.innerWidth >= 768) return [8, 8] as [number, number];
  return [14, 14] as [number, number];
}

function fitPadFactor(desktop: number, mobile: number) {
  if (typeof window === 'undefined') return desktop;
  return window.innerWidth >= 1024 ? desktop : mobile;
}

function useStaticLeafletMap(
  containerRef: RefObject<HTMLDivElement | null>,
  render: (args: { L: LeafletModule; map: LeafletMap }) => Promise<() => void> | (() => void),
) {
  const mapRef = useRef<LeafletMap | null>(null);
  const renderRef = useRef(render);
  renderRef.current = render;

  useEffect(() => {
    let cancelled = false;
    let cleanupRender: (() => void) | undefined;

    (async () => {
      if (!containerRef.current || mapRef.current) return;

      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current) return;

      const el: any = containerRef.current;
      if (el && el._leaflet_id) {
        try {
          delete el._leaflet_id;
        } catch (error) {
          reportPilotMapIssue('Failed to clear stale Leaflet container id', error);
        }
      }

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 19,
      }).addTo(map);

      map.setView([41.35, -82.35], 6);
      disableMapInteraction(map);

      cleanupRender = await renderRef.current({ L, map });

      requestAnimationFrame(() => {
        try {
          map.invalidateSize(false);
        } catch (error) {
          reportPilotMapIssue('Failed to invalidate pilot resource map size', error);
        }
      });
    })();

    return () => {
      cancelled = true;
      try {
        cleanupRender?.();
      } catch (error) {
        reportPilotMapIssue('Failed to clean up pilot resource map layers', error);
      }
      try {
        mapRef.current?.remove();
      } catch (error) {
        reportPilotMapIssue('Failed to remove pilot resource map instance', error);
      }
      mapRef.current = null;
    };
  }, [containerRef]);
}

function TinyMapButton(props: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="rounded-full border border-white/10 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-white"
    >
      {props.children}
    </button>
  );
}

export function PilotAirportsReferenceMap(props: { airports: AirportPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resetViewRef = useRef<ResetViewFn>(() => undefined);
  const [loadError, setLoadError] = useState(false);
  const [showLegend, setShowLegend] = useState(true);

  useStaticLeafletMap(containerRef, async ({ L, map }) => {
    const layers: any[] = [];
    resetViewRef.current = () => map.setView([41.35, -82.35], 6);

    try {
      const res = await fetch('/boundaries.geojson', { cache: 'force-cache' });
      if (res.ok) {
        const geo = await res.json();
        const boundaryLayer = L.geoJSON(geo, {
          style: (feature: any) => {
            const isZob = String(feature?.properties?.id ?? '').toUpperCase() === 'KZOB';
            return {
              color: isZob ? '#475569' : '#94a3b8',
              weight: isZob ? 2.4 : 1,
              opacity: isZob ? 0.95 : 0.22,
              fillColor: isZob ? '#cbd5e1' : '#ffffff',
              fillOpacity: isZob ? 0.04 : 0,
            } as any;
          },
        }).addTo(map);
        layers.push(boundaryLayer);

        const zobFeature = geo?.features?.find?.((feature: any) => String(feature?.properties?.id ?? '').toUpperCase() === 'KZOB');
        if (zobFeature) {
          const zobBounds = L.geoJSON(zobFeature).getBounds?.();
          if (zobBounds && zobBounds.isValid?.()) {
            const applyDefaultView = () => {
              map.fitBounds(zobBounds.pad(fitPadFactor(0.06, 0.12)), { padding: fitPadding() });
            };
            resetViewRef.current = applyDefaultView;
            applyDefaultView();
          }
        }
      }
    } catch (error) {
      reportPilotMapIssue('Failed to load /boundaries.geojson', error);
      setLoadError(true);
    }

    const markerLayer = L.layerGroup().addTo(map);
    layers.push(markerLayer);

    for (const airport of props.airports) {
      const tone = classTone(airport.classType);
      const marker = L.circleMarker([airport.lat, airport.lon], {
        radius: airport.classType === 'B' ? 6.5 : airport.classType === 'C' ? 5.75 : 5,
        color: '#ffffff',
        weight: 1.5,
        fillColor: tone.fill,
        fillOpacity: 0.95,
      }).addTo(markerLayer);

      marker.bindTooltip(
        `<div style="font-weight:700">${airport.icao}</div><div>${airport.longName}</div><div style="opacity:.75">${tone.label}</div>`,
        { direction: 'top', sticky: true },
      );
    }

    return () => {
      for (const layer of layers) {
        try {
          layer.remove();
        } catch (error) {
          reportPilotMapIssue('Failed to remove pilot airport layer', error);
        }
      }
    };
  });

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-white">Controlled airports map</div>
          <div className="mt-1 text-xs text-white/45">A light reference map styled closer to the existing pilot briefing.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TinyMapButton onClick={() => resetViewRef.current()}>Reset view</TinyMapButton>
          <TinyMapButton onClick={() => setShowLegend((prev) => !prev)}>{showLegend ? 'Hide legend' : 'Show legend'}</TinyMapButton>
        </div>
      </div>

      {showLegend ? (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/55">
          <span className="rounded-full border border-white/10 px-2 py-1">Bravo 3</span>
          <span className="rounded-full border border-white/10 px-2 py-1">Charlie 6</span>
          <span className="rounded-full border border-white/10 px-2 py-1">Delta 21</span>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-100/95">
        <div ref={containerRef} className="h-[320px] w-full md:h-[390px] lg:h-[430px]" />
      </div>
      {loadError ? <div className="mt-3 text-xs text-amber-200/80">The boundary overlay could not be loaded, but airport markers will still display.</div> : null}
    </div>
  );
}

function SplitPanel(props: {
  title: string;
  note: string;
  sectorSet: Set<string>;
  stroke: string;
  fill: string;
  labelColor: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resetViewRef = useRef<ResetViewFn>(() => undefined);
  const [loadError, setLoadError] = useState(false);

  useStaticLeafletMap(containerRef, async ({ L, map }) => {
    const layers: any[] = [];
    resetViewRef.current = () => map.setView([41.35, -82.35], 6);

    try {
      const res = await fetch('/maps/zob_sectors.geojson', { cache: 'force-cache' });
      if (!res.ok) throw new Error('geojson');
      const geo = await res.json();

      const labels = L.layerGroup().addTo(map);
      layers.push(labels);

      const sectorLayer = L.geoJSON(geo, {
        filter: (feature: any) => props.sectorSet.has(String(feature?.properties?.sector ?? feature?.properties?.id ?? '').toUpperCase()),
        style: {
          color: props.stroke,
          weight: 2.2,
          opacity: 0.95,
          fillColor: props.fill,
          fillOpacity: 0.12,
        } as any,
        onEachFeature: (feature: any, layer: any) => {
          const code = String(feature?.properties?.sector ?? feature?.properties?.id ?? '').toUpperCase();
          const shortCode = code.replace(/^ZOB/, '');
          layer.bindTooltip(`<div style="font-weight:700">${code}</div>`, { direction: 'top', sticky: true });

          const bounds = layer.getBounds?.();
          if (bounds?.isValid?.()) {
            const center = bounds.getCenter();
            L.marker(center, {
              interactive: false,
              keyboard: false,
              icon: L.divIcon({
                className: '',
                html: `<div style="font-size:11px;font-weight:700;line-height:1;color:${props.labelColor};text-shadow:0 1px 0 rgba(255,255,255,0.9)">${shortCode}</div>`,
              }),
            }).addTo(labels);
          }
        },
      }).addTo(map);

      layers.push(sectorLayer);

      const bounds = sectorLayer.getBounds?.();
      if (bounds?.isValid?.()) {
        const applyDefaultView = () => {
          map.fitBounds(bounds.pad(fitPadFactor(0.03, 0.08)), { padding: fitPadding() });
        };
        resetViewRef.current = applyDefaultView;
        applyDefaultView();
      }
    } catch (error) {
      reportPilotMapIssue(`Failed to load split overlay for ${props.title}`, error);
      setLoadError(true);
    }

    return () => {
      for (const layer of layers) {
        try {
          layer.remove();
        } catch (error) {
          reportPilotMapIssue(`Failed to remove split overlay for ${props.title}`, error);
        }
      }
    };
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">{props.title}</div>
        <div className="flex items-center gap-2">
          <div className="text-[11px] uppercase tracking-wide text-white/45">{props.note}</div>
          <TinyMapButton onClick={() => resetViewRef.current()}>Reset view</TinyMapButton>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-100/95">
        <div ref={containerRef} className="h-[270px] w-full md:h-[350px] lg:h-[400px]" />
      </div>
      {loadError ? <div className="text-xs text-amber-200/80">The split overlay could not be loaded for this panel.</div> : null}
    </div>
  );
}

export function PilotCenterSplitReferenceMaps() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Center split reference</div>
          <div className="mt-1 text-xs text-white/45">Low and high center maps laid out more like the existing pilot briefing.</div>
        </div>
        <Link href="/splits" className="text-xs font-semibold text-amber-200/90 hover:text-amber-200">
          Open live split map →
        </Link>
      </div>
      <div className="mt-4 space-y-4">
        <SplitPanel
          title="Low Center"
          note="Primary ZOB 04"
          sectorSet={LOW_SECTORS}
          stroke="#6366f1"
          fill="#818cf8"
          labelColor="#4338ca"
        />
        <SplitPanel
          title="High Center"
          note="Primary ZOB 48"
          sectorSet={HIGH_SECTORS}
          stroke="#ef4444"
          fill="#f87171"
          labelColor="#b91c1c"
        />
      </div>
    </div>
  );
}
