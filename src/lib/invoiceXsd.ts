/**
 * Validates a generalInvoiceRequest 5.0 document against the official XSD
 * (src/data/xsd/) before it is sent to MediData.
 *
 * MediData rejects a schema-invalid upload as INVALID_UPLOAD, hours later and
 * with no detail. Every native XML from 23 Oct to 17 Nov 2026 was rejected
 * that way, for reasons this check reports in milliseconds: an empty
 * <givenname>, a <companyname> over 35 characters, <diagnosis> outside
 * <treatment>. Validating here turns that into an immediate, specific error.
 *
 * Server-only (reads the schemas from disk). Uses libxml2 compiled to WASM,
 * so it needs no native binaries on Vercel.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const XSD_DIR = join(process.cwd(), "src", "data", "xsd");
const MAIN = "generalInvoiceRequest_500.xsd";
const IMPORTS = ["xmldsig-core-schema.xsd", "xenc-schema.xsd"];

type XsdFile = { fileName: string; contents: string };
let files: { schema: XsdFile[]; preload: XsdFile[] } | null = null;
function schemaFiles() {
  if (!files) {
    const read = (fileName: string) => ({ fileName, contents: readFileSync(join(XSD_DIR, fileName), "utf8") });
    files = { schema: [read(MAIN)], preload: IMPORTS.map(read) };
  }
  return files;
}

export type InvoiceXsdResult = { valid: boolean; errors: string[] };

/** libxml2 message -> "companyname: value has length 37, maximum is 35". */
function tidy(message: string): string {
  return message
    .replace(/^.*?Schemas validity error\s*:\s*/, "")
    .replace(/\{http:\/\/www\.forum-datenaustausch\.ch\/invoice\}/g, "")
    .replace(/^Element '([^']+)'(, attribute '([^']+)')?:\s*/, (_m, el, _a, attr) => (attr ? `${el}@${attr}: ` : `${el}: `))
    .trim();
}

export async function validateInvoiceXml(xml: string): Promise<InvoiceXsdResult> {
  const { validateXML } = await import("xmllint-wasm");
  const { schema, preload } = schemaFiles();
  const result = await validateXML({ xml: [{ fileName: "invoice.xml", contents: xml }], schema, preload });
  // Schema-parser warnings (duplicate imports) are not about the document.
  const errors = result.errors
    .map((e) => e.rawMessage || e.message || "")
    .filter((m) => !/parser warning/i.test(m))
    .map(tidy)
    .filter(Boolean);
  return { valid: result.valid, errors: [...new Set(errors)] };
}
