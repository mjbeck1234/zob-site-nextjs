// Shared split-sector groupings (existing ZOB sets).
// Used by split maps + split creation UI.

export const HIGH_SECTORS = new Set<string>([
  "ZOB07",
  "ZOB18",
  "ZOB27",
  "ZOB28",
  "ZOB36",
  "ZOB37",
  "ZOB48",
  "ZOB57",
  "ZOB66",
  "ZOB67",
  "ZOB77"
]);

export const LOW_SECTORS = new Set<string>([
  "ZOB02",
  "ZOB03",
  "ZOB04",
  "ZOB06",
  "ZOB08",
  "ZOB12",
  "ZOB14",
  "ZOB15",
  "ZOB16",
  "ZOB20",
  "ZOB21",
  "ZOB31",
  "ZOB33",
  "ZOB50",
  "ZOB53",
  "ZOB55",
  "ZOB70",
  "ZOB73",
  "ZOB75"
]);

export type SplitType = 'high' | 'low' | 'other';

export function normSplitType(t: unknown): SplitType {
  const v = String(t ?? '').toLowerCase().trim();
  if (v.startsWith('h')) return 'high';
  if (v.startsWith('l')) return 'low';
  return 'other';
}

export function sectorSetForType(t: unknown): Set<string> {
  const tt = normSplitType(t);
  if (tt === 'high') return HIGH_SECTORS;
  if (tt === 'low') return LOW_SECTORS;
  return new Set<string>([...HIGH_SECTORS, ...LOW_SECTORS]);
}
