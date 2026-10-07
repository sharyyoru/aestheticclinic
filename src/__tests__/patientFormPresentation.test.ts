/**
 * Regression tests for the consent/instructions form presentation policy.
 *
 * Consent and instruction forms are rendered as read-only documents: the
 * copied source text may contain blank lines from the paper original
 * ("NOM: ____", "Date: ____", signature rules) that must never appear as
 * inputs, because patient identity is prefilled and completion is a single
 * "I have read and agree" confirmation. Questionnaires are untouched.
 *
 * Run with:  npx tsx src/__tests__/patientFormPresentation.test.ts
 */

import {
  cleanDocumentText,
  getPatientResponseFields,
  isConfirmationDocument,
} from "../lib/patientFormPresentation";
import { getUnansweredPatientFormFields } from "../lib/patientFormValidation";
import { getFormById, type FormDefinition } from "../lib/formDefinitions";

let passed = 0;
let failed = 0;

function check(name: string, got: unknown, expected: unknown) {
  if (got === expected) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
  }
}

function testClassification() {
  console.log("--- isConfirmationDocument ---");
  const consent = getFormById("consentement-hbot-fr");
  const instructions = getFormById("consignes-pre-post-op-fr");
  const questionnaire = getFormById("questionnaire-anesthesie-fr");
  check("consent is a confirmation document", consent ? isConfirmationDocument(consent) : null, true);
  check("instructions is a confirmation document", instructions ? isConfirmationDocument(instructions) : null, true);
  check("questionnaire is not a confirmation document", questionnaire ? isConfirmationDocument(questionnaire) : null, false);
}

function testCleanDocumentText() {
  console.log("--- cleanDocumentText ---");
  const source = [
    "CONSENTEMENT ÉCLAIRÉ",
    "Je soussigné(e)",
    "NOM : ........................................",
    "PRÉNOM : .....................................",
    "DATE DE NAISSANCE : ..........................",
    "déclare avoir reçu des explications sur le traitement.",
    "DATE : ____________",
    "SIGNATURE DU PATIENT : ____________________",
    "..............................................",
    "Je consens au traitement proposé.",
  ].join("\n");
  const cleaned = cleanDocumentText(source);
  check("placeholder name line removed", cleaned.includes("NOM"), false);
  check("placeholder birth-date line removed", cleaned.includes("NAISSANCE"), false);
  check("placeholder date line removed", cleaned.includes("DATE :"), false);
  check("signature line removed", cleaned.includes("SIGNATURE"), false);
  check("dotted-only line removed", cleaned.includes("...."), false);
  check("heading kept", cleaned.includes("CONSENTEMENT ÉCLAIRÉ"), true);
  check("legal sentence kept", cleaned.includes("déclare avoir reçu des explications"), true);
  check("consent sentence kept", cleaned.includes("Je consens au traitement proposé."), true);
  check("intro line kept", cleaned.includes("Je soussigné(e)"), true);
}

function testResponseFields() {
  console.log("--- getPatientResponseFields ---");
  const consent = getFormById("consentement-anesthesie-fr");
  if (!consent) {
    failed++;
    console.log("  ✗ consentement-anesthesie-fr not found");
    return;
  }
  const allIds = consent.sections.flatMap((s) => s.fields.map((f) => f.id));
  const keptIds = getPatientResponseFields(consent).map((f) => f.id);

  check("identity fields removed", keptIds.includes("full_name"), false);
  check("date of birth removed", keptIds.includes("date_of_birth"), false);
  check("signature removed", keptIds.includes("signature"), false);
  check("signature date removed", keptIds.includes("signature_date"), false);
  check("acknowledgment checkbox removed", keptIds.includes("document_acknowledged"), false);
  check("pure document form keeps no fields", keptIds.length, 0);
  check("fields are a subset of the definition", keptIds.every((id) => allIds.includes(id)), true);

  const photoConsent = getFormById("consentement-eclaire-fr");
  if (photoConsent) {
    const kept = getPatientResponseFields(photoConsent).map((f) => f.id);
    check("photo authorization radio kept", kept.includes("photo_video_authorization"), true);
    check("treatment text kept", kept.includes("treatment"), true);
    check("identity still removed", kept.includes("first_name") || kept.includes("last_name"), false);
  }

  const questionnaire = getFormById("questionnaire-anesthesie-fr") as FormDefinition | undefined;
  if (questionnaire) {
    const total = questionnaire.sections.flatMap((s) => s.fields).length;
    check("questionnaire keeps every field", getPatientResponseFields(questionnaire).length, total);
  }
}

function testValidation() {
  console.log("--- getUnansweredPatientFormFields ---");
  const consent = getFormById("consentement-anesthesie-fr");
  if (!consent) {
    failed++;
    console.log("  ✗ consentement-anesthesie-fr not found");
    return;
  }
  const unanswered = getUnansweredPatientFormFields(consent, {
    document_acknowledged: true,
  }).map((f) => f.id);
  check("signature not required anymore", unanswered.includes("signature"), false);
  check("document acknowledgment not required as a field", unanswered.includes("document_acknowledged"), false);
  check("pure document confirmation passes", unanswered.length, 0);

  const eclaire = getFormById("consentement-eclaire-fr");
  if (eclaire) {
    const missing = getUnansweredPatientFormFields(eclaire, {
      document_acknowledged: true,
    }).map((f) => f.id);
    check("treatment still required", missing.includes("treatment"), true);
    check("photo authorization still required", missing.includes("photo_video_authorization"), true);

    const complete = getUnansweredPatientFormFields(eclaire, {
      document_acknowledged: true,
      treatment: "Rhinoplastie",
      photo_video_authorization: "authorized",
    });
    check("complete consent submission passes", complete.length, 0);
  }
}

console.log("=== Patient Form Presentation Tests ===\n");
testClassification();
testCleanDocumentText();
testResponseFields();
testValidation();

console.log("\n=== Test Summary ===");
console.log(`${passed} passed, ${failed} failed`);
console.log(`\nOverall: ${failed === 0 ? "ALL TESTS PASSED ✓" : "SOME TESTS FAILED ✗"}`);

if (failed > 0) {
  process.exit(1);
}
