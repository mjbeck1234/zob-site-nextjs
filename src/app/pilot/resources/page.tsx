import Link from 'next/link';

import PageShell from '@/components/PageShell';
import { PilotAirportsReferenceMap, PilotCenterSplitReferenceMaps } from '@/components/pilot/PilotResourceReferenceMaps';

export const dynamic = 'force-dynamic';

type BriefingLink = { id: string; label: string };

type AirportPoint = {
  icao: string;
  label: string;
  longName: string;
  classType: 'B' | 'C' | 'D';
  lon: number;
  lat: number;
};

const BRIEFING_LINKS: BriefingLink[] = [
  { id: 'welcome', label: 'Overview' },
  { id: 'airport-overview', label: 'Airport Overview' },
  { id: 'airport-weather', label: 'Airport Weather' },
  { id: 'center-splits', label: 'Center Splits' },
  { id: 'departure', label: 'Departure' },
  { id: 'clearances', label: 'Clearances' },
  { id: 'pushback-taxi', label: 'Pushback & Taxi' },
  { id: 'arrival', label: 'Arrival' },
  { id: 'descent', label: 'Descent' },
  { id: 'approach', label: 'Approach' },
];

const AIRPORTS: AirportPoint[] = [
  { icao: 'KDTW', label: 'DTW', longName: 'Detroit Metro', classType: 'B', lon: -83.3534, lat: 42.2124 },
  { icao: 'KCLE', label: 'CLE', longName: 'Cleveland Hopkins', classType: 'B', lon: -81.8498, lat: 41.4117 },
  { icao: 'KPIT', label: 'PIT', longName: 'Pittsburgh Intl', classType: 'B', lon: -80.2329, lat: 40.4915 },
  { icao: 'KBUF', label: 'BUF', longName: 'Buffalo Niagara', classType: 'C', lon: -78.7322, lat: 42.9405 },
  { icao: 'KCAK', label: 'CAK', longName: 'Akron-Canton', classType: 'C', lon: -81.4422, lat: 40.9161 },
  { icao: 'KFNT', label: 'FNT', longName: 'Bishop Intl', classType: 'C', lon: -83.7436, lat: 42.9654 },
  { icao: 'KLAN', label: 'LAN', longName: 'Capital Region', classType: 'C', lon: -84.5874, lat: 42.7787 },
  { icao: 'KROC', label: 'ROC', longName: 'Greater Rochester', classType: 'C', lon: -77.6724, lat: 43.1189 },
  { icao: 'KTOL', label: 'TOL', longName: 'Toledo Express', classType: 'C', lon: -83.8078, lat: 41.5868 },
  { icao: 'CYQG', label: 'YQG', longName: 'Windsor', classType: 'D', lon: -82.9556, lat: 42.2756 },
  { icao: 'KAGC', label: 'AGC', longName: 'Allegheny County', classType: 'D', lon: -79.9302, lat: 40.3544 },
  { icao: 'KARB', label: 'ARB', longName: 'Ann Arbor', classType: 'D', lon: -83.7456, lat: 42.2230 },
  { icao: 'KBKL', label: 'BKL', longName: 'Burke Lakefront', classType: 'D', lon: -81.6833, lat: 41.5175 },
  { icao: 'KBVI', label: 'BVI', longName: 'Beaver County', classType: 'D', lon: -80.3914, lat: 40.7725 },
  { icao: 'KCGF', label: 'CGF', longName: 'Cuyahoga County', classType: 'D', lon: -81.4864, lat: 41.5651 },
  { icao: 'KCKB', label: 'CKB', longName: 'North Central WV', classType: 'D', lon: -80.2281, lat: 39.2966 },
  { icao: 'KDET', label: 'DET', longName: 'Coleman A. Young', classType: 'D', lon: -83.0099, lat: 42.4092 },
  { icao: 'KERI', label: 'ERI', longName: 'Erie Intl', classType: 'D', lon: -80.1739, lat: 42.0831 },
  { icao: 'KHLG', label: 'HLG', longName: 'Wheeling', classType: 'D', lon: -80.6463, lat: 40.1750 },
  { icao: 'KIAG', label: 'IAG', longName: 'Niagara Falls', classType: 'D', lon: -78.9462, lat: 43.1073 },
  { icao: 'KJST', label: 'JST', longName: 'Johnstown', classType: 'D', lon: -78.8339, lat: 40.3161 },
  { icao: 'KJXN', label: 'JXN', longName: 'Jackson County', classType: 'D', lon: -84.4594, lat: 42.2598 },
  { icao: 'KLBE', label: 'LBE', longName: 'Arnold Palmer', classType: 'D', lon: -79.4048, lat: 40.2759 },
  { icao: 'KMBS', label: 'MBS', longName: 'Saginaw Intl', classType: 'D', lon: -84.0796, lat: 43.5329 },
  { icao: 'KMFD', label: 'MFD', longName: 'Mansfield Lahm', classType: 'D', lon: -82.5166, lat: 40.8214 },
  { icao: 'KMGW', label: 'MGW', longName: 'Morgantown', classType: 'D', lon: -79.9163, lat: 39.6429 },
  { icao: 'KMTC', label: 'MTC', longName: 'Selfridge ANGB', classType: 'D', lon: -82.8369, lat: 42.6135 },
  { icao: 'KPTK', label: 'PTK', longName: 'Oakland County', classType: 'D', lon: -83.4201, lat: 42.6655 },
  { icao: 'KYIP', label: 'YIP', longName: 'Willow Run', classType: 'D', lon: -83.5304, lat: 42.2379 },
  { icao: 'KYNG', label: 'YNG', longName: 'Youngstown-Warren', classType: 'D', lon: -80.6791, lat: 41.2607 },
];

function Card(props: { id?: string; title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section
      id={props.id}
      className={`scroll-mt-28 rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur ${props.className ?? ''}`.trim()}
    >
      <div className="text-lg font-semibold text-white">{props.title}</div>
      {props.subtitle ? <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/45">{props.subtitle}</div> : null}
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-white/75">{props.children}</div>
    </section>
  );
}

function DotList(props: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {props.items.map((item, idx) => (
        <li key={idx} className="flex gap-2">
          <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Callout(props: { kind?: 'info' | 'warn'; children: React.ReactNode }) {
  const tone =
    props.kind === 'warn'
      ? 'border-amber-300/20 bg-amber-300/[0.08] text-amber-100/90'
      : 'border-sky-300/20 bg-sky-300/[0.08] text-sky-100/90';
  return <div className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${tone}`}>{props.children}</div>;
}

function NavList() {
  return (
    <Card title="Briefing" subtitle="Jump to section" className="xl:sticky xl:top-24">
      <ul className="space-y-2 text-sm">
        {BRIEFING_LINKS.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} className="group flex items-center gap-2 rounded-xl px-2 py-1.5 text-white/75 transition hover:bg-white/[0.06] hover:text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 transition group-hover:scale-125" />
              <span>{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function PilotResourcesPage() {
  return (
    <PageShell
      title="Pilot • Resources"
      subtitle="The exact pilot briefing content from the old site, carried over into the new layout."
      crumbs={[{ href: '/', label: 'Home' }, { label: 'Pilot' }, { label: 'Resources' }]}
      actions={
        <>
          <Link href="/pilot/ramp" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/[0.14]">
            Ramp gate selection
          </Link>
          <Link href="/routing" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/[0.14]">
            Routing
          </Link>
          <Link href="/splits" className="text-xs font-semibold text-amber-200/90 hover:text-amber-200">
            Active splits
          </Link>
        </>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[0.28fr_0.72fr]">
        <NavList />

        <div className="space-y-4">
          <Card id="welcome" title="Welcome to ZOB" subtitle="Overview">
            <p>
              Welcome to the Virtual Cleveland ARTCC, one of the 20 contigious ARTCCs represented in VATUSA; alongside the Pacific Control Facility.
              We are the smallest en-route facility by area (89,000 Mi.<sup>2</sup>) but contain a great wealth of traffic as we provide sequencing to <b>six</b>{' '}
              adjacent ARTCCs and the Toronto FIR.
            </p>
            <p>
              At the Cleveland ARTCC we hold three Class Bravo airspaces which include: Detroit (KDTW), Cleveland (KCLE), and Pittsburgh (KPIT).
            </p>
            <p>
              We recommend that you check out our next chapter of the briefing to review some great options for departing and arriving within the Cleveland ARTCC.
              Our controllers appreciate any amount of traffic, and we personally invite you to fly out of our popular hubs, or not so-popular smaller controlled or uncontrolled fields.
            </p>
          </Card>

          <PilotAirportsReferenceMap airports={AIRPORTS} />

          <Card id="airport-overview" title="Airport Overview" subtitle="Overview">
              <p>
                Above you will find a map that contains markers that indicate all of the controlled airports that the Cleveland ARTCC offers within our airspace boundary.
                Each airport is signified by their Class of Airspace, and a key and amount relevant to the map can be found below:
              </p>
              <DotList
                items={[
                  <>Class <span className="font-semibold text-pink-300">Bravo</span> Field <b>(3)</b></>,
                  <>Class <span className="font-semibold text-blue-300">Charlie</span> Field <b>(6)</b></>,
                  <>Class <span className="font-semibold text-emerald-300">Delta</span> Field <b>(21)</b></>,
                ]}
              />
              <p>
                Our <b>most</b> popular airport at the Cleveland ARTCC by numbers is Detroit-Metropolitan Wayne County Airport; followed by Cleveland-Hopkins, Pittsburgh,
                and Buffalo Niagara airports.
              </p>
              <p>
                There are several TRACON facilities, and two RAPCON facilities in which the Cleveland ARTCC encompasses. There is a good quantity of fields to choose from within the Cleveland ARTCC airspace.
              </p>
            </Card>

          <PilotCenterSplitReferenceMaps />

          <Card id="center-splits" title="Center Splits" subtitle="Overview">
              <div className="space-y-3">
                <div>
                  <div className="font-semibold text-white/90">Low Splits</div>
                  <p className="mt-2">
                    Above you will find a map detailing our commonly-used <b>Low</b>-Center Splits. There are rare scenarios where we use all of these splits with extremely high-density traffic.
                    The primary Low Center sector is ZOB <b>04</b>. This sector takes control of all of the airspace when no High Sectors are present.
                  </p>
                  <p>
                    When High-Sector splits are present; all Low-Center sectors have an airspace from SFC-FL230 (excluding C33/C31/C70/C73 which own SFC-FL270). If you are departing through a field;
                    the Low-Center sectors will be responsible for your climbs, or any arrivals into fields via STARs, and descents through the flight level transition altitude into TRACON airspace.
                  </p>
                </div>
                <div className="h-px bg-white/10" />
                <div>
                  <div className="font-semibold text-white/90">High Splits</div>
                  <p className="mt-2">
                    Above you will find a map detailing our commonly-used <b>High</b>-Center Splits. (more sectors may be open on discretion of the TMU/CiC)
                    The scenarios where all high sector splits are utilized is usually in home, or adjacent ARTCC/FIR events where en-route support form the Cleveland ARTCC is required.
                  </p>
                  <p>
                    The primary High Center sector is ZOB <b>48</b>. This sector takes control of all of the high center airspace when no other sectors are present.
                    The high-center sectors primarily control all descending, and climbing airspace through FL240-FL600 (excluding C37/C36/C77 which own FL280-FL600); as well as all traffic inbound or outbound through our neighboring airspaces.
                  </p>
                </div>
              </div>
            </Card>

          <Card id="airport-weather" title="Airport Weather" subtitle="Overview">
            <p>
              On the existing briefing, this section showed live METAR snapshots by airport class. In the new site, you can use the home page&apos;s major-airport snapshot for live METAR + flight category,
              then come back here for the operational guidance below.
            </p>
            <DotList
              items={[
                'Always grab the latest ATIS or METAR before calling for clearance or taxi.',
                'Watch the landing direction / runway setup at the major Class Bravo fields.',
                'If ceilings or visibility are lower than expected, plan ahead for a full instrument departure or approach.',
              ]}
            />
            <Callout kind="info">
              Need a live look? Use the home page for the real-time major-airport weather snapshot, or verify directly in your EFB / simulator weather source before taxi.
            </Callout>
          </Card>

          <Card id="departure" title="Departure" subtitle="Overview">
            <p>
              When departing out of the Cleveland ARTCC airspace there is a variety of airports that are available to you. After you have read our <u>Overview</u> section of the Briefing you will have known that there are <b>four</b> main fields:
            </p>
            <DotList
              items={[
                'Detroit-Metropolitan Wayne County Airport (KDTW)',
                'Cleveland Hopkins International Airport (KCLE)',
                'Pittsburgh International Airport (KPIT)',
                'Buffalo Niagara International Airport (KBUF)',
              ]}
            />
            <p>
              Each of our four main fields support both verbal, and PDC (Pre-Departure Clearance) which are available for aircraft either by choice, or in heavy traffic situations.
              For verbal clearances you are required to readback your squawk code at minimum, and for amendments to the route, altitude, etc. you are required to readback the amended segment of your plan, and the squawk code.
            </p>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card id="clearances" title="Clearances" subtitle="Departure">
              <p>
                For PDCs you are required to initially contact the controller handling ground/ramp movements with your assigned SID, squawk code, and current ATIS information.
              </p>
              <p>
                If you are departing out of one of our four main fields you will be most likely be assigned an available Standard Instrument Departure. Planning ahead is key in high-traffic situations and we recommend you use tools such as{' '}
                <a href="https://simbrief.com/" target="_blank" rel="noreferrer" className="font-semibold text-amber-200/90 hover:text-amber-200">SimBrief</a>,{' '}
                <a href="https://flightaware.com/" target="_blank" rel="noreferrer" className="font-semibold text-amber-200/90 hover:text-amber-200">FlightAware</a>, or our facility{' '}
                <Link href="/routing" className="font-semibold text-amber-200/90 hover:text-amber-200">Routing</Link> page for preferred routing in our local airspace.
              </p>
              <Callout kind="info">
                <b>PRE-DEPARTURE CLEARANCE START</b> | 2322 Z | CALLSIGN: AAL1236 | EQUIP: B738/L | DEP: KDTW | ARR: KMCO | SQUAWK: 4332 | APPROVED ROUTE: CLVIN2 STAZE VXV ATL YUESS OTK PIGLT6 | FINAL ALT: 34000 | ALTITUDE RESTRICTIONS: CLIMB VIA SID | DEP FREQ: 126.220 PLAN RUNWAY 22L FOR DEPARTURE. CONTACT Metro Ground ON FREQ 121.800 FOR TAXI WITH ASSIGNED SID, SQUAWK CODE, AND CURRENT ATIS CODE ONLY. IF YOU HAVE ANY QUESTIONS OR ARE UNABLE TO ACCEPT ANY ASSIGNMENT, CONTACT ATC ON FREQUENCY 120.650 | <b>PRE-DEPARTURE CLEARANCE END</b>
              </Callout>
              <p>
                When spawning in at a gate you should always run through your checklists as expeditiously as possible, and request your clearance prior to pushing back from your terminal.
                Prior to requesting your IFR clearance: you should tune in to the ATIS frequency for your airport, or get your METARs through the internet or EFBs.
                When you have the current weather you shall contact the controller handling IFR clearances, and call in with your callsign, ATIS information or weather confirmation, and your intentions to pick up your IFR clearance. (and/or request for Pre-Departure Clearance)
              </p>
              <Callout kind="warn">
                <b>NOTE:</b> You should never pushback if you will end up in the movement area (taxiways) without approval from the controller handling ground movements at your specific airport.
              </Callout>
            </Card>

            <Card id="pushback-taxi" title="Pushback & Taxi" subtitle="Departure">
              <p>
                When you are ready for push and start you either are advised that push is approved at pilot&apos;s discretion, or to call for push and start.
                If your push has already been approved you may push at your discretion and call ready for taxi.
              </p>
              <p>
                If you are required to call for push and start approval: you must contact the controller handling ground/ramp movements, and advise you a ready for push and start.
                The controller handling ground/ramp movements shall give you a direction to face, or for your tail to turn towards, and approval to push onto a movement area, or a crowded ramp in heavy-traffic density scenarios.
              </p>
              <p>
                When you are ready to taxi to the runway for departure: you shall advise the controller handling ground movements that you are ready for taxi instructions, and advise that you have the weather or ATIS information.
                Your instructions will include a combination of taxiways, and possibly runway crossings.
              </p>
              <p>
                If you are told to hold short of a runway you shall read these instructions lastly, and include the taxiway you are holding short of the runway.
                Your controller will verbally hand you off to local control once nearing or reaching the runway.
              </p>
            </Card>
          </div>

          <Card id="arrival" title="Arrival" subtitle="Overview">
            <p>
              Once entering our en-route environment (refer to Overview) at the Cleveland ARTCC you will be issued a set of instructions by one of our center sectors for a variety of descent instructions into your arrival field.
              The following sections cover the two most common pieces of the arrival phase: the descent itself, and the approach setup you&apos;ll get from TRACON.
            </p>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card id="descent" title="Descent" subtitle="Arrival">
              <p>
                Once entering our en-route environment (refer to Overview) at the Cleveland ARTCC you will be issued a set of instructions by one of our center sectors for a variety of descent instructions into your arrival field.
                The following are examples of descent clearances into our four main fields:
              </p>
              <DotList
                items={[
                  <><b>DTW:</b> &quot;... <mark className="rounded bg-white/10 px-1 py-0.5 text-white">Descend Via</mark> the FERRL# arrival, the Metro <mark className="rounded bg-white/10 px-1 py-0.5 text-white">Altimeter</mark> 30.01.&quot;</>,
                  <><b>CLE:</b> &quot;... <mark className="rounded bg-white/10 px-1 py-0.5 text-white">Descend Via</mark> the ROKNN# arrival, the Cleveland <mark className="rounded bg-white/10 px-1 py-0.5 text-white">Altimeter</mark> 29.98, Cleveland <mark className="rounded bg-white/10 px-1 py-0.5 text-white">Landing</mark> South.&quot;</>,
                  <><b>PIT:</b> &quot;... <mark className="rounded bg-white/10 px-1 py-0.5 text-white">Cross</mark> CUTTA at and maintain 10,000, the Pittsburgh <mark className="rounded bg-white/10 px-1 py-0.5 text-white">Altimeter</mark> 29.97, Pittsburgh <mark className="rounded bg-white/10 px-1 py-0.5 text-white">Landing</mark> West.&quot;</>,
                  <><b>BUF:</b> &quot;... <mark className="rounded bg-white/10 px-1 py-0.5 text-white">Descend and Maintain</mark> 10,000, the Buffalo <mark className="rounded bg-white/10 px-1 py-0.5 text-white">Altimeter</mark> 30.03, Buffalo <mark className="rounded bg-white/10 px-1 py-0.5 text-white">Landing</mark> Runway 23.&quot;</>,
                ]}
              />
              <p>
                Above are several examples of different descent clearances that can be issued by the en-route controllers who have authority of the center sectors. Both Detroit Metro (DTW) and Cleveland (CLE) have RNAV Standard Terminal Arrival Routes (STARs) that are utilized by pilots for their descents via Optimized Profile Descent (OPD) that are described in both the chart, and through the Flight Management Computer (FMC).
              </p>
              <p>
                Aircraft on the OPDs will <i>most likely, if not always</i> be issued a &quot;...descend via...&quot; clearance which instructs the pilot to follow the defined altitude and speed restrictions until further notice.
                Aircraft on OPDs may likely be descended while on the RNAV STAR; which cancels the altitude restrictions, and is known as a &quot;hard&quot; altitude as depicted on the chart, but still requires that you fly the lateral portion of the arrival until otherwise vectored off this profile.
              </p>
              <Callout kind="warn">
                <b>NOTE:</b> Speed restrictions on STARs are absolutely mandatory unless authorized by ATC.
              </Callout>
              <p>
                Aircraft descending into Pittsburgh (PIT), Buffalo (BUF) or several of the other controlled or uncontrolled fields, you will be issued a different variety of other crossing restrictions, hard descents, or step-descents to set you up for your approach. If you are issued a crossing restriction you must meet the altitude at or before arriving at the fix laterally.
              </p>
              <Callout kind="warn">
                <b>NOTE:</b> You are not cleared to descend until ATC issues a clearance to either &quot;descend via&quot; a STAR, crossing restrictions, or other methods.
              </Callout>
              <p>Regardless of whether or not you are on a STAR: you will be issued an altimeter for your arrival field, and any other information that is vital to your approach.</p>
            </Card>

            <Card id="approach" title="Approach" subtitle="Arrival">
              <p>
                Upon entering the TRACON environment, or you are approaching your destination you will be issued an approach to expect. Below are examples of different types of approaches that may or may not be supported at your destination field.
              </p>
              <DotList
                items={[
                  <>Instrument Landing System (ILS) <b>*</b></>,
                  <>RNAV (GPS/RNP) <b>*</b></>,
                  'Localizer (LOC)',
                  'VOR',
                  <>Visual <b>*</b></>,
                ]}
              />
              <p>
                One or more of these examples are available at most controlled fields in the Cleveland ARTCC, and will be assigned upon entering or nearing the approach phase of your flight.
                You will be most likely vectored, or depending on your approach&apos;s descriptions: cleared to a fix/waypoint, and restrictions to cross the fix/waypoint at a certain altitude to join your approach.
              </p>
              <p>
                Once you are cleared for an approach you may presume the approach based off the charts, or your FMC&apos;s approach description, or based off visual reference per a &quot;Visual Approach&quot;.
                When nearing the runway you will be given clearance to land, and if required: your distance from traffic arriving on the runway, or advisory of traffic departing the field.
              </p>
              <p>
                <b>If absolutely required and safety is at risk:</b> you may be issued a go-around, or missed approach, and you will be issued instructions to climb out of the field, and vectored away from the field, or you will be advised to fly the missed approach procedure as filed for your specific approach which is described on the approach chart.
              </p>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/55">
                <b>*</b> These approaches will be utilized more frequently than others, and will be more openly available. Other approaches are available upon request and chart availability.
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
