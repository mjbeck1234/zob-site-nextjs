"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { RosterRow } from "./page";
import { useSearchParams } from "next/navigation";
import { rosterDisplayName } from "@/lib/names";

type Group = "Home Controllers" | "Visitors";

type Controller = {
  cid: string;
  name: string;
  rating: string;
  group: Group;
  isTraining: boolean;
  roles: string[];
  control: Array<{ station: "GND" | "LCL" | "APP" | "CTR"; level: "Unrestricted" | "Fully Endorsed" | "Solo" | "Departure" | "None" }>;
  months: number;
  lastSeen: string;
  meta: RosterRow;
};

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toStr(v: unknown) {
  if (v === null || v === undefined) return "";
  return typeof v === "string" ? v : String(v);
}

function isTruthyString(v: unknown) {
  const s = toStr(v).trim().toLowerCase();
  return s !== "" && s !== "false" && s !== "0" && s !== "null" && s !== "undefined";
}

function monthsBetween(iso: string | null | undefined) {
  if (!iso) return 0;
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return Math.max(0, months);
}

function inferGroup(r: RosterRow): Controller["group"] {
  const t = toStr(r.type).trim().toLowerCase();
  // The current schema uses:
  // - prim => home controllers
  // - vis  => visiting controllers
  return t === "vis" ? "Visitors" : "Home Controllers";
}

function inferIsTraining(r: RosterRow): boolean {
  // Prefer explicit flags if available.
  if (r.roster_exempt === true) return false;
  if (r.active === false) return false;

  // Some installs often store a Yes/No-ish field for training ability.
  if (r.able_training === false && (r.rating ?? "").startsWith("S")) return true;

  const status = toStr((r as any).status).trim().toLowerCase();
  // Some DBs store T/TRN/etc. Be generous.
  if (status === "t" || status === "trn" || status === "training") return true;

  return false;
}

const ALLOWED_ROLE_CODES = new Set(["TA", "WM", "WT", "ATM", "DATM", "EC", "AEC", "INS", "FE", "AFE"]);

function inferRoles(r: RosterRow): string[] {
  const roles: string[] = [];

  // Instructor / mentor flags vary between schemas (boolean, 0/1, Yes/No)
  const insRaw: any = (r as any).ins;
  const mentorRaw: any = (r as any).mentor;
  const isIns = typeof insRaw === "boolean" ? insRaw : isTruthyString(insRaw);
  const isMentor = typeof mentorRaw === "boolean" ? mentorRaw : isTruthyString(mentorRaw);
  if (isIns) roles.push("INS");
  if (isMentor) roles.push("Mentor");

  // Staff code (ATM/DATM/TA/...) lives in roster.staff in the current DB.
  const staffCode = toStr((r as any).staff).trim().toUpperCase();
  if (ALLOWED_ROLE_CODES.has(staffCode)) roles.push(staffCode);

  // Only show roles from the allowed list; if none, show nothing.
  return roles;
}

type ControlLevel = Controller["control"][number]["level"];

function normalizeEndorsementValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "full" : "no";
  const s = toStr(v).trim().toLowerCase();
  return s;
}

function mapEndorsementLevel(v: unknown): ControlLevel {
  const s = normalizeEndorsementValue(v);
  if (!s || s === "no" || s === "none" || s === "n" || s === "0" || s === "false") return "None";
  // Stored DB values (your dump): full | mine | no
  if (s === "mine" || s === "unrestricted") return "Unrestricted";
  if (s === "full" || s === "yes" || s === "y" || s === "true" || s === "1") return "Fully Endorsed";
  // Some older installs used additional states.
  if (s === "solo") return "Solo";
  if (s === "dep" || s === "departure") return "Departure";
  // Unknown truthy value: treat as fully endorsed.
  return "Fully Endorsed";
}

function inferControl(r: RosterRow): Controller["control"] {
  return [
    { station: "GND", level: mapEndorsementLevel((r as any).s1) },
    { station: "LCL", level: mapEndorsementLevel((r as any).s2) },
    { station: "APP", level: mapEndorsementLevel((r as any).s3) },
    { station: "CTR", level: mapEndorsementLevel((r as any).c1) },
  ];
}

function RatingPill({ rating }: { rating: string }) {
  const tone =
    rating === "OBS"
      ? "bg-white/10 text-white/70 border-white/10"
      : rating.startsWith("S")
      ? "bg-amber-500/10 text-amber-200 border-amber-500/20"
      : rating.startsWith("C")
      ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/20"
      : rating.startsWith("I")
      ? "bg-purple-500/10 text-purple-200 border-purple-500/20"
      : "bg-amber-500/10 text-amber-200 border-amber-500/20";

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide", tone)}>
      {rating || "—"}
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80">
      {children}
    </span>
  );
}

function ControlBadge({ station, level }: Controller["control"][number]) {
  const tone =
    level === "Unrestricted"
      ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
      : level === "Fully Endorsed"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
      : level === "Solo"
      ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
      : level === "Departure"
      ? "border-purple-400/20 bg-purple-400/10 text-purple-100"
      : "border-white/10 bg-white/5 text-white/70";

  return (
    <div className={cn("flex items-center justify-between gap-2 rounded-xl border px-2.5 py-1 text-xs", tone)}>
      <span className="font-extrabold tracking-wide">{station}</span>
      <span className="font-semibold">{level}</span>
    </div>
  );
}

export default function RosterClient({ facility, rows }: { facility: string; rows: RosterRow[] }) {
  const searchRef = useRef<HTMLInputElement | null>(null);
  const searchParams = useSearchParams();
  const cidParam = (searchParams.get("cid") ?? "").trim();
  const appliedCidRef = useRef<string>("");

  const controllers: Controller[] = useMemo(() => {
    return rows.map((r) => {
      const name = rosterDisplayName(r);
      return {
        cid: String(r.cid ?? ""),
        name: name || "—",
        rating: String(r.rating ?? "—").trim(),
        group: inferGroup(r),
        isTraining: inferIsTraining(r),
        roles: inferRoles(r),
        control: inferControl(r),
        months: monthsBetween(r.join_date),
        lastSeen: "—",
        meta: r,
      };
    });
  }, [rows]);

  const [group, setGroup] = useState<Group>("Home Controllers");
  const [search, setSearch] = useState("");
  const [rating, setRating] = useState("All");
  const [roleChip, setRoleChip] = useState<"All" | "Instructors" | "Mentors" | "Events">("All");

  // If a CID is provided in the query string (?cid=123456), pre-filter the roster and jump to that row.
  useEffect(() => {
    if (!cidParam) return;
    if (appliedCidRef.current === cidParam) return;
    if (!controllers.length) return;
    appliedCidRef.current = cidParam;

    const match = controllers.find((c) => String(c.cid) === cidParam);
    if (match) setGroup(match.group);
    setSearch(cidParam);

    // Wait a tick for filters to apply, then scroll.
    setTimeout(() => {
      const el = document.getElementById(`cid-${cidParam}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, [cidParam, controllers]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k";
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setSearch("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const ratingOptions = useMemo(() => {
    const s = new Set<string>();
    controllers.forEach((c) => s.add(c.rating));
    return ["All", ...Array.from(s).filter((x) => x && x !== "—").sort()];
  }, [controllers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return controllers.filter((c) => {
      if (c.group !== group) return false;
      if (rating !== "All" && c.rating !== rating) return false;

      if (roleChip !== "All") {
        const roles = c.roles.map((x) => x.toLowerCase());
        if (roleChip === "Instructors" && !roles.some((r) => r === "ins" || r.includes("instructor"))) return false;
        if (roleChip === "Mentors" && !roles.some((r) => r.includes("mentor"))) return false;
        if (roleChip === "Events" && !roles.some((r) => r === "ec" || r === "aec")) return false;
      }

      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.cid.toLowerCase().includes(q);
    });
  }, [controllers, group, rating, roleChip, search]);

  const totals = useMemo(() => {
    const total = controllers.length;
    const home = controllers.filter((c) => c.group === "Home Controllers").length;
    const visiting = controllers.filter((c) => c.group === "Visitors").length;
    return { total, home, visiting };
  }, [controllers]);

  const resetFilters = () => {
    setGroup("Home Controllers");
    setSearch("");
    setRating("All");
    setRoleChip("All");
  };

  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pb-10 pt-20">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/85 backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-white/40" />
          Controllers → <span className="font-semibold text-white">Roster</span>
          <span className="text-white/30">•</span>
          <span className="text-white/70">{facility}</span>
        </div>

        <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
              Controller Roster
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">
              Search and filter the roster.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["Home Controllers", "Visitors"] as Group[]).map((t) => (
              <button
                key={t}
                onClick={() => setGroup(t)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold backdrop-blur transition",
                  group === t ? "border-white/15 bg-white/10 text-white" : "border-white/10 bg-white/5 text-white/75 hover:bg-white/[0.08]"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-6xl px-5 pb-14">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs text-white/60">Total on roster</div>
            <div className="mt-2 text-3xl font-extrabold">{totals.total}</div>
            <div className="mt-2 text-xs text-white/55"></div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs text-white/60">Home</div>
            <div className="mt-2 text-3xl font-extrabold">{totals.home}</div>
            <div className="mt-2 text-xs text-white/55">Primary</div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs text-white/60">Visiting</div>
            <div className="mt-2 text-3xl font-extrabold">{totals.visiting}</div>
            <div className="mt-2 text-xs text-white/55">LOA / Visitor</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs text-white/60">Staff</div>
            <div className="mt-2 text-sm text-white/70">
              See <a className="underline text-white" href="/roster/staff">Roster → Staff</a>
            </div>
            <div className="mt-2 text-xs text-white/55">ARTCC staff list</div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or CID…"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white/20"
                />
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40">⌘K</div>
              </div>

              <div className="flex flex-wrap gap-3">
                <label className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                  Rating:&nbsp;
                  <select value={rating} onChange={(e) => setRating(e.target.value)} className="bg-transparent text-white outline-none">
                    {ratingOptions.map((r) => (
                      <option key={r} value={r} className="bg-[#070a12]">
                        {r}
                      </option>
                    ))}
                  </select>
                </label>

				<button
                  onClick={resetFilters}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75 transition hover:bg-white/[0.08]"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["All", "Instructors", "Mentors", "Events"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setRoleChip(t)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    roleChip === t ? "border-white/15 bg-white/10 text-white" : "border-white/10 bg-white/5 text-white/75 hover:bg-white/[0.08]"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 text-xs text-white/55">
            Showing <span className="text-white/80 font-semibold">{filtered.length}</span> of{' '}
            <span className="text-white/80 font-semibold">{controllers.length}</span>
          </div>
        </div>

        {/* Table (desktop) */}
        <div className="mt-6 hidden overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] md:block">
          <div className="border-b border-white/10 px-6 py-4">
            <div className="text-sm font-semibold">Roster</div>
            <div className="mt-1 text-xs text-white/55">Roster entries.</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs text-white/60">
                <tr className="[&>th]:px-6 [&>th]:py-4">
                  <th>Name</th>
                  <th>CID</th>
                  <th>Rating</th>
                  <th>Roles</th>
				  <th>Control</th>
                  <th>Join Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filtered.map((c) => (
                  <tr
                    key={c.cid}
                    id={`cid-${c.cid}`}
                    className={cn(
                      "transition hover:bg-white/[0.03] [&>td]:px-6 [&>td]:py-4",
                      cidParam && c.cid === cidParam && "bg-emerald-500/10"
                    )}
                  >
                    <td className="font-semibold">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-content-center rounded-xl border border-white/10 bg-white/5 text-xs font-bold">
                          {(c.name.split(" ").map((x) => x[0]).join("") || "—").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-white">{c.name}</div>
                          <div className="mt-1 text-xs text-white/50">{c.months} mo on roster</div>
                        </div>
                      </div>
                    </td>

                    <td className="text-white/80">{c.cid}</td>

                    <td>
                      <RatingPill rating={c.rating} />
                    </td>

                    <td>
                      <div className="flex flex-wrap gap-2">
                        {c.roles.length ? c.roles.map((r) => <Tag key={`${c.cid}-${r}`}>{r}</Tag>) : <Tag>—</Tag>}
                      </div>
                    </td>

					<td>
					  <div className="grid min-w-[260px] grid-cols-2 gap-2">
						{c.control.map((x) => (
						  <ControlBadge key={`${c.cid}-${x.station}`} station={x.station} level={x.level} />
						))}
					  </div>
					</td>

                    <td className="text-white/70">{c.meta.join_date ? new Date(c.meta.join_date).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-white/10 px-6 py-4 text-xs text-white/55">
            Filters: Group <span className="text-white/80">{group}</span> • Rating <span className="text-white/80">{rating}</span> • Role{' '}
            <span className="text-white/80">{roleChip}</span>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="mt-6 grid gap-4 md:hidden">
          {filtered.map((c) => (
            <div
              key={c.cid}
              id={`cid-${c.cid}`}
              className={cn(
                "rounded-3xl border border-white/10 bg-white/[0.03] p-5",
                cidParam && c.cid === cidParam && "border-emerald-400/30 bg-emerald-500/10"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-bold">{c.name}</div>
                  <div className="mt-1 text-xs text-white/60">
                    CID {c.cid} • {c.months} mo
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <RatingPill rating={c.rating} />
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs text-white/55">Roles</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.roles.length ? c.roles.map((r) => <Tag key={`${c.cid}-m-${r}`}>{r}</Tag>) : <Tag>—</Tag>}
                </div>
              </div>

              <div className="mt-4">
				<div className="text-xs text-white/55">Control privileges</div>
				<div className="mt-2 grid grid-cols-1 gap-2">
				  {c.control.map((x) => (
					<ControlBadge key={`${c.cid}-m-${x.station}`} station={x.station} level={x.level} />
				  ))}
				</div>
              </div>

              <div className="mt-4 text-xs text-white/60">
                Join date: <span className="text-white/80">{c.meta.join_date ? new Date(c.meta.join_date).toLocaleDateString() : "—"}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-white/10 bg-gradient-to-r from-white/[0.04] to-white/[0.02] p-6">
          <div className="text-sm font-bold">Next step you’ll likely do</div>
			<p className="mt-2 text-sm leading-relaxed text-white/70">
			  Control privileges are mapped from your roster columns: <span className="text-white/80 font-semibold">S1=Ground</span>,{' '}
			  <span className="text-white/80 font-semibold">S2=Local</span>, <span className="text-white/80 font-semibold">S3=Approach</span>,{' '}
			  <span className="text-white/80 font-semibold">C1=Center</span>.
			</p>
			<p className="mt-2 text-sm leading-relaxed text-white/70">
			  Stored values map like this: <span className="text-white/80 font-semibold">mine → Unrestricted</span>,{' '}
			  <span className="text-white/80 font-semibold">full → Fully Endorsed</span>,{' '}
			  <span className="text-white/80 font-semibold">no → None</span>. (Solo/Departure will display if your DB ever uses those states.)
			</p>
        </div>
      </section>
    </>
  );
}
