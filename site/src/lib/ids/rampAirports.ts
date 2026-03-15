export type RampAirportConfig = {
  icao: string;
  iata?: string;
  // Bounding box used for Overpass + aircraft filtering
  bbox: { south: number; west: number; north: number; east: number };
  // Fallback center (if OSM returns no stands)
  center: { lat: number; lon: number };
  // Snap radius (meters) to consider a gate occupied
  snapMeters: number;
};

/**
 * Ramp-capable airports. Add more here as you expand the ramp feature beyond KDTW.
 */
export const RAMP_AIRPORTS: Record<string, RampAirportConfig> = {
  KDTW: {
    icao: 'KDTW',
    iata: 'DTW',
    // DTW is big; give a generous box around the field.
    bbox: { south: 42.16, west: -83.55, north: 42.28, east: -83.20 },
    center: { lat: 42.2124, lon: -83.3534 },
    snapMeters: 70,
  },
};
