/**
 * ZOB facility prefixes used to determine whether a VATSIM controller is working
 * within Cleveland ARTCC's area of responsibility.
 *
 * Each entry is a 4-character prefix (including trailing underscore), matching
 * the first 4 chars of a VATSIM controller callsign (e.g., "CLE_", "DTW_").
 */
export const ZOB_FACILITIES: string[] = [
  // ARTCC / enroute (some configurations may use ZOB_*)
  'ZOB_',

  // Major TRACON / airports
  'CLE_',
  'DTW_',
  'PIT_',
  'BUF_',

  // Terminals within ZOB
  'ARB_',
  'YIP_',
  'DET_',
  'PTK_',
  'BVI_',
  'AGC_',
  'HLG_',
  'BKL_',
  'CGF_',
  'CAK_',
  'MFD_',
  'IAG_',
  'ERI_',
  'FNT_',
  'JXN_',
  'MBS_',
  'LAN_',
  'TOL_',
  'CKB_',
  'MGW_',
  'ROC_',
  'JST_',
  'LBE_',
  'MTC_',
  'YNG_',
  'YQG_',
];
