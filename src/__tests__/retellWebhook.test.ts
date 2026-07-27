/**
 * Retell webhook helper tests
 *
 * Covers the pure logic used by the Retell lifecycle webhook:
 * customer info extraction and service matching.
 */

import { extractCustomerInfo, matchServiceToHubspot, type HubspotService } from "@/lib/retellWebhookHelpers";

function testExtractCustomerInfo() {
  console.log("Test 1: extractCustomerInfo");

  const testCases: {
    name: string;
    call: Parameters<typeof extractCustomerInfo>[0];
    expected: {
      firstName: string;
      lastName: string;
      phone: string;
      email: string;
      serviceInterest: string;
      location: string;
    };
  }[] = [
    {
      name: "Outbound call uses to_number",
      call: {
        direction: "outbound",
        from_number: "+41799029555",
        to_number: "+41791234567",
        retell_llm_dynamic_variables: {
          first_name: "Alice",
          last_name: "Smith",
        },
      },
      expected: {
        firstName: "Alice",
        lastName: "Smith",
        phone: "+41791234567",
        email: "",
        serviceInterest: "",
        location: "",
      },
    },
    {
      name: "Inbound call uses from_number",
      call: {
        direction: "inbound",
        from_number: "+41791234567",
        to_number: "+41799029555",
      },
      expected: {
        firstName: "",
        lastName: "",
        phone: "+41791234567",
        email: "",
        serviceInterest: "",
        location: "",
      },
    },
    {
      name: "Dynamic variables take precedence",
      call: {
        direction: "outbound",
        to_number: "+41790000000",
        retell_llm_dynamic_variables: {
          phone: "+41791234567",
          first_name: "Bob",
          last_name: "Jones",
          email: "bob@example.com",
          service_interest: "Botox",
        },
      },
      expected: {
        firstName: "Bob",
        lastName: "Jones",
        phone: "+41791234567",
        email: "bob@example.com",
        serviceInterest: "Botox",
        location: "",
      },
    },
    {
      name: "customer_name splits into first/last",
      call: {
        direction: "inbound",
        from_number: "+41791234567",
        retell_llm_dynamic_variables: {
          customer_name: "Marie Curie",
        },
      },
      expected: {
        firstName: "Marie",
        lastName: "Curie",
        phone: "+41791234567",
        email: "",
        serviceInterest: "",
        location: "",
      },
    },
    {
      name: "Placeholder numbers are ignored",
      call: {
        direction: "web",
        from_number: "+10000000000",
        to_number: "+41799029555",
      },
      expected: {
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        serviceInterest: "",
        location: "",
      },
    },
  ];

  let passed = 0;
  let failed = 0;
  for (const tc of testCases) {
    const result = extractCustomerInfo(tc.call);
    const ok =
      result.firstName === tc.expected.firstName &&
      result.lastName === tc.expected.lastName &&
      result.phone === tc.expected.phone &&
      result.email === tc.expected.email &&
      result.serviceInterest === tc.expected.serviceInterest &&
      result.location === tc.expected.location;
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

function testMatchServiceToHubspot() {
  console.log("Test 2: matchServiceToHubspot");

  const services: HubspotService[] = [
    { id: "s1", name: "Breast Augmentation" },
    { id: "s2", name: "Botox" },
    { id: "s3", name: "Lip Filler" },
    { id: "s4", name: "Consultation" },
  ];

  const testCases: { name: string; interest: string; expectedId: string | null }[] = [
    { name: "Direct match", interest: "botox", expectedId: "s2" },
    { name: "Keyword match", interest: "I want breast implants", expectedId: "s1" },
    { name: "Partial match", interest: "lip enhancement", expectedId: "s3" },
    { name: "No match", interest: "spaceship", expectedId: null },
    { name: "Empty interest", interest: "", expectedId: null },
  ];

  let passed = 0;
  let failed = 0;
  for (const tc of testCases) {
    const result = matchServiceToHubspot(tc.interest, services);
    const ok = (result?.id ?? null) === tc.expectedId;
    if (ok) {
      passed++;
      console.log(`  ✓ ${tc.name}: PASSED`);
    } else {
      failed++;
      console.log(`  ✗ ${tc.name}: FAILED`);
      console.log(`    Expected: ${tc.expectedId}`);
      console.log(`    Got: ${result?.id ?? null}`);
    }
  }

  console.log(`  Results: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

console.log("=== Retell Webhook Helper Tests ===\n");

const t1 = testExtractCustomerInfo();
const t2 = testMatchServiceToHubspot();

const allPassed = t1 && t2;

console.log("=== Test Summary ===");
console.log(`extractCustomerInfo: ${t1 ? "PASSED" : "FAILED"}`);
console.log(`matchServiceToHubspot: ${t2 ? "PASSED" : "FAILED"}`);
console.log(`\nOverall: ${allPassed ? "ALL TESTS PASSED ✓" : "SOME TESTS FAILED ✗"}`);

if (!allPassed) {
  process.exit(1);
}
