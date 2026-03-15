import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function requireFile(rel, label = rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) failures.push(`Missing ${label}: ${rel}`);
}

function requireIncludes(rel, needle, label) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing file for content check: ${rel}`);
    return;
  }

  const text = fs.readFileSync(full, 'utf8');
  if (!text.includes(needle)) {
    failures.push(`Expected ${label} in ${rel}`);
  }
}

function requireExcludes(rel, needle, label) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing file for content check: ${rel}`);
    return;
  }

  const text = fs.readFileSync(full, 'utf8');
  if (text.includes(needle)) {
    failures.push(`Unexpected ${label} in ${rel}`);
  }
}

[
  'src/app/page.tsx',
  'src/app/login/page.tsx',
  'src/app/loading.tsx',
  'src/app/error.tsx',
  'src/app/not-found.tsx',
  'src/app/pilot/resources/page.tsx',
  'src/app/pilot/resources/loading.tsx',
  'src/app/pilot/resources/error.tsx',
  'src/app/events/[id]/page.tsx',
  'src/app/events/[id]/loading.tsx',
  'src/app/events/[id]/error.tsx',
  'src/app/events/[id]/not-found.tsx',
  'src/app/ids/page.tsx',
  'src/app/ids/loading.tsx',
  'src/app/ids/error.tsx',
  'src/app/learning/page.tsx',
  'src/app/learning/loading.tsx',
  'src/app/learning/error.tsx',
  'src/app/robots.ts',
  'src/app/sitemap.ts',
  'src/app/api/auth/login/route.ts',
  'src/app/api/ids/controllers/route.ts',
  'src/app/api/ids/ramp/occupancy/route.ts',
  'src/components/route-fallbacks/RouteStateCard.tsx',
  'public/boundaries.geojson',
  'public/maps/zob_sectors.geojson',
  'public/logo.png',
  'public/favicon.ico',
].forEach((rel) => requireFile(rel));

requireIncludes('src/app/events/[id]/page.tsx', '/api/auth/login?next=', 'event login redirect');
requireIncludes('src/components/splits/SplitsMaps.tsx', '/maps/zob_sectors.geojson', 'canonical split map path');
requireExcludes('src/components/splits/SplitsMaps.tsx', 'zob-sectors.geojson', 'existing split filename reference');
requireIncludes('package.json', 'qa:smoke', 'smoke-check npm script');

if (failures.length) {
  console.error('Smoke check failed.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Smoke check passed.');
