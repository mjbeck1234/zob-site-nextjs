// IMPORTANT: This is NOT a Server Actions module.
// It may export constants and helpers used by roster pages.

export const ROLE_HELP = {
  staff: [
    { code: 'MTR', label: 'Mentor (MTR)' },
    { code: 'INS', label: 'Instructor (INS)' },
    { code: 'EC', label: 'Events Coordinator (EC)' },
    { code: 'AEC', label: 'Assistant Events Coordinator (AEC)' },
    { code: 'ACE', label: 'Assistant Events Coordinator (ACE)' },
    { code: 'FE', label: 'Facility Engineer (FE)' },
    { code: 'AFE', label: 'Assistant Facility Engineer (AFE)' },
    { code: 'WT', label: 'Web Team (WT)' },
    { code: 'AWM', label: 'Assistant Webmaster (AWM)' },
  ],
  senior: [
    { code: 'TA', label: 'Training Administrator (TA)' },
    { code: 'ADATM', label: 'Assistant Deputy ATM (ADATM)' },
    { code: 'DATM', label: 'Deputy ATM (DATM)' },
  ],
  admin: [
    { code: 'ATM', label: 'ATM (ATM)' },
    { code: 'WM', label: 'Webmaster (WM)' },
  ],
} as const;
