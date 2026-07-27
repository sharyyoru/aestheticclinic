/**
 * Retell AI call pipeline tests
 *
 * Covers the pure logic used across scheduled, workflow-triggered, and web
 * calls: phone normalization and transcript/duration formatting.
 */

import { normalizePhone } from "@/lib/retell";
import {
  formatCallDuration,
  formatTranscriptReadable,
  parseTranscriptTurns,
  type CallTurn,
} from "@/lib/callLog";

function testNormalizePhone() {
  console.log("Test 1: normalizePhone");

  const testCases: { name: string; input: string; expected: string }[] = [
    { name: "Swiss local mobile with spaces", input: "079 123 45 67", expected: "+41791234567" },
    { name: "Swiss local mobile with dashes", input: "079-123-45-67", expected: "+41791234567" },
    { name: "Swiss local with leading 0", input: "0227322223", expected: "+41227322223" },
    { name: "International 00 prefix", input: "0041791234567", expected: "+41791234567" },
    { name: "E.164 unchanged", input: "+41791234567", expected: "+41791234567" },
    { name: "International with dots", input: "+41.79.123.45.67", expected: "+41791234567" },
    { name: "French local mobile", input: "0612345678", expected: "+41612345678" },
  ];

  let passed = 0;
  let failed = 0;
  for (const tc of testCases) {
    const result = normalizePhone(tc.input);
    if (result === tc.expected) {
      passed++;
      console.log(`  ✓ ${tc.name}: PASSED`);
    } else {
      failed++;
      console.log(`  ✗ ${tc.name}: FAILED`);
      console.log(`    Expected: ${tc.expected}`);
      console.log(`    Got: ${result}`);
    }
  }

  console.log(`  Results: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

function testParseTranscriptTurns() {
  console.log("Test 2: parseTranscriptTurns");

  const objectTurns: CallTurn[] = [
    { role: "agent", content: "Hello, how can I help?" },
    { role: "patient", content: "I'd like to book a consultation." },
    { role: "agent", content: "Great, what day works for you?" },
  ];

  const textTranscript = `Agent: Hello, how can I help?
User: I'd like to book a consultation.
Assistant: Great, what day works for you?`;

  const testCases: { name: string; input: { transcript_object?: CallTurn[]; transcript?: string }; expected: CallTurn[] }[] = [
    {
      name: "Structured object preferred",
      input: { transcript_object: objectTurns },
      expected: [
        { role: "agent", content: "Hello, how can I help?" },
        { role: "patient", content: "I'd like to book a consultation." },
        { role: "agent", content: "Great, what day works for you?" },
      ],
    },
    {
      name: "Plain transcript fallback",
      input: { transcript: textTranscript },
      expected: [
        { role: "agent", content: "Hello, how can I help?" },
        { role: "patient", content: "I'd like to book a consultation." },
        { role: "agent", content: "Great, what day works for you?" },
      ],
    },
    {
      name: "Continuation lines appended",
      input: { transcript: "Agent: Hello\nhow are you\nUser: Fine thanks" },
      expected: [
        { role: "agent", content: "Hello how are you" },
        { role: "patient", content: "Fine thanks" },
      ],
    },
    {
      name: "Empty input returns empty",
      input: {},
      expected: [],
    },
  ];

  let passed = 0;
  let failed = 0;
  for (const tc of testCases) {
    const result = parseTranscriptTurns(tc.input);
    const ok =
      result.length === tc.expected.length &&
      result.every((r, i) => r.role === tc.expected[i].role && r.content === tc.expected[i].content);
    if (ok) {
      passed++;
      console.log(`  ✓ ${tc.name}: PASSED`);
    } else {
      failed++;
      console.log(`  ✗ ${tc.name}: FAILED`);
      console.log(`    Expected: ${JSON.stringify(tc.expected)}`);
      console.log(`    Got: ${JSON.stringify(result)}`);
    }
  }

  console.log(`  Results: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

function testFormatTranscriptReadable() {
  console.log("Test 3: formatTranscriptReadable");

  const turns: CallTurn[] = [
    { role: "agent", content: "Hello" },
    { role: "patient", content: "Hi there" },
  ];

  const expected = "Agent: Hello\nPatient: Hi there";
  const result = formatTranscriptReadable(turns);
  const ok = result === expected;
  console.log(`  ${ok ? "✓" : "✗"} Format turns: ${ok ? "PASSED" : "FAILED"}`);
  if (!ok) {
    console.log(`    Expected: ${expected}`);
    console.log(`    Got: ${result}`);
  }
  console.log();
  return ok;
}

function testFormatCallDuration() {
  console.log("Test 4: formatCallDuration");

  const testCases: { name: string; seconds: number | null | undefined; expected: string }[] = [
    { name: "Zero or null", seconds: 0, expected: "—" },
    { name: "Null", seconds: null, expected: "—" },
    { name: "Undefined", seconds: undefined, expected: "—" },
    { name: "45 seconds", seconds: 45, expected: "45s" },
    { name: "90 seconds", seconds: 90, expected: "1m 30s" },
    { name: "125 seconds", seconds: 125, expected: "2m 5s" },
  ];

  let passed = 0;
  let failed = 0;
  for (const tc of testCases) {
    const result = formatCallDuration(tc.seconds);
    if (result === tc.expected) {
      passed++;
      console.log(`  ✓ ${tc.name}: PASSED`);
    } else {
      failed++;
      console.log(`  ✗ ${tc.name}: FAILED`);
      console.log(`    Expected: ${tc.expected}`);
      console.log(`    Got: ${result}`);
    }
  }

  console.log(`  Results: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

console.log("=== Retell Call Pipeline Tests ===\n");

const t1 = testNormalizePhone();
const t2 = testParseTranscriptTurns();
const t3 = testFormatTranscriptReadable();
const t4 = testFormatCallDuration();

const allPassed = t1 && t2 && t3 && t4;

console.log("=== Test Summary ===");
console.log(`normalizePhone: ${t1 ? "PASSED" : "FAILED"}`);
console.log(`parseTranscriptTurns: ${t2 ? "PASSED" : "FAILED"}`);
console.log(`formatTranscriptReadable: ${t3 ? "PASSED" : "FAILED"}`);
console.log(`formatCallDuration: ${t4 ? "PASSED" : "FAILED"}`);
console.log(`\nOverall: ${allPassed ? "ALL TESTS PASSED ✓" : "SOME TESTS FAILED ✗"}`);

if (!allPassed) {
  process.exit(1);
}
