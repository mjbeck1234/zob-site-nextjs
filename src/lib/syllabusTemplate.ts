export type SyllabusItemTemplate = {
  id: string;
  title: string;
  description?: string;
};

export type SyllabusSectionTemplate = {
  id: string;
  title: string;
  items: SyllabusItemTemplate[];
};

export type SyllabusTrackTemplate = {
  id: string;
  title: string;
  sections: SyllabusSectionTemplate[];
};

/**
 * Baseline syllabus templates.
 *
 * This intentionally starts simple and mirrors common ZOB training progressions.
 * You can edit this file to match the old site's exact checklist wording.
 */
export const SYLLABUS_TEMPLATES: SyllabusTrackTemplate[] = [
  {
    id: 's1',
    title: 'S1 — OBS / Ground Basics',
    sections: [
      {
        id: 'onboarding',
        title: 'Onboarding',
        items: [
          { id: 's1_onboarding_cbts', title: 'Onboarding CBTs completed' },
          { id: 's1_cdel_cbts', title: 'Clearance Delivery CBTs completed' },
          { id: 's1_intro', title: 'Intro / expectations reviewed with mentor' },
        ],
      },
      {
        id: 'exams',
        title: 'Knowledge checks',
        items: [
          { id: 's1_entrance_exam', title: 'Entrance exam passed' },
          { id: 's1_obs_s1_exam', title: 'OBS–S1 knowledge check passed' },
        ],
      },
      {
        id: 'sessions',
        title: 'Sessions',
        items: [
          { id: 's1_session_obs', title: 'OBS session completed' },
          { id: 's1_session_gnd1', title: 'Ground Session 1 completed' },
          { id: 's1_session_gnd2', title: 'Ground Session 2 completed' },
        ],
      },
    ],
  },
  {
    id: 's2',
    title: 'S2 — Tower',
    sections: [
      {
        id: 'departures',
        title: 'Departures',
        items: [
          { id: 's2_departure_fundamentals', title: 'Departure fundamentals' },
          { id: 's2_takeoff_clearance', title: 'Takeoff clearance foundation' },
          { id: 's2_luaw', title: 'Line up and wait (LUAW)' },
          { id: 's2_vfr_departures', title: 'VFR departure / pattern takeoff clearances' },
          { id: 's2_heli_departures', title: 'Helicopter departure instructions' },
          { id: 's2_heading_instructions', title: 'Heading instructions' },
        ],
      },
      {
        id: 'arrivals',
        title: 'Arrivals',
        items: [
          { id: 's2_arrival_fundamentals', title: 'Arrival fundamentals' },
          { id: 's2_landing_clearances', title: 'Landing clearances' },
          { id: 's2_crossing_runways', title: 'Crossing runways' },
          { id: 's2_missed_approaches', title: 'Missed approaches' },
          { id: 's2_intrail_advisories', title: 'Arriving traffic / in-trail advisories' },
          { id: 's2_heli_arrivals', title: 'Helicopter arrival instructions' },
        ],
      },
      {
        id: 'coordination',
        title: 'Coordination and setup',
        items: [
          { id: 's2_active_runway', title: 'Selection of active runway' },
          { id: 's2_atis', title: 'ATIS issuance and content' },
          { id: 's2_runway_crossings', title: 'Runway crossing coordination' },
        ],
      },
    ],
  },
  {
    id: 's3',
    title: 'S3 — Approach / Departure',
    sections: [
      {
        id: 'radar',
        title: 'Radar fundamentals',
        items: [
          { id: 's3_radar_id', title: 'Radar identification / verification' },
          { id: 's3_vectoring', title: 'Vectoring and headings' },
          { id: 's3_speed_control', title: 'Speed control / flow management' },
        ],
      },
      {
        id: 'sequencing',
        title: 'Arrivals and departures',
        items: [
          { id: 's3_departure_sequencing', title: 'Departure sequencing / climbs' },
          { id: 's3_arrival_sequencing', title: 'Arrival sequencing / merges' },
          { id: 's3_stars_sids', title: 'STAR/SID usage and amendments' },
          { id: 's3_holds', title: 'Holding (as applicable)' },
          { id: 's3_missed', title: 'Missed approach handling and resequencing' },
        ],
      },
      {
        id: 'coord',
        title: 'Coordination',
        items: [
          { id: 's3_pointouts', title: 'Pointouts and handoffs' },
          { id: 's3_loa', title: 'LOA / SOP adherence' },
          { id: 's3_emergencies', title: 'Emergencies / priority handling' },
        ],
      },
    ],
  },
];

export function allSyllabusItemIds(): string[] {
  const out: string[] = [];
  for (const t of SYLLABUS_TEMPLATES) {
    for (const s of t.sections) {
      for (const i of s.items) out.push(i.id);
    }
  }
  return out;
}
