/**
 * Regression tests for the consent/instructions form presentation policy.
 *
 * Consent and instruction forms render as documents: blank lines copied from
 * the paper original ("NOM: ____", "Date: ____") must never appear as inputs,
 * because the clinic already holds that information.
 *
 * But a consent is a medical-legal record, so two things are non-negotiable:
 *   - the patient's drawn signature is collected and required;
 *   - the patient's identity is shown on the document, prefilled from the
 *     record, and only asked for when the record has no value.
 * Dropping either on 2026-10-07 produced an HBOT consent with no signature on
 * file. Questionnaires are untouched throughout.
 *
 * Run with:  npx tsx src/__tests__/patientFormPresentation.test.ts
 */

import {
  cleanDocumentText,
  getConfirmationIdentityFields,
  getPatientResponseFields,
  isConfirmationDocument,
} from "../lib/patientFormPresentation";
import { getUnansweredPatientFormFields } from "../lib/patientFormValidation";
import { getFormById, FORM_DEFINITIONS, type FormDefinition } from "../lib/formDefinitions";

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
  // A consent document must carry the patient's own signature. Excluding it
  // produced a real HBOT consent with nothing on file (2026-10-07) and the
  // clinic had to ask the patient to sign again.
  check("SIGNATURE KEPT", keptIds.includes("signature"), true);
  check("signature date removed", keptIds.includes("signature_date"), false);
  check("acknowledgment checkbox removed", keptIds.includes("document_acknowledged"), false);
  check("document form keeps only the signature", keptIds.join(","), "signature");
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
  // What autofill supplies for a patient whose record is complete.
  const prefilled = {
    document_acknowledged: true,
    full_name: "Xavier Tenorio",
    date_of_birth: "1980-04-25",
    signature_date: "2026-10-07",
  };
  const signature = "data:image/png;base64,iVBORw0KGgo=";

  const unanswered = getUnansweredPatientFormFields(consent, prefilled).map((f) => f.id);
  // Agreeing is not signing: an unsigned consent must not be submittable.
  check("UNSIGNED CONSENT REJECTED", unanswered.includes("signature"), true);
  check("document acknowledgment not required as a field", unanswered.includes("document_acknowledged"), false);
  check("prefilled identity does not block", unanswered.join(","), "signature");

  check(
    "signed confirmation passes",
    getUnansweredPatientFormFields(consent, { ...prefilled, signature }).length,
    0,
  );

  // Identity the record does not hold must be asked for, so a consent is
  // never signed with a blank date of birth.
  const noDob = getUnansweredPatientFormFields(consent, {
    ...prefilled,
    signature,
    date_of_birth: "",
  }).map((f) => f.id);
  check("MISSING DATE OF BIRTH BLOCKS", noDob.includes("date_of_birth"), true);

  const noName = getUnansweredPatientFormFields(consent, {
    ...prefilled,
    signature,
    full_name: "   ",
  }).map((f) => f.id);
  check("missing name blocks", noName.includes("full_name"), true);

  const eclaire = getFormById("consentement-eclaire-fr");
  if (eclaire) {
    const missing = getUnansweredPatientFormFields(eclaire, {
      document_acknowledged: true,
    }).map((f) => f.id);
    check("treatment still required", missing.includes("treatment"), true);
    check("photo authorization still required", missing.includes("photo_video_authorization"), true);
    check("signature still required", missing.includes("signature"), true);

    const complete = getUnansweredPatientFormFields(eclaire, {
      document_acknowledged: true,
      first_name: "Xavier",
      last_name: "Tenorio",
      date_of_birth: "1980-04-25",
      signature_date: "2026-10-07",
      treatment: "Rhinoplastie",
      photo_video_authorization: "authorized",
      signature,
    });
    check("complete consent submission passes", complete.length, 0);
  }
}

function testIdentityFields() {
  console.log("--- getConfirmationIdentityFields ---");

  // The 12-form shape: a single full_name.
  const anesthesia = getFormById("consentement-anesthesie-fr");
  if (anesthesia) {
    const ids = getConfirmationIdentityFields(anesthesia).map((f) => f.id);
    check("full_name shape resolved in order", ids.join(","), "full_name,date_of_birth,signature_date");
  }

  // The consentement-eclaire shape: first_name + last_name, no full_name.
  const eclaire = getFormById("consentement-eclaire-fr");
  if (eclaire) {
    const ids = getConfirmationIdentityFields(eclaire).map((f) => f.id);
    check(
      "first/last-name shape resolved in order",
      ids.join(","),
      "first_name,last_name,date_of_birth,signature_date",
    );
  }

  const questionnaire = getFormById("questionnaire-anesthesie-fr");
  if (questionnaire) {
    check("questionnaires have no identity block", getConfirmationIdentityFields(questionnaire).length, 0);
  }

  // Identity and response sets must stay disjoint, or a field renders twice.
  let overlapping = 0;
  for (const form of FORM_DEFINITIONS) {
    if (!isConfirmationDocument(form)) continue;
    const identity = new Set(getConfirmationIdentityFields(form).map((f) => f.id));
    if (getPatientResponseFields(form).some((f) => identity.has(f.id))) overlapping++;
  }
  check("identity and response sets never overlap", overlapping, 0);
}

function testEveryConfirmationFormIsSignable() {
  console.log("--- every consent/instruction form ---");
  let total = 0;
  let notCollected = 0;
  let notRequired = 0;

  for (const form of FORM_DEFINITIONS) {
    if (!isConfirmationDocument(form)) continue;
    const declares = form.sections.flatMap((s) => s.fields).some((f) => f.type === "signature");
    if (!declares) continue;
    total++;
    if (!getPatientResponseFields(form).some((f) => f.type === "signature")) notCollected++;
    // An "agreed but unsigned" payload must still be rejected.
    const unanswered = getUnansweredPatientFormFields(form, {
      document_acknowledged: true,
      full_name: "Test Patient",
      first_name: "Test",
      last_name: "Patient",
      date_of_birth: "1980-01-01",
      signature_date: "2026-10-07",
    }).map((f) => f.id);
    if (!unanswered.includes("signature")) notRequired++;
  }

  check("forms declaring a signature", total > 0, true);
  check("every one collects it", notCollected, 0);
  check("every one rejects an unsigned submission", notRequired, 0);
}

function testIndividualAcknowledgments() {
  console.log("--- individual acknowledgments ---");
  // Seven separately-required affirmations were collapsed into the single
  // confirmation button. Each is its own consent and must be collected.
  const form = getFormById("consentement-lift-reduction-en");
  if (!form) {
    failed++;
    console.log("  ✗ consentement-lift-reduction-en not found");
    return;
  }
  const kept = new Set(getPatientResponseFields(form).map((f) => f.id));
  for (const id of [
    "risk_scarring",
    "risk_sensation",
    "risk_breastfeeding",
    "risk_asymmetry",
    "risk_necrosis",
    "procedure_explained",
    "consent_given",
  ]) {
    check(`${id} collected`, kept.has(id), true);
  }
  check("the generic confirmation checkbox stays replaced", kept.has("document_acknowledged"), false);
}

console.log("=== Patient Form Presentation Tests ===\n");
testClassification();
testCleanDocumentText();
testResponseFields();
testIdentityFields();
testValidation();
testEveryConfirmationFormIsSignable();
testIndividualAcknowledgments();

console.log("\n=== Test Summary ===");
console.log(`${passed} passed, ${failed} failed`);
console.log(`\nOverall: ${failed === 0 ? "ALL TESTS PASSED ✓" : "SOME TESTS FAILED ✗"}`);

if (failed > 0) {
  process.exit(1);
}
