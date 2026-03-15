function toStr(v: any): string {
  if (v === null || v === undefined) return '';
  return typeof v === 'string' ? v : String(v);
}

function canonToken(s: string): string {
  // Normalize for comparisons only (do not use for display).
  // Removes punctuation and collapses to alnum to match cases like O'Neill vs Oneill.
  return toStr(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Build a display name from roster-ish rows.
 *
 * Why this exists:
 * - Some rows store pref_name as a full name (e.g. "Mike Scott") rather than just a preferred first name.
 * - If we blindly do "${pref_name} ${last_name}", we end up with "Mike Scott Scott".
 */
export function rosterDisplayName(r: any): string {
  const pref = toStr(r?.pref_name ?? r?.prefName ?? r?.preferred_name ?? r?.preferredName).trim();
  const first = (pref || toStr(r?.first_name ?? r?.firstName)).trim();
  const last = toStr(r?.last_name ?? r?.lastName).trim();

  const fallback = toStr(r?.name).trim();
  if (!first && !last) return fallback || '—';
  if (!last) return first || fallback || '—';
  if (!first) return last || fallback || '—';

  // If "first" already ends with the last name, don't append it again.
  const firstTokens = first.split(/\s+/).filter(Boolean);
  const lastCanon = canonToken(last);
  const lastTokenCanon = canonToken(firstTokens[firstTokens.length - 1] ?? '');
  if (lastCanon && lastTokenCanon === lastCanon) return first;

  return `${first} ${last}`.trim();
}
