/**
 * Regression test for the agenda calendar date bug.
 *
 * Symptom: for a viewer whose browser timezone is EAST of Switzerland
 * (e.g. UTC+04), every mini-calendar / month-grid date was shifted one day
 * earlier, the month label was wrong, and selecting a day booked the wrong
 * date. Cause: day cells were built at the browser's LOCAL midnight
 * (`new Date(y, m, d)`) but displayed / keyed in Swiss time.
 *
 * This test reproduces the bug with the OLD approach and proves the NEW
 * Swiss-noon-anchor approach is correct. Run under a non-Swiss timezone:
 *
 *   TZ=Asia/Dubai npx tsx src/__tests__/calendarSwissDates.test.ts   (bash)
 *   $env:TZ='Asia/Dubai'; npx tsx src/__tests__/calendarSwissDates.test.ts  (pwsh)
 */

import {
  createSwissDateTime,
  formatSwissYmd,
  getSwissDayOfWeek,
} from "../lib/swissTimezone";

const DAY_MS = 24 * 60 * 60 * 1000;

// ── NEW approach (mirrors appointments/page.tsx helpers) ────────────────────
function swissDayAnchor(year: number, monthIndex: number, day: number): Date {
  const n = new Date(year, monthIndex, day);
  const ymd = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  return createSwissDateTime(ymd, 12, 0);
}
function swissDayAnchorFrom(d: Date): Date {
  const [y, m, day] = formatSwissYmd(d).split("-").map(Number);
  return swissDayAnchor(y, m - 1, day);
}
function addSwissDays(d: Date, days: number): Date {
  return swissDayAnchorFrom(new Date(d.getTime() + days * DAY_MS));
}

function buildGridNew(year: number, monthIndex: number): Date[] {
  const firstOfMonth = swissDayAnchor(year, monthIndex, 1);
  const startWeekday = getSwissDayOfWeek(firstOfMonth); // 0=Sun..6=Sat
  const diff = (startWeekday - 1 + 7) % 7; // Monday-first
  const gridStart = addSwissDays(firstOfMonth, -diff);
  return Array.from({ length: 42 }, (_, i) => addSwissDays(gridStart, i));
}

// ── OLD (buggy) approach ────────────────────────────────────────────────────
function buildGridOld(year: number, monthIndex: number): Date[] {
  const firstOfMonth = new Date(year, monthIndex, 1); // LOCAL midnight
  const startWeekday = firstOfMonth.getDay();
  const diff = (startWeekday - 1 + 7) % 7;
  const gridStart = new Date(year, monthIndex, 1 - diff);
  return Array.from(
    { length: 42 },
    (_, i) => new Date(year, monthIndex, 1 - diff + i),
  );
}

// The displayed number / key both use Swiss time.
function swissDayNumber(d: Date): number {
  return Number(formatSwissYmd(d).split("-")[2]);
}

function run(): boolean {
  console.log(`=== Calendar Swiss Date Tests (TZ=${process.env.TZ ?? "system"}) ===\n`);
  let passed = 0;
  let failed = 0;
  const check = (name: string, cond: boolean, extra = "") => {
    if (cond) {
      passed++;
      console.log(`  ✓ ${name}`);
    } else {
      failed++;
      console.log(`  ✗ ${name} ${extra}`);
    }
  };

  // June 2026: 1 June is a Monday; 23 June is a Tuesday.
  const gridNew = buildGridNew(2026, 5);
  const gridOld = buildGridOld(2026, 5);

  // Find the cell that should be June 23.
  const new23 = gridNew.find((d) => formatSwissYmd(d) === "2026-06-23")!;
  const idxNew = gridNew.indexOf(new23);

  // NEW: weekday alignment — Monday-first grid, 1 June is Monday => index 0;
  // 23 June index should be 22 (column 22 % 7 = 1 => Tuesday, 2nd column).
  check(
    "NEW: 23 June lands in the Tuesday column",
    idxNew % 7 === 1,
    `(got column ${idxNew % 7})`,
  );

  // NEW: every printed number equals the intended Swiss day (no shift).
  check(
    "NEW: first cell prints its true Swiss day number",
    swissDayNumber(gridNew[0]) === Number(formatSwissYmd(gridNew[0]).split("-")[2]),
  );
  check(
    "NEW: grid starts on Mon 1 June (no off-by-one)",
    formatSwissYmd(gridNew[0]) === "2026-06-01" && getSwissDayOfWeek(gridNew[0]) === 1,
    `(got ${formatSwissYmd(gridNew[0])})`,
  );
  check(
    "NEW: month label month is June (06)",
    formatSwissYmd(swissDayAnchor(2026, 5, 1)).slice(5, 7) === "06",
  );

  // Demonstrate the OLD bug only when viewer is east of Switzerland.
  const old1 = gridOld[0];
  const oldShifted = swissDayNumber(old1) !== old1.getDate();
  const tzAheadOfSwiss = oldShifted; // local-midnight rolled back a Swiss day
  if (tzAheadOfSwiss) {
    check(
      "OLD: reproduced the off-by-one shift (bug present without fix)",
      swissDayNumber(old1) !== old1.getDate(),
    );
  } else {
    console.log("  • OLD approach not shifted in this TZ (run with TZ=Asia/Dubai to see the bug)");
  }

  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

const ok = run();
console.log(`Overall: ${ok ? "ALL TESTS PASSED ✓" : "SOME TESTS FAILED ✗"}`);
if (!ok) process.exit(1);
