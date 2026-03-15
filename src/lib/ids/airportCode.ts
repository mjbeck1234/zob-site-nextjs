export type AirportCodeMatch = {
  input: string;
  icao?: string;
  faa?: string;
  candidates: string[];
};

export function airportCodeCandidates(input?: string | null): string[] {
  const raw = String(input ?? '').trim().toUpperCase();
  if (!raw) return [];

  const out = new Set<string>();
  out.add(raw);

  // Common ICAO-to-3-letter mappings
  if (raw.length === 4) {
    if (raw.startsWith('K') || raw.startsWith('C')) {
      out.add(raw.slice(1));
    }
  }

  return [...out];
}

export function preferShortAirportCode(input?: string | null): string {
  const candidates = airportCodeCandidates(input);
  return candidates.find((c) => c.length === 3) ?? candidates[0] ?? '';
}

// Heuristic: derive both ICAO and 3-letter token when possible.
export function bestAirportCodeMatch(input?: string | null): AirportCodeMatch {
  const raw = String(input ?? '').trim().toUpperCase();
  const candidates = airportCodeCandidates(raw);

  let icao: string | undefined;
  let faa: string | undefined;

  if (raw.length === 4) {
    icao = raw;
    if (raw.startsWith('K') || raw.startsWith('C')) faa = raw.slice(1);
  } else if (raw.length === 3) {
    faa = raw;
    // Most ZOB use-cases are US (Kxxx). For common Canadian 3-letter codes (Yxx), guess Cxxx.
    icao = raw.startsWith('Y') ? `C${raw}` : `K${raw}`;
  } else {
    // Fallback: prefer a 3-letter token when present.
    const short = candidates.find((c) => c.length === 3);
    if (short) {
      faa = short;
      icao = short.startsWith('Y') ? `C${short}` : `K${short}`;
    }
  }

  return { input: raw, icao, faa, candidates };
}
