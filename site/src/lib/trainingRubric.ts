import * as React from 'react';

export type RubricItem = {
  key: string;
  label: string;
};

export type RubricCategory = {
  key: string;
  title: string;
  items: RubricItem[];
};

// NOTE: Added `not_assessed` so mentors can explicitly mark categories not evaluated.
export type RubricRating = 'not_assessed' | 'satisfactory' | 'needs_improvement' | 'unsatisfactory';

export type RubricRatings = Record<string, RubricRating>;
export type RubricChecks = Record<string, string[]>; // categoryKey -> item keys

export const TRAINING_RUBRIC: RubricCategory[] = [
  {
    key: 'weather',
    title: 'Weather',
    items: [{ key: 'wx_observed', label: 'Issued observed/reported weather information.' }],
  },
  {
    key: 'separation',
    title: 'Separation',
    items: [{ key: 'sep_ensured', label: 'Separation was ensured.' }],
  },
  {
    key: 'coordination',
    title: 'Coordination',
    items: [
      { key: 'coord_handoff', label: 'Initiated/completed the handoff/pointout process in a timely manner.' },
      { key: 'coord_required', label: 'Required coordination was performed (including APREQs).' },
    ],
  },
  {
    key: 'control_judgement',
    title: 'Control judgement',
    items: [
      { key: 'cj_good', label: 'Good control judgement was applied (including correct speed/vectoring/sequencing).' },
      { key: 'cj_priority', label: 'Priority of duties was understood and situational awareness was maintained.' },
      { key: 'cj_positive', label: 'Positive control was provided in all situations including stressful or overloaded scenarios.' },
      { key: 'cj_flow', label: 'Effective traffic flow was maintained.' },
    ],
  },
  {
    key: 'methods_procedures',
    title: 'Methods and procedures',
    items: [
      {
        key: 'mp_id',
        label:
          'Aircraft identification was maintained (including through the application of radar display or VFR tower scenarios).',
      },
      { key: 'mp_sops', label: 'LOAs and facility directives (SOPs) were adhered to, for most, if not all, scenarios.' },
      { key: 'mp_services', label: 'Additional services were provided as applicable in the problem.' },
      {
        key: 'mp_scan',
        label:
          'Controller scanned the control environment (including radar displays, runways, active movement areas, and adjacent sectors).',
      },
      { key: 'mp_speed', label: 'Effective working speed was maintained.' },
    ],
  },
  {
    key: 'communication',
    title: 'Communication',
    items: [
      { key: 'comms_clear', label: 'Communication was clear and concise.' },
      { key: 'comms_7110', label: 'Prescribed phraseology per the FAA 7110.65 was utilized.' },
      { key: 'comms_necessary', label: 'Made only necessary transmissions in coordination and controlling.' },
      { key: 'comms_relief', label: 'Relief briefings were complete and accurate.' },
    ],
  },
];

export const RUBRIC_RATING_OPTIONS: { value: RubricRating; label: string }[] = [
  { value: 'not_assessed', label: 'Not assessed' },
  { value: 'satisfactory', label: 'Satisfactory' },
  { value: 'needs_improvement', label: 'Needs improvement' },
  { value: 'unsatisfactory', label: 'Unsatisfactory' },
];

export function normalizeRubricRating(input: unknown): RubricRating {
  const v = String(input ?? '').toLowerCase().trim();
  if (!v) return 'not_assessed';
  if (v === 'not_assessed' || v === 'not assessed' || v === 'na' || v === 'n/a') return 'not_assessed';
  if (v === 'needs_improvement' || v === 'needs improvement') return 'needs_improvement';
  if (v === 'unsatisfactory') return 'unsatisfactory';
  return 'satisfactory';
}

export function defaultRubricRatings(): RubricRatings {
  const r: RubricRatings = {};
  for (const c of TRAINING_RUBRIC) r[c.key] = 'not_assessed';
  return r;
}

export function defaultRubricChecks(): RubricChecks {
  const c: RubricChecks = {};
  for (const cat of TRAINING_RUBRIC) c[cat.key] = [];
  return c;
}

export function ratingLabel(rating: RubricRating): string {
  switch (rating) {
    case 'not_assessed':
      return 'Not assessed';
    case 'satisfactory':
      return 'Satisfactory';
    case 'needs_improvement':
      return 'Needs improvement';
    case 'unsatisfactory':
      return 'Unsatisfactory';
  }
}

export function badgeClass(rating: RubricRating): string {
  // Keep these subtle so they fit the dark theme.
  switch (rating) {
    case 'not_assessed':
      return 'bg-white/10 text-white/70 border-white/10';
    case 'satisfactory':
      return 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20';
    case 'needs_improvement':
      return 'bg-amber-500/10 text-amber-200 border-amber-500/20';
    case 'unsatisfactory':
      return 'bg-rose-500/10 text-rose-200 border-rose-500/20';
  }
}

// NOTE: This file is intentionally `.ts` (not `.tsx`) so it can be safely imported
// from server-only modules (e.g., Server Actions) without JSX parsing issues.
export const RubricBadge: React.FC<{ rating: RubricRating } & React.HTMLAttributes<HTMLSpanElement>> = ({
  rating,
  className,
  ...props
}) => {
  const cls = `inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${badgeClass(rating)} ${
    className ?? ''
  }`;
  return React.createElement('span', { ...props, className: cls }, ratingLabel(rating));
};
