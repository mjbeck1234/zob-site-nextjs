"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";

export type AircraftSnapshot = {
  callsign: string;
  latitude: number;
  longitude: number;
  altitude: number;
  groundspeed: number;
  heading: number;
  transponder: number;
  route: string;
  departure: string;
  arrival: string;
  aircraftType: string;
  aircraftShort: string;
  aircraftFaa: string;
  aircraftRaw: string;
  wakeCategory: string;
  wakeLabel: string;
  wingspanFt: number | null;
};

const WINGSPAN_FT_LOOKUP: Record<string, number> = {
  A19N: 117,
  A20N: 118,
  A21N: 118,
  A220: 115,
  A223: 115,
  A320: 118,
  A319: 112,
  A321: 118,
  A332: 198,
  A333: 198,
  A359: 212,
  A388: 262,
  B38M: 118,
  B39M: 118,
  B37M: 118,
  B733: 94,
  B734: 94,
  B735: 94,
  B736: 112,
  B737: 112,
  B738: 118,
  B739: 118,
  B752: 125,
  B753: 125,
  B763: 156,
  B764: 170,
  B77W: 213,
  B772: 199,
  B788: 197,
  B789: 197,
  B78X: 212,
  B744: 211,
  B748: 224,
  C172: 36,
  C208: 52,
  CRJ2: 70,
  CRJ7: 77,
  CRJ9: 81,
  DH8D: 93,
  E170: 86,
  E175: 86,
  E190: 94,
  E195: 94,
  MD11: 169,
};

function normalizeWingspanKey(...values: Array<string | undefined | null>) {
  for (const raw of values) {
    const key = String(raw ?? "").trim().toUpperCase();
    if (!key) continue;
    if (WINGSPAN_FT_LOOKUP[key] != null) return key;
  }
  return "";
}

function parseWakeCategory(rawAircraft: string) {
  const text = String(rawAircraft ?? "").trim().toUpperCase();
  const match = text.match(/\/([JLHMS])(?:-|$)/);
  const wake = match?.[1] ?? "";
  const wakeLabel = wake === "J"
    ? "Super"
    : wake === "H"
      ? "Heavy"
      : wake === "M"
        ? "Medium"
        : wake === "L"
          ? "Light"
          : wake === "S"
            ? "Super"
            : "Unknown";
  return { wakeCategory: wake, wakeLabel };
}

type Aircraft = AircraftSnapshot;

function makeAircraftIcon(L: any, color: string, heading: number = 0) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 24px;
        height: 24px;
        transform: rotate(${heading}deg);
      ">
        <svg xmlns="http://www.w3.org/2000/svg"
             viewBox="0 0 423 394"
             width="20"
             height="20"
             fill="${color}">
        <path d="M172.07 381C171.19 381 170.42 380.43 170.16 379.59C170.07 379.3 167.92 372.39 166.8 368.03C166.28 366.01 165.74 363.5 165.18 360.55L112.91 372.19C112.77 372.22 112.62 372.24 112.48 372.24C112.03 372.24 111.59 372.09 111.23 371.8C110.76 371.42 110.48 370.85 110.48 370.24V360.03C110.48 359.91 110.49 359.78 110.51 359.66C110.98 357.19 111.8 355.84 113.92 354.11C113.99 354.05 114.07 354 114.14 353.95L155.74 328.46C156.29 328.05 157.24 327.29 157.66 326.81C157.99 326.44 158.4 325.82 158.72 325.29C157.99 321.2 157.4 317.64 156.97 314.68C155.11 302.11 153.43 282.87 153.41 282.68C153.41 282.62 153.41 282.56 153.41 282.51V195.74H130.01C129.97 196.14 129.94 196.53 129.9 196.88C129.78 197.94 129.47 199.49 129.46 199.55C128.97 201.73 128.03 202.82 126.67 202.82C125.31 202.82 124.36 201.73 123.88 199.59C123.86 199.48 123.55 197.93 123.43 196.88C123.39 196.53 123.35 196.14 123.32 195.74H121.37C121.25 196.43 121.14 197.01 121.13 197.05C120.64 199.23 119.7 200.32 118.34 200.32C116.98 200.32 116.03 199.23 115.55 197.09C115.54 197.03 115.42 196.43 115.3 195.74H111.95L95.56 200.46C95.49 201.36 95.41 202.32 95.32 203.13C95.2 204.19 94.89 205.74 94.88 205.8C94.39 207.99 93.45 209.07 92.09 209.07C90.73 209.07 89.78 207.98 89.3 205.84C89.28 205.73 88.97 204.18 88.85 203.13C88.82 202.9 88.8 202.67 88.78 202.42L59.37 210.9C59.29 212.01 59.19 213.34 59.07 214.39C58.95 215.45 58.64 216.99 58.63 217.06C58.14 219.25 57.2 220.33 55.84 220.33C54.48 220.33 53.53 219.24 53.05 217.1C53.03 216.99 52.72 215.44 52.6 214.39C52.55 213.93 52.5 213.42 52.45 212.9L7.62004 225.9L7.48004 228.25C7.46004 228.6 7.35004 228.94 7.15004 229.23C6.69004 229.93 5.99004 230.33 5.23004 230.33C4.47004 230.33 3.77004 229.93 3.31004 229.23C3.09004 228.9 2.98004 228.52 2.98004 228.13V224.58C2.98004 224.47 2.75004 219.61 3.44004 216.44C4.21004 212.94 4.85004 210.61 7.16004 207.71C8.39004 206.17 10.58 204.45 10.83 204.25C10.93 204.17 11.04 204.1 11.15 204.05L109.09 154.05C108.26 153.93 107.57 153.3 107.41 152.45C107.35 152.13 105.88 144.57 105.5 139.51L105.47 139.14C105.09 134.08 104.86 131.02 105.51 125.78L105.58 125.22C105.82 123.25 105.99 121.83 106.61 119.64C106.91 118.59 107.46 117.06 107.49 117C107.78 116.21 108.53 115.69 109.37 115.69H127.08C127.86 115.69 128.57 116.14 128.9 116.85C128.93 116.91 129.64 118.45 130.01 119.53C130.77 121.69 130.97 123.1 131.25 125.06C131.25 125.06 131.38 125.97 131.4 126.09C131.65 126.28 131.85 126.52 132 126.81C132.15 127.11 132.89 128.7 132.83 130.27C132.79 131.37 132.27 133.04 132.11 133.53C132.02 133.79 131.89 134.03 131.71 134.23C131.67 135.08 131.61 135.95 131.54 136.85C131.48 137.67 131.42 138.54 131.37 139.48C131.31 140.43 131.22 141.55 131.1 142.82L149.7 133.32C150.3 132.78 151.52 131.61 152.08 130.76C152.54 130.07 153.01 128.88 153.42 127.39V73.79C153.34 72.58 152.5 58.84 153.43 49.77C153.89 45.27 154.27 42.75 155.13 38.53C156.19 33.29 156.89 30.25 158.74 24.93C160.38 20.2 163.64 13.45 164.01 12.69C164.39 11.76 166.83 6.05 170.36 3.71C171.44 2.99 172.35 2.54 173.5 2.16C173.57 2.14 173.64 2.12 173.71 2.1C173.93 2.05 174.22 2 174.56 2C174.84 2 175.11 2.03 175.43 2.11C175.49 2.12 175.55 2.14 175.61 2.16C176.75 2.54 177.66 2.99 178.75 3.71C182.28 6.05 184.72 11.76 185.1 12.69C185.47 13.45 188.72 20.21 190.37 24.93C192.22 30.24 192.92 33.29 193.98 38.53C194.84 42.75 195.22 45.27 195.68 49.77C196.61 58.84 195.77 72.59 195.69 73.79V127.39C196.09 128.87 196.57 130.06 197.03 130.76C197.59 131.61 198.81 132.78 199.41 133.32L218.01 142.82C217.89 141.55 217.8 140.44 217.74 139.48C217.69 138.53 217.63 137.66 217.57 136.84C217.51 135.94 217.45 135.07 217.4 134.22C217.23 134.02 217.09 133.79 217 133.52C216.89 133.17 216.32 131.4 216.28 130.26C216.22 128.68 216.96 127.1 217.11 126.8C217.25 126.51 217.46 126.27 217.71 126.08C217.73 125.96 217.86 125.05 217.86 125.05C218.14 123.09 218.35 121.68 219.1 119.52C219.48 118.44 220.18 116.91 220.21 116.85C220.54 116.14 221.25 115.68 222.03 115.68H239.74C240.58 115.68 241.33 116.2 241.62 116.99C241.64 117.05 242.2 118.58 242.5 119.63C243.12 121.82 243.29 123.24 243.53 125.2L243.6 125.77C244.24 131.01 244.02 134.06 243.64 139.12L243.61 139.5C243.23 144.56 241.77 152.12 241.7 152.44C241.53 153.29 240.85 153.92 240.02 154.04L337.96 204.04C338.07 204.1 338.18 204.16 338.28 204.24C338.53 204.43 340.72 206.16 341.95 207.7C344.27 210.61 344.9 212.94 345.67 216.43C346.37 219.6 346.14 224.46 346.13 224.67V228.12C346.13 228.51 346.02 228.89 345.8 229.22C345.34 229.92 344.64 230.32 343.88 230.32C343.12 230.32 342.42 229.92 341.96 229.22C341.77 228.93 341.65 228.59 341.63 228.24L341.49 225.89L296.66 212.89C296.62 213.41 296.57 213.92 296.52 214.38C296.4 215.44 296.09 216.99 296.08 217.05C295.59 219.24 294.65 220.32 293.29 220.32C291.93 220.32 290.99 219.23 290.5 217.09C290.48 216.98 290.17 215.43 290.05 214.38C289.93 213.35 289.83 212.06 289.75 210.89L260.34 202.41C260.32 202.66 260.29 202.9 260.27 203.12C260.15 204.18 259.84 205.73 259.83 205.79C259.34 207.97 258.41 209.06 257.04 209.06C255.67 209.06 254.73 207.97 254.25 205.83C254.23 205.72 253.92 204.17 253.8 203.12C253.71 202.31 253.63 201.34 253.56 200.45L237.17 195.73H233.82C233.7 196.42 233.59 197 233.58 197.04C233.09 199.23 232.15 200.31 230.79 200.31C229.43 200.31 228.49 199.22 228 197.08C227.99 197.02 227.87 196.42 227.75 195.73H225.8C225.76 196.13 225.72 196.52 225.68 196.87C225.56 197.93 225.25 199.47 225.24 199.54C224.75 201.73 223.81 202.81 222.45 202.81C221.09 202.81 220.15 201.72 219.66 199.58C219.64 199.47 219.33 197.92 219.21 196.87C219.17 196.52 219.13 196.13 219.1 195.73H195.7V282.5C195.7 282.56 195.7 282.62 195.7 282.67C195.68 282.86 194.01 302.1 192.14 314.67C191.7 317.6 191.11 321.17 190.39 325.28C190.68 325.77 191.09 326.4 191.44 326.8C191.87 327.27 192.82 328.04 193.37 328.45L234.97 353.94C235.05 353.99 235.12 354.04 235.19 354.1C237.3 355.83 238.13 357.18 238.6 359.65C238.62 359.77 238.64 359.9 238.64 360.02V370.23C238.64 370.84 238.36 371.41 237.89 371.79C237.53 372.08 237.09 372.23 236.64 372.23C236.5 372.23 236.35 372.21 236.21 372.18L183.94 360.54C183.38 363.49 182.84 366 182.32 368.02C181.2 372.38 179.05 379.28 178.96 379.58C178.7 380.42 177.93 380.99 177.05 380.99H172.13L172.07 381Z"/>
        </svg>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
    tooltipAnchor: [0, -10],
  });
}

export function LoadAircraft({
  map,
  onAircraftSnapshot,
  onSelectAircraft,
  highlightedCallsign,
}: {
  map: Leaflet.Map | null;
  onAircraftSnapshot?: (aircraft: AircraftSnapshot[]) => void;
  onSelectAircraft?: (aircraft: AircraftSnapshot) => void;
  highlightedCallsign?: string | null;
}) {
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const leafletRef = useRef<any>(null);
  const aircraftDataRef = useRef<AircraftSnapshot[]>([]);
  const snapshotCbRef = useRef<typeof onAircraftSnapshot>(undefined);
  const selectCbRef = useRef<typeof onSelectAircraft>(undefined);
  const highlightedRef = useRef<string>('');
  const [leafletReady, setLeafletReady] = useState(false);

  useEffect(() => {
    snapshotCbRef.current = onAircraftSnapshot;
  }, [onAircraftSnapshot]);

  useEffect(() => {
    selectCbRef.current = onSelectAircraft;
  }, [onSelectAircraft]);

  useEffect(() => {
    highlightedRef.current = String(highlightedCallsign ?? "").trim().toUpperCase();
    const L = leafletRef.current;
    if (!map || !leafletReady || !L || !layerRef.current) return;

    const group = layerRef.current;
    group.clearLayers();

    const data = aircraftDataRef.current;
    const ZOB_AIRPORTS = [
      "KBUF", "KCLE", "KDTW", "KPIT", "KROC", "KIAG",
      "KERI", "KBKL", "KCGF", "KCAK", "KMFD", "KPTK",
      "KYIP", "KDET", "KTOL", "KAGC"
    ];

    data.forEach((aircraft) => {
      if (!aircraft.latitude || !aircraft.longitude) return;

      const dep = aircraft.departure ?? "";
      const arr = aircraft.arrival ?? "";
      const isZobDeparture = !!dep && ZOB_AIRPORTS.includes(dep);
      const isZobArrival = !!arr && ZOB_AIRPORTS.includes(arr);
      const isVFR = String(aircraft.transponder ?? "") === "1200" && !arr;

      let color = "#FF6F00";
      if (isVFR) color = "#ffffff";
      else if (isZobArrival && isZobDeparture) color = "#FF1744";
      else if (isZobDeparture) color = "#00BFFF";
      else if (isZobArrival) color = "#FFD700";

      const icon = makeAircraftIcon(L, color, aircraft.heading ?? 0);
      const depLabel = dep || "—";
      const arrLabel = arr || "—";
      const tooltipContent = isVFR
        ? `${aircraft.callsign}, ${aircraft.altitude}, VFR`
        : `${aircraft.callsign} ${depLabel} ➔ ${arrLabel}`;

      const metaBits = [
        aircraft.aircraftType || "Unknown type",
        aircraft.wakeLabel !== "Unknown" ? `${aircraft.wakeLabel}${aircraft.wakeCategory ? ` (${aircraft.wakeCategory})` : ""}` : "",
        aircraft.wingspanFt ? `${aircraft.wingspanFt} ft span` : "",
      ].filter(Boolean);

      const popupContent = isVFR
        ? `<div style="font-size:16px;font-weight:bold;">${aircraft.callsign} VFR - ${aircraft.altitude}</div>
           <div style="font-size:11px;color:gray;margin-top:5px;">${metaBits.join(" · ")}</div>`
        : `<div style="font-size:16px;font-weight:bold;">${aircraft.callsign} ${depLabel} ➔ ${arrLabel} - ${aircraft.altitude}</div>
           <div style="font-size:11px;color:gray;margin-top:5px;">${metaBits.join(" · ")}</div>
           <div style="font-size:11px;color:gray;margin-top:5px;max-height:100px;overflow-y:auto;">${aircraft.route ?? ""}</div>`;

      if (highlightedRef.current && aircraft.callsign === highlightedRef.current) {
        L.circleMarker([aircraft.latitude, aircraft.longitude], {
          pane: "aircraftPane",
          radius: 16,
          weight: 2,
          color: "#facc15",
          fillOpacity: 0.06,
        }).addTo(group);
      }

      const marker = L.marker([aircraft.latitude, aircraft.longitude], {
        icon,
        pane: "aircraftPane",
      })
        .bindTooltip(tooltipContent, { sticky: true, direction: "top", pane: "aircraftTooltipPane" })
        .bindPopup(popupContent);

      if (typeof selectCbRef.current === "function") {
        marker.on("click", () => selectCbRef.current?.(aircraft));
      }

      marker.addTo(group);
    });
  }, [highlightedCallsign, map, leafletReady]);

  const ensureLeaflet = async () => {
    if (leafletRef.current) return leafletRef.current;
    const mod: any = await import("leaflet");
    leafletRef.current = mod?.default ?? mod;
    setLeafletReady(true);
    return leafletRef.current;
  };

  useEffect(() => {
    let mounted = true;
    ensureLeaflet().then(() => {
      if (mounted) setLeafletReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    if (!map || !leafletReady || !L) return;

    if (!layerRef.current) {
      if (!map.getPane("aircraftTooltipPane")) {
        map.createPane("aircraftTooltipPane");
        const pane = map.getPane("aircraftTooltipPane")!;
        pane.style.zIndex = "4000";
        pane.style.pointerEvents = "none";
      }

      const group = L.layerGroup([], { pane: "aircraftPane" }).addTo(map);
      layerRef.current = group;
    }

    const aircraftLayerGroup = layerRef.current;
    if (!aircraftLayerGroup) return;

    let cancelled = false;

    const fetchAircraft = async () => {
      try {
        const res = await fetch(`/api/ids/aircraft`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch aircraft data");

        const json = await res.json();
        const data: Aircraft[] = (json.aircraft ?? []).map((p: any) => {
          const fp = p?.flight_plan ?? {};
          const aircraftRaw = String(fp?.aircraft ?? "").trim().toUpperCase();
          const aircraftShort = String(fp?.aircraft_short ?? p?.aircraft_short ?? "").trim().toUpperCase();
          const aircraftFaa = String(fp?.aircraft_faa ?? p?.aircraft_faa ?? "").trim().toUpperCase();
          const wake = parseWakeCategory(aircraftRaw);
          const wingKey = normalizeWingspanKey(aircraftShort, aircraftFaa);
          return {
            callsign: String(p?.callsign ?? "").trim().toUpperCase(),
            latitude: Number(p?.latitude ?? 0),
            longitude: Number(p?.longitude ?? 0),
            altitude: Number(p?.altitude ?? 0),
            groundspeed: Number(p?.groundspeed ?? 0),
            heading: Number(p?.heading ?? 0),
            transponder: Number(p?.transponder ?? 0),
            route: String(p?.route ?? fp?.route ?? ""),
            departure: String(p?.departure ?? fp?.departure ?? "").trim().toUpperCase(),
            arrival: String(p?.arrival ?? fp?.arrival ?? "").trim().toUpperCase(),
            aircraftType: aircraftShort || aircraftFaa || String(p?.aircraft ?? "").trim().toUpperCase(),
            aircraftShort,
            aircraftFaa,
            aircraftRaw,
            wakeCategory: wake.wakeCategory,
            wakeLabel: wake.wakeLabel,
            wingspanFt: wingKey ? WINGSPAN_FT_LOOKUP[wingKey] ?? null : null,
          };
        });

        aircraftDataRef.current = data;
        if (typeof snapshotCbRef.current === "function") {
          snapshotCbRef.current(data);
        }

        if (cancelled || !map.hasLayer(aircraftLayerGroup)) return;
        aircraftLayerGroup.clearLayers();

        data.forEach((aircraft) => {
          if (!aircraft.latitude || !aircraft.longitude) return;

          const dep = aircraft.departure ?? "";
          const arr = aircraft.arrival ?? "";
          const isZobDeparture = !!dep && [
            "KBUF", "KCLE", "KDTW", "KPIT", "KROC", "KIAG",
            "KERI", "KBKL", "KCGF", "KCAK", "KMFD", "KPTK",
            "KYIP", "KDET", "KTOL", "KAGC"
          ].includes(dep);
          const isZobArrival = !!arr && [
            "KBUF", "KCLE", "KDTW", "KPIT", "KROC", "KIAG",
            "KERI", "KBKL", "KCGF", "KCAK", "KMFD", "KPTK",
            "KYIP", "KDET", "KTOL", "KAGC"
          ].includes(arr);
          const isVFR = String(aircraft.transponder ?? "") === "1200" && !arr;

          let color = "#FF6F00";
          if (isVFR) color = "#ffffff";
          else if (isZobArrival && isZobDeparture) color = "#FF1744";
          else if (isZobDeparture) color = "#00BFFF";
          else if (isZobArrival) color = "#FFD700";

          const icon = makeAircraftIcon(L, color, aircraft.heading ?? 0);
          const depLabel = dep || "—";
          const arrLabel = arr || "—";
          const tooltipContent = isVFR
            ? `${aircraft.callsign}, ${aircraft.altitude}, VFR`
            : `${aircraft.callsign} ${depLabel} ➔ ${arrLabel}`;

          const metaBits = [
            aircraft.aircraftType || "Unknown type",
            aircraft.wakeLabel !== "Unknown" ? `${aircraft.wakeLabel}${aircraft.wakeCategory ? ` (${aircraft.wakeCategory})` : ""}` : "",
            aircraft.wingspanFt ? `${aircraft.wingspanFt} ft span` : "",
          ].filter(Boolean);

          const popupContent = isVFR
            ? `<div style="font-size:16px;font-weight:bold;">${aircraft.callsign} VFR - ${aircraft.altitude}</div>
               <div style="font-size:11px;color:gray;margin-top:5px;">${metaBits.join(" · ")}</div>`
            : `<div style="font-size:16px;font-weight:bold;">${aircraft.callsign} ${depLabel} ➔ ${arrLabel} - ${aircraft.altitude}</div>
               <div style="font-size:11px;color:gray;margin-top:5px;">${metaBits.join(" · ")}</div>
               <div style="font-size:11px;color:gray;margin-top:5px;max-height:100px;overflow-y:auto;">${aircraft.route ?? ""}</div>`;

          if (highlightedRef.current && aircraft.callsign === highlightedRef.current) {
            L.circleMarker([aircraft.latitude, aircraft.longitude], {
              pane: "aircraftPane",
              radius: 16,
              weight: 2,
              color: "#facc15",
              fillOpacity: 0.06,
            }).addTo(aircraftLayerGroup);
          }

          const marker = L.marker([aircraft.latitude, aircraft.longitude], {
            icon,
            pane: "aircraftPane",
          })
            .bindTooltip(tooltipContent, { sticky: true, direction: "top", pane: "aircraftTooltipPane" })
            .bindPopup(popupContent);

          if (typeof selectCbRef.current === "function") {
            marker.on("click", () => selectCbRef.current?.(aircraft));
          }

          marker.addTo(aircraftLayerGroup);
        });
      } catch (err) {
        console.error("Error fetching aircraft data:", err);
      }
    };

    fetchAircraft();
    const intervalId = setInterval(fetchAircraft, 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      if (layerRef.current) {
        const lg = layerRef.current;
        if (lg) map.removeLayer(lg);
        layerRef.current = null;
      }
    };
  }, [map, leafletReady]);

  return null;
}
