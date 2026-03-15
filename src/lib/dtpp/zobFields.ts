// ZOB towered fields list (from FEBUDDY header). Airports outside this list
// will fall back to the FAA d-TPP results page instead of direct PDF links.

export const ZOB_TOWERED_FIELDS = new Set(
  [
    "KAGC",
    "KARB",
    "KBKL",
    "KBUF",
    "KBVI",
    "KCAK",
    "KCGF",
    "KCKB",
    "KCLE",
    "KDET",
    "KDTW",
    "KERI",
    "KFNT",
    "KHLG",
    "KIAG",
    "KJST",
    "KJXN",
    "KLAN",
    "KLBE",
    "KMBS",
    "KMFD",
    "KMGW",
    "KMTC",
    "KPIT",
    "KPTK",
    "KROC",
    "KTOL",
    "KYIP",
    "KYNG",
  ].map((s) => s.toUpperCase())
);

export function normalizeAirportCode(input: string): string {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/**
 * Convert an ICAO (KCLE) or FAA ident (CLE) to FAA ident.
 * This is intentionally conservative: we only auto-strip the leading K.
 */
export function toFaaIdent(icaoOrIdent: string): string {
  const s = normalizeAirportCode(icaoOrIdent);
  if (s.length === 4 && s.startsWith("K")) return s.slice(1);
  return s;
}

/**
 * Convert an FAA ident (CLE) or ICAO to ICAO where possible.
 * For US 3-letter idents, we assume K-prefixed ICAO.
 */
export function toIcaoCode(icaoOrIdent: string): string {
  const s = normalizeAirportCode(icaoOrIdent);
  if (s.length === 3) return `K${s}`;
  return s;
}
