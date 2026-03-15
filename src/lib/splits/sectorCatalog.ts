// Sector metadata (area + friendly names) copied from the existing ZOB splits page.
// Used to organize sector checkboxes by "Area X" and improve search (e.g. "area 2").

export type SectorLevel = 'high' | 'low';

export type SectorMeta = {
  code: string; // e.g. ZOB27
  area: number; // 1..8
  name: string; // e.g. Hudson
  level: SectorLevel;
  label: string; // e.g. "Hudson 27 (HI)"
};

export const SECTOR_CATALOG: SectorMeta[] = [
  // Area 1
  { code: 'ZOB18', area: 1, name: 'Peck', level: 'high', label: 'Peck 18 (HI)' },
  { code: 'ZOB12', area: 1, name: 'Lansing', level: 'low', label: 'Lansing 12 (LO)' },
  { code: 'ZOB14', area: 1, name: 'Jackson', level: 'low', label: 'Jackson 14 (LO)' },
  { code: 'ZOB15', area: 1, name: 'Litchfield', level: 'low', label: 'Litchfield 15 (LO)' },
  { code: 'ZOB16', area: 1, name: 'Flint', level: 'low', label: 'Flint 16 (LO)' },

  // Area 2
  { code: 'ZOB28', area: 2, name: 'Detroit', level: 'high', label: 'Detroit 28 (HI)' },
  { code: 'ZOB27', area: 2, name: 'Hudson', level: 'high', label: 'Hudson 27 (HI)' },
  { code: 'ZOB21', area: 2, name: 'Windsor', level: 'low', label: 'Windsor 21 (LO)' },
  { code: 'ZOB20', area: 2, name: 'Dresden', level: 'low', label: 'Dresden 20 (LO)' },

  // Area 3
  { code: 'ZOB37', area: 3, name: 'Geneseo', level: 'high', label: 'Geneseo 37 (HI)' },
  { code: 'ZOB36', area: 3, name: 'Dansville', level: 'high', label: 'Dansville 36 (HI)' },
  { code: 'ZOB33', area: 3, name: 'Buffalo', level: 'low', label: 'Buffalo 33 (LO)' },
  { code: 'ZOB31', area: 3, name: 'Rochester', level: 'low', label: 'Rochester 31 (LO)' },

  // Area 4
  { code: 'ZOB48', area: 4, name: 'Ravenna', level: 'high', label: 'Ravenna 48 (HI)' },

  // Area 5
  { code: 'ZOB57', area: 5, name: 'Brecksville', level: 'high', label: 'Brecksville 57 (HI)' },
  { code: 'ZOB53', area: 5, name: 'Indianhead', level: 'low', label: 'Indianhead 53 (LO)' },
  { code: 'ZOB50', area: 5, name: 'Clarion', level: 'low', label: 'Clarion 50 (LO)' },
  { code: 'ZOB55', area: 5, name: 'Morgantown', level: 'low', label: 'Morgantown 55 (LO)' },

  // Area 6
  { code: 'ZOB66', area: 6, name: 'Bellaire', level: 'high', label: 'Bellaire 66 (HI)' },
  { code: 'ZOB67', area: 6, name: 'Imperial', level: 'high', label: 'Imperial 67 (HI)' },

  // Area 7
  { code: 'ZOB77', area: 7, name: 'Warren', level: 'high', label: 'Warren 77 (HI)' },
  { code: 'ZOB70', area: 7, name: 'Dunkirk', level: 'low', label: 'Dunkirk 70 (LO)' },
  { code: 'ZOB73', area: 7, name: 'Bradford', level: 'low', label: 'Bradford 73 (LO)' },
  { code: 'ZOB75', area: 7, name: 'Youngstown', level: 'low', label: 'Youngstown 75 (LO)' },

  // Area 8
  { code: 'ZOB07', area: 8, name: 'Sandusky', level: 'high', label: 'Sandusky 07 (HI)' },
  { code: 'ZOB02', area: 8, name: 'Pandora', level: 'low', label: 'Pandora 02 (LO)' },
  { code: 'ZOB03', area: 8, name: 'Marion', level: 'low', label: 'Marion 03 (LO)' },
  { code: 'ZOB04', area: 8, name: 'Mansfield', level: 'low', label: 'Mansfield 04 (LO)' },
  { code: 'ZOB06', area: 8, name: 'Briggs', level: 'low', label: 'Briggs 06 (LO)' },
  { code: 'ZOB08', area: 8, name: 'Carleton', level: 'low', label: 'Carleton 08 (LO)' },
];

export const SECTOR_META_BY_CODE: Record<string, SectorMeta> = Object.fromEntries(
  SECTOR_CATALOG.map((m) => [m.code.toUpperCase(), m])
);

export const AREAS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function getSectorMeta(code: string): SectorMeta | null {
  const k = String(code ?? '').trim().toUpperCase();
  return SECTOR_META_BY_CODE[k] ?? null;
}
