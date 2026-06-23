/**
 * Regression tests for appointment patient-communication eligibility.
 *
 * Guards against the bug where a patient received a "your appointment is
 * tomorrow" reminder for an appointment that had already been moved
 * ("Déplacé"). The agenda booking status lives in the `reason` text tag, not
 * the DB `status` column, so the reminder cron must consult both.
 *
 * Run with:  npx tsx src/__tests__/appointmentComms.test.ts
 */

import {
  parseAgendaStatus,
  normalizeAgendaStatus,
  reminderSuppressionReason,
  isEligibleForPatientComms,
} from "../lib/appointmentComms";

type Case = {
  name: string;
  appt: { status?: string | null; reason?: string | null };
  expectedEligible: boolean;
};

const cases: Case[] = [
  {
    name: "Active scheduled appointment with no status tag -> eligible",
    appt: { status: "scheduled", reason: "Filler / HA [Doctor: Yulia]" },
    expectedEligible: true,
  },
  {
    name: "Scheduled appointment tagged Déplacé (the reported bug) -> blocked",
    appt: {
      status: "scheduled",
      reason: "Filler / HA [Doctor: Yulia] [Category: Injection] [Status: Déplacé]",
    },
    expectedEligible: false,
  },
  {
    name: "Scheduled appointment tagged Annulé -> blocked",
    appt: { status: "scheduled", reason: "Consultation [Status: Annulé]" },
    expectedEligible: false,
  },
  {
    name: "Accent-free / lowercase 'deplace' tag -> still blocked",
    appt: { status: "scheduled", reason: "Filler [Status: deplace]" },
    expectedEligible: false,
  },
  {
    name: "DB status cancelled -> blocked regardless of tag",
    appt: { status: "cancelled", reason: "Filler [Status: fait]" },
    expectedEligible: false,
  },
  {
    name: "Benign status tag 'fait' -> eligible (not a blocking status)",
    appt: { status: "scheduled", reason: "Filler [Status: fait]" },
    expectedEligible: true,
  },
  {
    name: "Null reason -> eligible",
    appt: { status: "scheduled", reason: null },
    expectedEligible: true,
  },
  {
    name: "Extra whitespace in tag -> still blocked",
    appt: { status: "scheduled", reason: "Filler [Status:   Déplacé  ]" },
    expectedEligible: false,
  },
];

function testEligibility(): boolean {
  console.log("Test: Patient-communication eligibility");
  let passed = 0;
  let failed = 0;

  for (const tc of cases) {
    const eligible = isEligibleForPatientComms(tc.appt);
    if (eligible === tc.expectedEligible) {
      passed++;
      console.log(`  ✓ ${tc.name}`);
    } else {
      failed++;
      console.log(`  ✗ ${tc.name}`);
      console.log(`    expected eligible=${tc.expectedEligible}, got ${eligible}`);
      console.log(`    suppressionReason=${reminderSuppressionReason(tc.appt)}`);
    }
  }

  console.log(`  Results: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

function testParsers(): boolean {
  console.log("Test: parser/normaliser helpers");
  let passed = 0;
  let failed = 0;

  const checks: Array<[string, unknown, unknown]> = [
    ["parse Déplacé", parseAgendaStatus("X [Status: Déplacé]"), "Déplacé"],
    ["parse missing", parseAgendaStatus("X [Doctor: A]"), null],
    ["parse null", parseAgendaStatus(null), null],
    ["normalize Déplacé", normalizeAgendaStatus("Déplacé"), "deplace"],
    ["normalize Annulé", normalizeAgendaStatus("Annulé"), "annule"],
    ["normalize spacing", normalizeAgendaStatus("  N'est pas  venu "), "n'est pas venu"],
  ];

  for (const [name, got, expected] of checks) {
    if (got === expected) {
      passed++;
      console.log(`  ✓ ${name}`);
    } else {
      failed++;
      console.log(`  ✗ ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
    }
  }

  console.log(`  Results: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

console.log("=== Appointment Comms Eligibility Tests ===\n");
const t1 = testEligibility();
const t2 = testParsers();
const allPassed = t1 && t2;
console.log("=== Test Summary ===");
console.log(`Eligibility: ${t1 ? "PASSED" : "FAILED"}`);
console.log(`Parsers: ${t2 ? "PASSED" : "FAILED"}`);
console.log(`\nOverall: ${allPassed ? "ALL TESTS PASSED ✓" : "SOME TESTS FAILED ✗"}`);

if (!allPassed) {
  process.exit(1);
}
