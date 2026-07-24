import { readFile } from "fs/promises";
import JSZip from "jszip";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export interface PatientDataForTemplate {
  firstName?: string;
  lastName?: string;
  salutation?: string;
  birthdate?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  street?: string;
  streetNo?: string;
  zip?: string;
  city?: string;
  socialSecurityNumber?: string;
  insuranceCardNumber?: string;
  addressBlock?: string;
}

export interface UserDataForTemplate {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  streetAndNo?: string;
  zip?: string;
  city?: string;
  singleRowSpecializations?: string;
  zsr?: string;
  fax?: string;
  addressBlock?: string;
}

export interface MissingField {
  tag: string;
  placeholder: string;
}

function parseXml(xml: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Failed to parse DOCX XML");
  }
  return doc;
}

function serializeXml(doc: Document): string {
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}

function getTagValue(sdt: Element): string | null {
  const tag = sdt.getElementsByTagNameNS(W_NS, "tag")[0];
  if (!tag) return null;
  return tag.getAttributeNS(W_NS, "val") || tag.getAttribute("w:val") || null;
}

function getSdtText(sdt: Element): string {
  const content = sdt.getElementsByTagNameNS(W_NS, "sdtContent")[0];
  if (!content) return "";
  const textNodes = content.getElementsByTagNameNS(W_NS, "t");
  return Array.from(textNodes).map((t) => t.textContent || "").join("");
}

function setSdtText(sdt: Element, value: string, color?: string): void {
  const content = sdt.getElementsByTagNameNS(W_NS, "sdtContent")[0];
  if (!content) return;

  const existingRuns = content.getElementsByTagNameNS(W_NS, "r");
  const firstRun = existingRuns[0];

  let targetRun: Element;
  if (firstRun) {
    // Keep the first run's formatting and replace its text
    const existingT = firstRun.getElementsByTagNameNS(W_NS, "t")[0];
    if (existingT) {
      existingT.textContent = value;
      if (value.endsWith(" ") || value.startsWith(" ")) {
        existingT.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
      } else {
        existingT.removeAttributeNS("http://www.w3.org/XML/1998/namespace", "space");
      }
    } else {
      const t = firstRun.ownerDocument!.createElementNS(W_NS, "w:t");
      t.textContent = value;
      if (value.endsWith(" ") || value.startsWith(" ")) {
        t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
      }
      firstRun.appendChild(t);
    }

    // Remove extra runs but keep the first
    for (let i = 1; i < existingRuns.length; i++) {
      existingRuns[i].remove();
    }
    targetRun = firstRun;
  } else {
    // Create a new run with default formatting
    const doc = content.ownerDocument!;
    const r = doc.createElementNS(W_NS, "w:r");
    const t = doc.createElementNS(W_NS, "w:t");
    t.textContent = value;
    if (value.endsWith(" ") || value.startsWith(" ")) {
      t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
    }
    r.appendChild(t);
    content.appendChild(r);
    targetRun = r;
  }

  // Apply red color if requested
  if (color) {
    let rPr = targetRun.getElementsByTagNameNS(W_NS, "rPr")[0];
    const doc = targetRun.ownerDocument!;
    if (!rPr) {
      rPr = doc.createElementNS(W_NS, "w:rPr");
      targetRun.insertBefore(rPr, targetRun.firstChild);
    }
    let colorEl = rPr.getElementsByTagNameNS(W_NS, "color")[0];
    if (!colorEl) {
      colorEl = doc.createElementNS(W_NS, "w:color");
      rPr.appendChild(colorEl);
    }
    colorEl.setAttributeNS(W_NS, "w:val", color);
  }
}

function collectParagraphTextRuns(paragraph: Element): Element[] {
  const runs: Element[] = [];
  const children = paragraph.children;
  for (let i = 0; i < children.length; i++) {
    if (children[i].localName === "r") {
      runs.push(children[i]);
    }
  }
  return runs;
}

function getRunText(run: Element): string {
  const texts = run.getElementsByTagNameNS(W_NS, "t");
  return Array.from(texts).map((t) => t.textContent || "").join("");
}

function setRunText(run: Element, value: string): void {
  const texts = run.getElementsByTagNameNS(W_NS, "t");
  if (texts.length > 0) {
    texts[0].textContent = value;
    if (value.endsWith(" ") || value.startsWith(" ")) {
      texts[0].setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
    } else {
      texts[0].removeAttributeNS("http://www.w3.org/XML/1998/namespace", "space");
    }
    for (let i = 1; i < texts.length; i++) {
      texts[i].remove();
    }
  } else {
    const t = run.ownerDocument!.createElementNS(W_NS, "w:t");
    t.textContent = value;
    if (value.endsWith(" ") || value.startsWith(" ")) {
      t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
    }
    run.appendChild(t);
  }
}

/**
 * Clear a cloned run's visible content while preserving its formatting.
 *
 * A cloned run already contains <w:t> nodes. Keeping them and then appending
 * replacement text produces output such as "RJpatientInfo.firstName".
 */
function clearRunContent(run: Element): void {
  const children = Array.from(run.children);
  for (const child of children) {
    if (child.localName !== "rPr") {
      child.remove();
    }
  }
}

function createContentControl(doc: Document, tag: string, value: string, formatRun?: Element | null): Element {
  const sdt = doc.createElementNS(W_NS, "w:sdt");
  const sdtPr = doc.createElementNS(W_NS, "w:sdtPr");
  const tagEl = doc.createElementNS(W_NS, "w:tag");
  tagEl.setAttributeNS(W_NS, "w:val", tag);
  sdtPr.appendChild(tagEl);
  sdt.appendChild(sdtPr);

  const sdtContent = doc.createElementNS(W_NS, "w:sdtContent");
  let r: Element;
  if (formatRun) {
    r = formatRun.cloneNode(true) as Element;
    clearRunContent(r);
  } else {
    r = doc.createElementNS(W_NS, "w:r");
  }
  const t = doc.createElementNS(W_NS, "w:t");
  t.textContent = value;
  if (value.endsWith(" ") || value.startsWith(" ")) {
    t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
  }
  r.appendChild(t);
  sdtContent.appendChild(r);
  sdt.appendChild(sdtContent);
  return sdt;
}

function convertPlaceholdersToContentControls(xmlDoc: Document): void {
  const paragraphs = xmlDoc.getElementsByTagNameNS(W_NS, "p");
  for (let pi = 0; pi < paragraphs.length; pi++) {
    const paragraph = paragraphs[pi];
    const runs = collectParagraphTextRuns(paragraph);
    if (runs.length === 0) continue;

    const fullText = runs.map(getRunText).join("");
    // Some older Axenita templates use DateNaiss as an unwrapped merge token.
    // Normalize it to the canonical placeholder before processing the paragraph.
    const placeholderText = fullText.replace(/\bDateNaiss\b/g, "${patientInfo.birthdate}");
    if (!placeholderText.includes("${")) continue;

    const placeholderRegex = /\$\{([^}]+)\}/g;
    const parts: { type: "text" | "field"; value: string }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = placeholderRegex.exec(placeholderText)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", value: placeholderText.slice(lastIndex, match.index) });
      }
      parts.push({ type: "field", value: match[1] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < placeholderText.length) {
      parts.push({ type: "text", value: placeholderText.slice(lastIndex) });
    }

    const firstRun = runs[0];
    const doc = paragraph.ownerDocument!;

    runs.forEach((r) => r.remove());

    parts.forEach((part) => {
      if (part.type === "text") {
        if (!part.value) return;
        const run = firstRun.cloneNode(true) as Element;
        clearRunContent(run);
        setRunText(run, part.value);
        paragraph.appendChild(run);
      } else {
        const sdt = createContentControl(doc, part.value, part.value, firstRun);
        paragraph.appendChild(sdt);
      }
    });
  }
}

function findContentControls(xmlDoc: Document): Array<{ tag: string; value: string }> {
  const results: Array<{ tag: string; value: string }> = [];
  const sdts = xmlDoc.getElementsByTagNameNS(W_NS, "sdt");
  for (let i = 0; i < sdts.length; i++) {
    const sdt = sdts[i];
    const tag = getTagValue(sdt);
    if (!tag) continue;
    const value = getSdtText(sdt);
    results.push({ tag, value });
  }
  return results;
}

function normalizeFieldKey(key: string): string {
  return key.toLowerCase().replace(/[._]/g, "").replace(/^axenita:/, "").replace(/^documentrecipient/, "patientinfo");
}

function formatMissingPlaceholder(tag: string): string {
  const label = tag
    .replace(/^axenita:/i, "")
    .replace(/^documentrecipient/i, "Patient")
    .replace(/^patientinfo/i, "Patient")
    .replace(/^mandatorinfo/i, "Clinic")
    .replace(/\./g, " ");
  const clean = label
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return `[Missing: ${clean}]`;
}

function resolveFieldValue(
  key: string,
  patientData?: PatientDataForTemplate,
  userData?: UserDataForTemplate
): { value: string; missing: boolean } {
  const normalized = normalizeFieldKey(key);
  const today = new Date().toISOString().split("T")[0];
  const formatDate = (d: string | undefined) => {
    if (!d) return "";
    try {
      const date = new Date(d);
      if (Number.isNaN(date.getTime())) return d;
      return date.toLocaleDateString("fr-CH");
    } catch {
      return d;
    }
  };

  if (normalized === "currentdate" || key.toLowerCase() === "currentdate") {
    return { value: formatDate(today), missing: false };
  }

  const patientMap: Record<string, keyof PatientDataForTemplate> = {
    patientinfofirstname: "firstName",
    patientinfolastname: "lastName",
    patientinfosalutation: "salutation",
    patientinfobirthdate: "birthdate",
    patientinfobirthdateformatted: "birthdate",
    patientinfoemail: "email",
    patientinfophone: "phone",
    patientinfomobile: "mobile",
    patientinfostreet: "street",
    patientinfostreetno: "streetNo",
    patientinfozip: "zip",
    patientinfocity: "city",
    patientinfosocialsecuritynumber: "socialSecurityNumber",
    patientinfoinsurancecardnumber: "insuranceCardNumber",
    patientinfoaddressblock: "addressBlock",
    guarantorinfopatientinsurancenumber: "insuranceCardNumber",
  };

  if (normalized in patientMap && patientData) {
    const value = patientData[patientMap[normalized]];
    if (!value) return { value: "", missing: true };
    if ((normalized.includes("birthdate") || normalized.includes("date")) && value) {
      return { value: formatDate(value), missing: false };
    }
    return { value, missing: false };
  }

  const userMap: Record<string, keyof UserDataForTemplate> = {
    mandatorinfofirstname: "firstName",
    mandatorinfolastname: "lastName",
    mandatorinfofullname: "fullName",
    mandatorinfoemail: "email",
    mandatorinfophone: "phone",
    mandatorinfostreetandno: "streetAndNo",
    mandatorinfozip: "zip",
    mandatorinfocity: "city",
    mandatorinfosinglerowspecializations: "singleRowSpecializations",
    mandatorinfozsr: "zsr",
    mandatorinfofax: "fax",
    mandatorinfoaddressblock: "addressBlock",
  };

  if (normalized in userMap && userData) {
    const value = userData[userMap[normalized]];
    if (!value) return { value: "", missing: true };
    return { value, missing: false };
  }

  return { value: "", missing: true };
}

export async function substituteDocxTemplate(
  templateBuffer: Buffer,
  patientData?: PatientDataForTemplate,
  userData?: UserDataForTemplate
): Promise<{ buffer: Buffer; missingFields: MissingField[] }> {
  const zip = await JSZip.loadAsync(templateBuffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error("Invalid DOCX: word/document.xml not found");
  }

  const xml = await docFile.async("string");
  const xmlDoc = parseXml(xml);

  // Convert ${...} placeholders into content controls
  convertPlaceholdersToContentControls(xmlDoc);

  const controls = findContentControls(xmlDoc);
  const missingFields: MissingField[] = [];
  const seenTags = new Set<string>();

  for (const control of controls) {
    if (seenTags.has(control.tag)) continue;
    seenTags.add(control.tag);

    const resolved = resolveFieldValue(control.tag, patientData, userData);
    if (resolved.missing || !resolved.value) {
      const placeholder = formatMissingPlaceholder(control.tag);
      missingFields.push({ tag: control.tag, placeholder });
      // Update every occurrence of this tag with the red placeholder
      const sdts = xmlDoc.getElementsByTagNameNS(W_NS, "sdt");
      for (let i = 0; i < sdts.length; i++) {
        const sdt = sdts[i];
        const tag = getTagValue(sdt);
        if (tag === control.tag) {
          setSdtText(sdt, placeholder, "FF0000");
        }
      }
    } else {
      const sdts = xmlDoc.getElementsByTagNameNS(W_NS, "sdt");
      for (let i = 0; i < sdts.length; i++) {
        const sdt = sdts[i];
        const tag = getTagValue(sdt);
        if (tag === control.tag) {
          setSdtText(sdt, resolved.value);
        }
      }
    }
  }

  const modifiedXml = serializeXml(xmlDoc);
  zip.file("word/document.xml", modifiedXml);

  const outputBuffer = await zip.generateAsync({ type: "nodebuffer" });
  return { buffer: outputBuffer, missingFields };
}
