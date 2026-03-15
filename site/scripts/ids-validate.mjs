import fs from "fs";
import path from "path";

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function readJson(p) {
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

function pickLatestCycleDir(root) {
  if (!exists(root)) return null;
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const cycles = entries
    .filter((d) => d.isDirectory() && /^\d{4}$/.test(d.name))
    .map((d) => d.name)
    .sort();
  return cycles.length ? cycles[cycles.length - 1] : null;
}

const envDir = process.env.IDS_DATA_DIR;
const root = envDir ? path.resolve(envDir) : path.join(process.cwd(), "src", "data", "jsons");
const cycle = process.env.IDS_DATA_CYCLE || pickLatestCycleDir(root);
const base = cycle && exists(path.join(root, cycle)) ? path.join(root, cycle) : root;

const checks = [
  { rel: "static/ids.routes.json", expect: "array" },
  { rel: "static/ids.enroute.json", expect: "array" },
  { rel: "static/ids.crossings.json", expect: "array" },
  { rel: "static/waypoints.json", expect: "array" },
  // Useful optional extras
  { rel: "apt.json", expect: "array", optional: true },
  { rel: "sid.json", expect: "array", optional: true },
  { rel: "star.json", expect: "array", optional: true },
  { rel: "faa.json", expect: "array", optional: true },
];

let ok = true;
console.log(`IDS validate: base=${base}`);

for (const c of checks) {
  const full = path.join(base, c.rel);
  if (!exists(full)) {
    if (c.optional) {
      console.log(`- [SKIP] missing optional ${c.rel}`);
      continue;
    }
    ok = false;
    console.error(`- [FAIL] missing ${c.rel}`);
    continue;
  }
  try {
    const data = readJson(full);
    const type = Array.isArray(data) ? "array" : data && typeof data === "object" ? "object" : typeof data;
    if (type !== c.expect) {
      ok = false;
      console.error(`- [FAIL] ${c.rel}: expected ${c.expect}, got ${type}`);
      continue;
    }
    const size = fs.statSync(full).size;
    const count = Array.isArray(data) ? data.length : Object.keys(data || {}).length;
    console.log(`- [OK]   ${c.rel}: ${count} entries (${Math.round(size / 1024)} KB)`);
  } catch (e) {
    ok = false;
    console.error(`- [FAIL] ${c.rel}: ${e?.message || e}`);
  }
}

if (!ok) {
  process.exit(1);
}

console.log("IDS validate: OK");