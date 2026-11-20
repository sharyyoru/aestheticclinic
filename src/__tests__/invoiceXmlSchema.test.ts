import assert from "node:assert/strict";
import { generateInvoiceXml } from "../lib/invoiceXmlNative";
import { validateInvoiceXml } from "../lib/invoiceXsd";
import {
  DiagnosisType,
  LawType,
  PlaceType,
  RoleType,
  SexType,
  TiersMode,
  TreatmentReason,
  type InvoiceAddress,
  type SumexInvoiceInput,
} from "../lib/sumexInvoice";

// Every native invoice XML from 23 Oct to 17 Nov 2026 was rejected by MediData
// as INVALID_UPLOAD because it broke the generalInvoiceRequest 5.0 schema.
// These cases reproduce each cause found in the rejected documents and assert
// the output now validates against the official XSD.

const clinic: InvoiceAddress = { companyName: "Aesthetics Clinic XT SA", street: "chemin Rieu 18", zip: "1208", city: "Genève", stateCode: "GE" };
const doctor: InvoiceAddress = {
  // Staff record with the whole name in one field -> empty given name.
  familyName: "Xavier Tenorio", givenName: "", street: "chemin Rieu 18", zip: "1208", city: "Genève", stateCode: "GE",
};
const patient: InvoiceAddress = { familyName: "Landauer", givenName: "Sandrine", street: "Rue du Rhône 42", zip: "1204", city: "Genève", stateCode: "GE" };
const insurer: InvoiceAddress = {
  // 37 characters; the schema allows 35.
  companyName: "Assura assurance maladie et accidents", street: "Avenue C.-F. Ramuz 70", zip: "1009", city: "Pully", stateCode: "VD",
};

function input(overrides: Partial<SumexInvoiceInput> = {}): SumexInvoiceInput {
  return {
    language: 2,
    roleType: RoleType.Physician,
    placeType: PlaceType.Practice,
    tiersMode: TiersMode.Payant,
    invoiceId: "1010575",
    invoiceDate: "2026-11-17",
    lawType: LawType.KVG,
    iban: "CH0930788000050249289",
    billerGln: "7601000771179",
    billerAddress: clinic,
    providerGln: "7601000771179",
    providerAddress: doctor,
    insuranceGln: "7601003001303",
    insuranceAddress: insurer,
    patientSex: SexType.Female,
    patientBirthdate: "1985-04-12",
    patientSsn: "7569999999991",
    patientAddress: patient,
    treatmentCanton: "GE",
    treatmentReason: TreatmentReason.Disease,
    treatmentDateBegin: "2026-11-17",
    treatmentDateEnd: "2026-11-17",
    diagnoses: [{ type: DiagnosisType.ICD, code: "N64.8" }],
    services: [{
      tariffType: "007", code: "AA.20.0010", quantity: 1, sessionNumber: 1, dateBegin: "2026-11-17T16:13:00",
      providerGln: "7601000771179", responsibleGln: "7601000771179",
      unit: 6.34, unitFactor: 0.96, unitTT: 6.41, unitFactorTT: 0.96,
      serviceName: "AA.20.0010 - Anesthésie locale par un non-anesthésiste (opérateur), par localisation",
    }],
    ...overrides,
  } as SumexInvoiceInput;
}

async function assertValid(label: string, xml: string) {
  const r = await validateInvoiceXml(xml);
  assert.equal(r.valid, true, `${label}: ${r.errors.join(" | ")}`);
}

async function main() {
  // The 17 Nov rejection: empty given name + 37-character insurer + diagnosis.
  const tp = generateInvoiceXml(input()).xmlContent;
  await assertValid("Tiers Payant", tp);
  assert.match(tp, /<invoice:givenname> <\/invoice:givenname>/, "empty given name becomes the single space Sumex sent");
  assert.match(tp, /<invoice:companyname>Assura assurance maladie et<\/invoice:companyname>/, "clipped at a word boundary, within 35");
  assert.match(tp, /<invoice:treatment [^>]*><invoice:diagnosis type="ICD" code="N64.8"\/><\/invoice:treatment>/, "diagnosis inside treatment");

  // Diagnosis text goes in the element content, never a value= attribute.
  const withText = generateInvoiceXml(input({ diagnoses: [{ type: DiagnosisType.FreeText, code: "", text: "Ptose mammaire" }] })).xmlContent;
  await assertValid("free-text diagnosis", withText);
  assert.doesNotMatch(withText, /value="/);

  // Tiers Garant: no allowModification, and the patient debitor needs a GLN.
  const tg = generateInvoiceXml(input({ tiersMode: TiersMode.Garant })).xmlContent;
  await assertValid("Tiers Garant", tg);
  assert.match(tg, /<invoice:tiers_garant>/);
  assert.match(tg, /<invoice:debitor gln="2099999999998">/);

  // Remark belongs right after the prolog; insured after guarantor.
  const ordered = generateInvoiceXml(input({ remark: "Correction de la facture 1009001", insuredAddress: patient })).xmlContent;
  await assertValid("remark + insured", ordered);

  // Escaped characters count once against the limit.
  const amp = generateInvoiceXml(input({ insuranceAddress: { ...insurer, companyName: "Groupe Mutuel & Philos Assurances SA" } })).xmlContent;
  await assertValid("ampersand in a long name", amp);

  // The gate itself must catch a broken document.
  const broken = await validateInvoiceXml(tp.replace("<invoice:givenname> </invoice:givenname>", "<invoice:givenname></invoice:givenname>"));
  assert.equal(broken.valid, false);
  assert.ok(broken.errors.some((e) => e.startsWith("givenname:")), broken.errors.join(" | "));

  console.log("invoiceXmlSchema: all assertions passed");
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
