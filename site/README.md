# Cleveland ARTCC ZOB Website

Modern Next.js rewrite of the Cleveland ARTCC site, built around a MySQL/MariaDB backend and tailored for ZOB operations, training, events, roster tools, pilot resources, IDS/navdata tools, and controller utilities.

## What this project includes

- Public site pages for roster, events, downloads, staffing, feedback, pilot resources, LOA/routing, notices, and learning content
- Controller-facing IDS tools and map-based utilities
- Training features such as syllabi, CBTs, exams, lesson plans, and training tickets
- Admin tools for managing events, downloads, roster data, notices, flight data practice, IDS/navdata, ramp overrides, splits, and learning content
- Pilot features including ramp tools and pilot resources
- Legacy-compatible controller statistics using the `stats` table

## Tech stack

- Next.js 16
- React
- TypeScript
- Tailwind CSS
- Radix UI primitives in selected UI components
- Leaflet for maps
- `mysql2` for database access
- `iron-session` for session handling

## Requirements

- Node.js 20.9+
- npm
- MySQL or MariaDB

## Quick start

```bash
npm install
cp .env.example .env
# edit .env
npm run dev
```

Open `http://localhost:3000`.

## Build and run

```bash
npm run build
npm run start
```

## Environment variables

At minimum:

```env
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DBNAME
AUTH_SECRET=replace-with-a-long-random-string
```

Common optional variables:

```env
DB_POOL_SIZE=10
DATABASE_SSL=false

VATSIM_CLIENT_ID=
VATSIM_CLIENT_SECRET=
VATSIM_REDIRECT_URI=http://localhost:3000/api/auth/callback

SCHEDDY_API_MASTER_KEY=

DOWNLOADS_SITE_BASE_URL=
DOWNLOADS_ARCHIVE_URL=
```

### Development auth bypass

Useful for local testing when you do not want to go through OAuth.

Example:

```env
AUTH_BYPASS=true
AUTH_BYPASS_CID=1892512
AUTH_BYPASS_FIRST_NAME=Matthew
AUTH_BYPASS_LAST_NAME=Beck
AUTH_BYPASS_RATING=S3
AUTH_BYPASS_ROLES=admin
```

You can also use a pilot-only test session by setting:

```env
AUTH_BYPASS_ROLES=pilot
```

## Database notes

This project works against an existing ZOB-style legacy schema and can also create missing app tables for newer features.

## Useful scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run db:setup
npm run db:setup:dump
npm run ids:validate
npm run qa:smoke
```

## IDS / navdata

The project includes IDS/navdata support for airports, fixes, navaids, procedures, routes, and map rendering.

Relevant areas:

- `src/app/ids`
- `src/app/api/ids`
- `src/lib/ids*`
- `src/lib/nasr`
- `src/lib/navdata`
- `src/data/jsons`

Typical workflow:

1. import or refresh navdata / NASR data
2. validate with `npm run ids:validate`
3. test airport quick look, procedures, and map rendering in the IDS UI

## Project structure

```text
src/
  app/
    admin/                  Admin pages and tools
    api/                    Route handlers / APIs
    ids/                    IDS UI
    learning/               CBTs, syllabus, flight data practice
    pilot/                  Pilot pages and ramp tools
    roster/                 Roster and stats pages
  components/
    admin/
    home/
    map/
    pilot/
    query/
    training/
    ui/
  lib/
    auth/                   Session/auth helpers
    content/                Content loaders
    ids/ nasr/ navdata/     IDS and navdata logic
    splits/                 Split/state helpers
  data/
    jsons/                  Static and imported JSON data
scripts/
  db-setup.mjs
  ids-validate.mjs
  smoke-check.mjs
sql/
  create/alter scripts for feature tables
```

## Main feature areas

### Public-facing

- Home dashboard
- Roster
- Events
- Downloads
- Staffing and splits
- Feedback
- LOA and routing
- Pilot resources
- Notices
- Privacy/login/profile pages

### Training

- Syllabus
- CBTs
- Exams and corrections
- Lesson plans
- Training tickets
- Flight Data Practice

### Admin

- Roster management
- Event management
- Downloads management
- Notices
- Learning content
- IDS data/status tools
- Ramp overrides
- Splits and staffing tools
- Flight Data Practice case management

## Local development tips

### If build fails on missing tables

Some pages query optional tables. If your local database is partial, either:

- run `npm run db:setup`, or
- add a guard in the affected query path so missing tables fail gracefully

### If auth-related pages force dynamic rendering

Because the navbar/session helpers use cookies, app routes that render the navbar are request-aware. In practice, that means some layouts/pages should be treated as dynamic rather than statically exported.

### If Radix UI packages are missing

Install the packages actually referenced by the UI wrappers in `src/components/ui`.

## Deployment notes

- Set a strong `AUTH_SECRET`
- Set production VATSIM OAuth callback URLs correctly
- Point `DATABASE_URL` at production MySQL/MariaDB
- Run `npm run build`
- Start with `npm run start`
- Ensure any required legacy tables already exist in production if you rely on old site data

## Removed from this project

The following are intentionally not part of the current codebase direction:

- Prisma
- Wiki feature set
- monthly controller stats tables such as `stats_monthly` or `controller_time_monthly`

## Recommended next cleanup items

- keep `.env.example` aligned with the current feature set
- remove any dead SQL files no longer used by the active schema
- document navdata import/update steps more explicitly if multiple operators will maintain the site

