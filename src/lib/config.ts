/**
 * Site/runtime configuration constants.
 *
 * Keep this file dependency-light so it can be imported from Server Components
 * without pulling in heavier modules.
 */

/**
 * Primary facility code for this site (e.g. ZOB).
 *
 * Preference order:
 *  - NEXT_PUBLIC_FACILITY_CODE (if you want it available client-side)
 *  - FACILITY_CODE
 *  - default 'ZOB'
 */
export const FACILITY: string = (
  process.env.NEXT_PUBLIC_FACILITY_CODE ||
  process.env.FACILITY_CODE ||
  'ZOB'
)
  .trim()
  .toUpperCase();
