'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MapView } from '@/components/map/mapView';
import { Waypoints } from '@/components/query/waypoints';
import { StatusCards } from '@/components/query/statusCards';
import { EnrouteInput } from '@/components/query/enroutesForm';
import { RoutesForm } from '@/components/query/routesForm';
import { CrossingsInput } from '@/components/query/crossingsForm';
import { AirportQuickLook } from '@/components/query/airportQuickLook';
import { FlowProvider } from '@/components/query/flowContext';
import { RoutePlannerProvider } from '@/components/map/routePlannerContext';
import { RampPanel } from './RampPanel';

export default function IDSClient() {
  const [tab, setTab] = useState<string>('airport');
  const [rampAirport, setRampAirport] = useState<string>('KDTW');
  const [rampIconScale, setRampIconScale] = useState<number>(1.0);
  const [rampAreaId, setRampAreaId] = useState<string>('all');
  const [rampFocusMode, setRampFocusMode] = useState<boolean>(false);
  const [rampShowBackground, setRampShowBackground] = useState<boolean>(true);
  const [rampShowTrails, setRampShowTrails] = useState<boolean>(true);

  // Ramp overlays should ONLY render when the Ramp tab is selected.
  // Otherwise IDS should behave like a radar: full ARTCC boundaries + neighbors + aircraft.
  const isRampTab = tab === 'ramp';


  const searchParams = useSearchParams();
  const didInitRef = useRef(false);
  const STORAGE_KEY = 'zob.ids.prefs.v1';

  // Load saved prefs once (and allow URL params to override).
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    // 1) Load localStorage
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const j = JSON.parse(raw);
        if (typeof j?.tab === 'string') setTab(j.tab);
        if (typeof j?.rampAirport === 'string') setRampAirport(j.rampAirport);
        if (typeof j?.rampIconScale === 'number') setRampIconScale(j.rampIconScale);
        if (typeof j?.rampAreaId === 'string') setRampAreaId(j.rampAreaId);
        if (typeof j?.rampFocusMode === 'boolean') setRampFocusMode(j.rampFocusMode);
        if (typeof j?.rampShowBackground === 'boolean') setRampShowBackground(j.rampShowBackground);
        if (typeof j?.rampShowTrails === 'boolean') setRampShowTrails(j.rampShowTrails);
      }
    } catch {
      // ignore
    }

    // 2) URL overrides (highest priority)
    try {
      const tabParam = searchParams.get('tab');
      const rampAirportParam = searchParams.get('rampAirport');
      const iconScaleParam = searchParams.get('iconScale');
      const areaIdParam = searchParams.get('areaId');
      const focusParam = searchParams.get('focus');
      const bgParam = searchParams.get('bg');
      const trailsParam = searchParams.get('trails');

      if (tabParam) setTab(tabParam);
      if (rampAirportParam) setRampAirport(String(rampAirportParam).toUpperCase());
      if (iconScaleParam && !Number.isNaN(Number(iconScaleParam))) setRampIconScale(Math.max(0.25, Math.min(3, Number(iconScaleParam))));
      if (areaIdParam) setRampAreaId(areaIdParam);
      if (focusParam != null) setRampFocusMode(focusParam === '1' || focusParam === 'true');
      if (bgParam != null) setRampShowBackground(bgParam === '1' || bgParam === 'true');
      if (trailsParam != null) setRampShowTrails(trailsParam === '1' || trailsParam === 'true');
    } catch {
      // ignore
    }
  }, [searchParams]);

  // Persist prefs
  useEffect(() => {
    if (!didInitRef.current) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          tab,
          rampAirport,
          rampIconScale,
          rampAreaId,
          rampFocusMode,
          rampShowBackground,
          rampShowTrails,
        })
      );
    } catch {
      // ignore
    }
  }, [tab, rampAirport, rampIconScale, rampAreaId, rampFocusMode, rampShowBackground, rampShowTrails]);

  return (
    <FlowProvider>
      <RoutePlannerProvider>
        <div className="w-full">
          {/* 40/60 split on desktop */}
          <div className="grid w-full gap-6 lg:grid-cols-[2fr_3fr]">
            <div className="min-w-0 space-y-6">
              <Tabs value={tab} onValueChange={setTab} className="w-full">
                <TabsList className="w-full flex flex-wrap gap-1 justify-start">
                  <TabsTrigger value="airport">Airport</TabsTrigger>
                  <TabsTrigger value="ramp">Ramp</TabsTrigger>
                  <TabsTrigger value="waypoints">Waypoints</TabsTrigger>
                  <TabsTrigger value="status">Status</TabsTrigger>
                  <TabsTrigger value="enroutes">Enroutes</TabsTrigger>
                  <TabsTrigger value="routes">Routes</TabsTrigger>
                  <TabsTrigger value="crossings">Crossings</TabsTrigger>
                </TabsList>

                <TabsContent value="airport" className="mt-6">
                  <AirportQuickLook />
                </TabsContent>

                <TabsContent value="ramp" className="mt-6">
                  <RampPanel
                    airport={rampAirport}
                    setAirport={setRampAirport}
                    iconScale={rampIconScale}
                    setIconScale={setRampIconScale}
                    areaId={rampAreaId}
                    setAreaId={setRampAreaId}
                    focusMode={rampFocusMode}
                    setFocusMode={setRampFocusMode}
                    showBackground={rampShowBackground}
                    setShowBackground={setRampShowBackground}
                    showTrails={rampShowTrails}
                    setShowTrails={setRampShowTrails}
                  />
                </TabsContent>

                <TabsContent value="waypoints" className="mt-6">
                  <Waypoints />
                </TabsContent>

                <TabsContent value="status" className="mt-6">
                  <StatusCards />
                </TabsContent>

                <TabsContent value="enroutes" className="mt-6">
                  <EnrouteInput />
                </TabsContent>

                <TabsContent value="routes" className="mt-6">
                  <RoutesForm />
                </TabsContent>

                <TabsContent value="crossings" className="mt-6">
                  <CrossingsInput />
                </TabsContent>
              </Tabs>
            </div>

            <div className="min-w-0 space-y-6">
              {/* Single persistent map. This prevents hidden tabs from mounting extra Leaflet maps,
                  which can accidentally consume queued routes and plot them into a hidden map. */}
              <MapView
                // Only enable ramp mode when viewing the Ramp tab.
                rampAirport={isRampTab ? rampAirport : null}
                rampIconScale={rampIconScale}
              />
            </div>
          </div>
        </div>
      </RoutePlannerProvider>
    </FlowProvider>
  );
}
