/**
 * A synthetic invoice (no real patient) used to prove, in any environment,
 * that the native XML generator and the XSD validator both work. Shared by
 * the schema tests and GET /api/medidata/schema-check.
 */
import { generateInvoiceXml } from "@/lib/invoiceXmlNative";
import { validateInvoiceXml } from "@/lib/invoiceXsd";
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
} from "@/lib/sumexInvoice";

const clinic: InvoiceAddress = { companyName: "Aesthetics Clinic XT SA", street: "chemin Rieu 18", zip: "1208", city: "Genève", stateCode: "GE" };
// Whole name in one field -> empty given name (a cause of the Nov 2026 rejections).
const doctor: InvoiceAddress = { familyName: "Test Doctor", givenName: "", street: "chemin Rieu 18", zip: "1208", city: "Genève", stateCode: "GE" };
const patient: InvoiceAddress = { familyName: "Muster", givenName: "Anna", street: "Rue du Rhône 42", zip: "1204", city: "Genève", stateCode: "GE" };
// 37 characters; the schema allows 35.
const insurer: InvoiceAddress = { companyName: "Assura assurance maladie et accidents", street: "Avenue C.-F. Ramuz 70", zip: "1009", city: "Pully", stateCode: "VD" };

export function sampleInvoiceInput(overrides: Partial<SumexInvoiceInput> = {}): SumexInvoiceInput {
  return {
    language: 2,
    roleType: RoleType.Physician,
    placeType: PlaceType.Practice,
    tiersMode: TiersMode.Payant,
    invoiceId: "SELFTEST-1",
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

export const sampleAddresses = { patient, insurer };

/** Generate the Tiers Payant and Tiers Garant samples and validate both. */
export async function runInvoiceXmlSelfTest(): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  for (const [label, tiersMode] of [["TP", TiersMode.Payant], ["TG", TiersMode.Garant]] as const) {
    const r = await validateInvoiceXml(generateInvoiceXml(sampleInvoiceInput({ tiersMode })).xmlContent);
    errors.push(...r.errors.map((e) => `${label}: ${e}`));
  }
  return { ok: errors.length === 0, errors };
}
