import assert from "node:assert/strict";
import { generateInvoiceXml } from "../lib/invoiceXmlNative";
import { validateInvoiceXml } from "../lib/invoiceXsd";
import { runInvoiceXmlSelfTest, sampleAddresses, sampleInvoiceInput as input } from "../lib/invoiceXmlSelfTest";
import { DiagnosisType, TiersMode } from "../lib/sumexInvoice";

// Every native invoice XML from 23 Oct to 17 Nov 2026 was rejected by MediData
// as INVALID_UPLOAD because it broke the generalInvoiceRequest 5.0 schema.
// These cases reproduce each cause found in the rejected documents and assert
// the output now validates against the official XSD.

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

  // Remark belongs right after the prolog; insured after guarantor, with its attributes.
  const ordered = generateInvoiceXml(input({ remark: "Correction de la facture 1009001", insuredAddress: sampleAddresses.patient })).xmlContent;
  await assertValid("remark + insured", ordered);

  // Escaped characters count once against the limit.
  const amp = generateInvoiceXml(input({ insuranceAddress: { ...sampleAddresses.insurer, companyName: "Groupe Mutuel & Philos Assurances SA" } })).xmlContent;
  await assertValid("ampersand in a long name", amp);

  // The gate itself must catch a broken document.
  const broken = await validateInvoiceXml(tp.replace("<invoice:givenname> </invoice:givenname>", "<invoice:givenname></invoice:givenname>"));
  assert.equal(broken.valid, false);
  assert.ok(broken.errors.some((e) => e.startsWith("givenname:")), broken.errors.join(" | "));

  // What GET /api/medidata/schema-check runs in production.
  assert.deepEqual(await runInvoiceXmlSelfTest(), { ok: true, errors: [] });

  console.log("invoiceXmlSchema: all assertions passed");
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
