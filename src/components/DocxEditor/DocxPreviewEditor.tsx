"use client";

import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { supabaseClient } from '@/lib/supabaseClient';

interface PatientData {
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
  [key: string]: string | undefined;
}

interface UserData {
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
  [key: string]: string | undefined;
}

interface DocumentField {
  id: string;
  tag: string;
  label: string;
  value: string;
  type: 'text' | 'date';
  source: 'placeholder' | 'content-control';
}

interface DocxPreviewEditorProps {
  documentBlob: Blob;
  documentTitle: string;
  patientId: string;
  documentId: string;
  patientData?: PatientData;
  onSave: (blob: Blob) => Promise<void>;
  onClose: () => void;
}

/**
 * High-fidelity DOCX preview and editor
 * Uses docx-preview for 100% fidelity rendering
 * Preserves original DOCX structure for editing
 */

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const W15_NS = 'http://schemas.microsoft.com/office/word/2012/wordml';

async function readDocumentXml(blob: Blob): Promise<string | null> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(blob);
  const file = zip.file('word/document.xml');
  if (!file) return null;
  return file.async('string');
}

async function writeDocumentXml(blob: Blob, xml: string): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(blob);
  zip.file('word/document.xml', xml);
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

function parseXml(xml: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Failed to parse DOCX XML');
  }
  return doc;
}

function serializeXml(doc: Document): string {
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}

function getTagValue(sdt: Element): string | null {
  const tag = sdt.querySelector('sdtPr > tag');
  if (!tag) return null;
  return tag.getAttributeNS(W_NS, 'val') || tag.getAttribute('w:val') || null;
}

function getSdtText(sdt: Element): string {
  const content = sdt.querySelector('sdtContent');
  if (!content) return '';
  const textNodes = content.querySelectorAll('t');
  return Array.from(textNodes).map((t) => t.textContent || '').join('');
}

function setSdtText(sdt: Element, value: string): void {
  const content = sdt.querySelector('sdtContent');
  if (!content) return;
  const existingRuns = content.querySelectorAll('r');
  const firstRun = existingRuns[0];

  if (firstRun) {
    // Keep the first run's formatting and replace its text
    const existingT = firstRun.querySelector('t');
    if (existingT) {
      existingT.textContent = value;
      if (value.endsWith(' ') || value.startsWith(' ')) {
        existingT.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
      } else {
        existingT.removeAttributeNS('http://www.w3.org/XML/1998/namespace', 'space');
      }
    } else {
      const t = firstRun.ownerDocument!.createElementNS(W_NS, 'w:t');
      t.textContent = value;
      if (value.endsWith(' ') || value.startsWith(' ')) {
        t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
      }
      firstRun.appendChild(t);
    }
    // Remove any extra runs
    for (let i = 1; i < existingRuns.length; i++) {
      existingRuns[i].remove();
    }
  } else {
    // Create a new run with default formatting
    const doc = content.ownerDocument!;
    const r = doc.createElementNS(W_NS, 'w:r');
    const t = doc.createElementNS(W_NS, 'w:t');
    t.textContent = value;
    if (value.endsWith(' ') || value.startsWith(' ')) {
      t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    }
    r.appendChild(t);
    content.appendChild(r);
  }
}

function createContentControl(doc: Document, tag: string, value: string, formatRun?: Element | null): Element {
  const sdt = doc.createElementNS(W_NS, 'w:sdt');
  const sdtPr = doc.createElementNS(W_NS, 'w:sdtPr');
  const tagEl = doc.createElementNS(W_NS, 'w:tag');
  tagEl.setAttributeNS(W_NS, 'w:val', tag);
  sdtPr.appendChild(tagEl);
  sdt.appendChild(sdtPr);

  const sdtContent = doc.createElementNS(W_NS, 'w:sdtContent');
  let r: Element;
  if (formatRun) {
    r = formatRun.cloneNode(true) as Element;
    clearRunFormatting(r);
  } else {
    r = doc.createElementNS(W_NS, 'w:r');
  }
  const t = doc.createElementNS(W_NS, 'w:t');
  t.textContent = value;
  if (value.endsWith(' ') || value.startsWith(' ')) {
    t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
  }
  r.appendChild(t);
  sdtContent.appendChild(r);
  sdt.appendChild(sdtContent);
  return sdt;
}

interface ContentControlField {
  tag: string;
  value: string;
  originalValue: string;
}

function findContentControls(xmlDoc: Document): ContentControlField[] {
  const results: ContentControlField[] = [];
  const sdts = xmlDoc.getElementsByTagNameNS(W_NS, 'sdt');
  for (let i = 0; i < sdts.length; i++) {
    const sdt = sdts[i];
    const tag = getTagValue(sdt);
    if (!tag) continue;
    const value = getSdtText(sdt);
    results.push({ tag, value, originalValue: value });
  }
  return results;
}

function findPlaceholderRuns(parent: Element): Element[] {
  const runs = parent.getElementsByTagNameNS(W_NS, 'r');
  const matching: Element[] = [];
  for (let i = 0; i < runs.length; i++) {
    const textNodes = runs[i].getElementsByTagNameNS(W_NS, 't');
    for (let j = 0; j < textNodes.length; j++) {
      const text = textNodes[j].textContent || '';
      if (text.includes('${') || text.includes('}')) {
        matching.push(runs[i]);
        break;
      }
    }
  }
  return matching;
}

function collectParagraphTextRuns(paragraph: Element): Element[] {
  const runs: Element[] = [];
  const children = paragraph.children;
  for (let i = 0; i < children.length; i++) {
    if (children[i].localName === 'r') {
      runs.push(children[i]);
    }
  }
  return runs;
}

function getRunText(run: Element): string {
  const texts = run.getElementsByTagNameNS(W_NS, 't');
  return Array.from(texts).map((t) => t.textContent || '').join('');
}

function setRunText(run: Element, value: string): void {
  const texts = run.getElementsByTagNameNS(W_NS, 't');
  if (texts.length > 0) {
    texts[0].textContent = value;
    if (value.endsWith(' ') || value.startsWith(' ')) {
      texts[0].setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    } else {
      texts[0].removeAttributeNS('http://www.w3.org/XML/1998/namespace', 'space');
    }
    for (let i = 1; i < texts.length; i++) {
      texts[i].remove();
    }
  } else {
    const t = run.ownerDocument!.createElementNS(W_NS, 'w:t');
    t.textContent = value;
    if (value.endsWith(' ') || value.startsWith(' ')) {
      t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    }
    run.appendChild(t);
  }
}

function clearRunFormatting(run: Element): void {
  const children = Array.from(run.children);
  for (const child of children) {
    if (child.localName !== 't') {
      child.remove();
    }
  }
}

/**
 * Convert ${...} placeholders inside paragraphs into content controls.
 * Placeholders may be split across multiple <w:r> runs, so we scan each paragraph,
 * rebuild the full text, split on placeholders, and rewrite the runs.
 */
function convertPlaceholdersToContentControls(xmlDoc: Document): void {
  const paragraphs = xmlDoc.getElementsByTagNameNS(W_NS, 'p');
  for (let pi = 0; pi < paragraphs.length; pi++) {
    const paragraph = paragraphs[pi];
    const runs = collectParagraphTextRuns(paragraph);
    if (runs.length === 0) continue;

    const fullText = runs.map(getRunText).join('');
    if (!fullText.includes('${')) continue;

    const placeholderRegex = /\$\{([^}]+)\}/g;
    const parts: { type: 'text' | 'field'; value: string }[] = [];
    let lastIndex = 0;
    let match;
    while ((match = placeholderRegex.exec(fullText)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: fullText.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'field', value: match[1] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < fullText.length) {
      parts.push({ type: 'text', value: fullText.slice(lastIndex) });
    }

    // Reuse the first run's formatting for text parts and create content controls for fields
    const firstRun = runs[0];
    const doc = paragraph.ownerDocument!;

    // Clear all existing runs
    runs.forEach((r) => r.remove());

    parts.forEach((part) => {
      if (part.type === 'text') {
        if (!part.value) return;
        const run = firstRun.cloneNode(true) as Element;
        clearRunFormatting(run);
        setRunText(run, part.value);
        paragraph.appendChild(run);
      } else {
        const sdt = createContentControl(doc, part.value, part.value, firstRun);
        paragraph.appendChild(sdt);
      }
    });
  }
}

function updateContentControl(xmlDoc: Document, tag: string, value: string): boolean {
  const sdts = xmlDoc.getElementsByTagNameNS(W_NS, 'sdt');
  let found = false;
  for (let i = 0; i < sdts.length; i++) {
    const sdtTag = getTagValue(sdts[i]);
    if (sdtTag === tag) {
      setSdtText(sdts[i], value);
      found = true;
    }
  }
  return found;
}

function normalizeFieldKey(key: string): string {
  return key.toLowerCase().replace(/[._]/g, '').replace(/^axenita:/, '').replace(/^documentrecipient/, 'patientinfo');
}

function resolveFieldValue(
  key: string,
  patientData?: PatientData,
  userData?: UserData
): string {
  const normalized = normalizeFieldKey(key);
  const today = new Date().toISOString().split('T')[0];
  const formatDate = (d: string | undefined) => {
    if (!d) return '';
    try {
      const date = new Date(d);
      if (Number.isNaN(date.getTime())) return d;
      return date.toLocaleDateString('fr-CH');
    } catch {
      return d;
    }
  };

  if (normalized === 'currentdate' || key.toLowerCase() === 'currentdate') {
    return formatDate(today);
  }

  const patientMap: Record<string, keyof PatientData> = {
    patientinfofirstname: 'firstName',
    patientinfolastname: 'lastName',
    patientinfosalutation: 'salutation',
    patientinfobirthdate: 'birthdate',
    patientinfobirthdateformatted: 'birthdate',
    patientinfoemail: 'email',
    patientinfophone: 'phone',
    patientinfomobile: 'mobile',
    patientinfostreet: 'street',
    patientinfostreetno: 'streetNo',
    patientinfozip: 'zip',
    patientinfocity: 'city',
    patientinfosocialsecuritynumber: 'socialSecurityNumber',
    patientinfoinsurancecardnumber: 'insuranceCardNumber',
    patientinfoaddressblock: 'addressBlock',
  };

  if (normalized in patientMap && patientData) {
    const value = patientData[patientMap[normalized]];
    if ((normalized.includes('birthdate') || normalized.includes('date')) && value) {
      return formatDate(value);
    }
    return value || '';
  }

  const userMap: Record<string, keyof UserData> = {
    mandatorinfofirstname: 'firstName',
    mandatorinfolastname: 'lastName',
    mandatorinfofullname: 'fullName',
    mandatorinfoemail: 'email',
    mandatorinfophone: 'phone',
    mandatorinfostreetandno: 'streetAndNo',
    mandatorinfozip: 'zip',
    mandatorinfocity: 'city',
    mandatorinfosinglerowspecializations: 'singleRowSpecializations',
    mandatorinfozsr: 'zsr',
    mandatorinfofax: 'fax',
    mandatorinfoaddressblock: 'addressBlock',
  };

  if (normalized in userMap && userData) {
    return userData[userMap[normalized]] || '';
  }

  return '';
}

export default function DocxPreviewEditor({
  documentBlob,
  documentTitle,
  patientId,
  documentId,
  patientData,
  onSave,
  onClose,
}: DocxPreviewEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentFields, setDocumentFields] = useState<DocumentField[]>([]);
  const [workingBlob, setWorkingBlob] = useState<Blob | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [userData, setUserData] = useState<UserData>({});
  const originalTextRef = useRef<string>('');
  const textNodeMapRef = useRef<Map<number, string>>(new Map()); // Maps text index to original content
  
  // Formatting state
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
  });
  const [currentFontSize, setCurrentFontSize] = useState<string>('11');
  const [currentAlignment, setCurrentAlignment] = useState<string>('left');

  // Font size options (in points)
  const fontSizeOptions = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48', '72'];

  // Load current user data for mandator/clinic field mapping
  useEffect(() => {
    let mounted = true;
    supabaseClient.auth.getUser().then(({ data }) => {
      const user = data?.user;
      if (!user || !mounted) return;
      setUserData({
        firstName: user.user_metadata?.first_name || '',
        lastName: user.user_metadata?.last_name || '',
        fullName: user.user_metadata?.full_name || '',
        email: user.email || '',
        phone: user.user_metadata?.phone || '',
        streetAndNo: user.user_metadata?.street_and_no || '',
        zip: user.user_metadata?.zip || '',
        city: user.user_metadata?.city || '',
        singleRowSpecializations: user.user_metadata?.specializations || '',
        zsr: user.user_metadata?.zsr || '',
        fax: user.user_metadata?.fax || '',
        addressBlock: user.user_metadata?.address_block || '',
      });
    });
    return () => { mounted = false; };
  }, []);

  // Render DOCX preview after converting placeholders to content controls and resolving fields
  useEffect(() => {
    if (!containerRef.current || !documentBlob) return;

    let cancelled = false;

    async function prepareAndRender() {
      setIsLoading(true);
      setError(null);

      try {
        const xml = await readDocumentXml(documentBlob);
        if (!xml) throw new Error('Invalid DOCX file');

        const xmlDoc = parseXml(xml);

        // Convert ${...} placeholders into content controls so they persist and can be re-edited
        convertPlaceholdersToContentControls(xmlDoc);

        // Find all content controls (both original and converted)
        const controls = findContentControls(xmlDoc);

        // Build editable fields with resolved initial values (deduplicate by tag)
        const seenTags = new Set<string>();
        const fields: DocumentField[] = [];
        controls.forEach((control) => {
          if (seenTags.has(control.tag)) return;
          seenTags.add(control.tag);
          const resolved = resolveFieldValue(control.tag, patientData, userData);
          fields.push({
            id: control.tag,
            tag: control.tag,
            label: formatFieldLabel(control.tag),
            value: resolved || control.value,
            type: control.tag.toLowerCase().includes('date') ? 'date' : 'text',
            source: 'content-control',
          });
        });

        // Update content controls with resolved values
        controls.forEach((control) => {
          const resolved = resolveFieldValue(control.tag, patientData, userData);
          if (resolved) {
            updateContentControl(xmlDoc, control.tag, resolved);
          }
        });

        const modifiedXml = serializeXml(xmlDoc);
        const processedBlob = await writeDocumentXml(documentBlob, modifiedXml);

        if (cancelled) return;

        setWorkingBlob(processedBlob);
        setDocumentFields(fields);

        renderAsync(processedBlob, containerRef.current!, undefined, {
          className: 'docx-preview',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          experimental: true,
          trimXmlDeclaration: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        })
          .then(() => {
            if (cancelled) return;
            setIsLoading(false);
            if (containerRef.current) {
              originalTextRef.current = containerRef.current.innerText;
              markTextNodesWithIndices();
            }
          })
          .catch((err) => {
            if (cancelled) return;
            console.error('Error rendering DOCX:', err);
            setError('Failed to render document');
            setIsLoading(false);
          });
      } catch (err) {
        if (cancelled) return;
        console.error('Error preparing DOCX:', err);
        setError('Failed to prepare document');
        setIsLoading(false);
      }
    }

    prepareAndRender();

    return () => {
      cancelled = true;
    };
  }, [documentBlob, patientData, userData]);

  function formatFieldLabel(tag: string): string {
    // Convert axenita:documentRecipient.firstName or patientInfo.firstName into readable label
    const clean = tag
      .replace(/^axenita:/i, '')
      .replace(/^documentrecipient/i, 'Patient')
      .replace(/^patientinfo/i, 'Patient')
      .replace(/^mandatorinfo/i, 'Clinic')
      .replace(/\./g, ' ');
    return clean
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Handle document field value change
  const handleFieldChange = (fieldId: string, value: string) => {
    setDocumentFields((prev) =>
      prev.map((field) => (field.id === fieldId ? { ...field, value } : field))
    );
    setHasChanges(true);
  };

  // Handle content editing
  const handleContentChange = () => {
    if (containerRef.current) {
      const currentText = containerRef.current.innerText;
      if (currentText !== originalTextRef.current) {
        setHasChanges(true);
      }
    }
  };

  // Toggle edit mode - enable/disable contentEditable on individual text spans
  const toggleEditMode = () => {
    const newEditingState = !isEditing;
    setIsEditing(newEditingState);
    
    // Toggle contentEditable on all marked text spans
    if (containerRef.current) {
      const markedSpans = containerRef.current.querySelectorAll('span[data-docx-text-idx]');
      markedSpans.forEach(span => {
        const htmlSpan = span as HTMLElement;
        if (newEditingState) {
          htmlSpan.contentEditable = 'true';
          htmlSpan.style.outline = 'none';
          htmlSpan.style.minWidth = '2px'; // Ensure empty spans are still clickable
          
          // Add event listeners to prevent structural changes
          htmlSpan.addEventListener('keydown', handleSpanKeyDown);
          htmlSpan.addEventListener('input', handleSpanInput);
          htmlSpan.addEventListener('paste', handleSpanPaste);
        } else {
          htmlSpan.contentEditable = 'false';
          htmlSpan.removeEventListener('keydown', handleSpanKeyDown);
          htmlSpan.removeEventListener('input', handleSpanInput);
          htmlSpan.removeEventListener('paste', handleSpanPaste);
        }
      });
    }
  };

  // Handle Enter key to create line breaks (like Word) and formatting shortcuts
  const handleSpanKeyDown = (e: Event) => {
    const keyEvent = e as KeyboardEvent;
    
    // Handle formatting shortcuts (Ctrl/Cmd + B/I/U)
    if (keyEvent.ctrlKey || keyEvent.metaKey) {
      switch (keyEvent.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          applyFormat('bold');
          return;
        case 'i':
          e.preventDefault();
          applyFormat('italic');
          return;
        case 'u':
          e.preventDefault();
          applyFormat('underline');
          return;
      }
    }
    
    if (keyEvent.key === 'Enter') {
      e.preventDefault();
      
      // Insert a line break marker that we'll convert to a new paragraph when saving
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        
        // Create a line break element
        const br = document.createElement('br');
        range.insertNode(br);
        
        // Move cursor after the line break
        range.setStartAfter(br);
        range.setEndAfter(br);
        selection.removeAllRanges();
        selection.addRange(range);
        
        setHasChanges(true);
      }
    }
  };

  // Handle input changes on spans
  const handleSpanInput = () => {
    setHasChanges(true);
    updateActiveFormats();
  };

  // Update active formats based on current selection
  const updateActiveFormats = () => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
    });
  };

  // Apply formatting command
  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    updateActiveFormats();
    setHasChanges(true);
  };

  // Handle font size change
  const handleFontSizeChange = (size: string) => {
    setCurrentFontSize(size);
    // execCommand fontSize only accepts 1-7, so we use a workaround
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (!range.collapsed) {
        // Wrap selection in a span with font-size
        const span = document.createElement('span');
        span.style.fontSize = `${size}pt`;
        try {
          range.surroundContents(span);
          setHasChanges(true);
        } catch (e) {
          // If surroundContents fails (partial selection), use execCommand
          document.execCommand('fontSize', false, '7');
          // Then replace the font size
          const container = containerRef.current;
          if (container) {
            const fontElements = container.querySelectorAll('font[size="7"]');
            fontElements.forEach(el => {
              const htmlEl = el as HTMLElement;
              htmlEl.removeAttribute('size');
              htmlEl.style.fontSize = `${size}pt`;
            });
          }
          setHasChanges(true);
        }
      }
    }
  };

  // Handle alignment change  
  const handleAlignmentChange = (alignment: string) => {
    setCurrentAlignment(alignment);
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let parentEl = range.commonAncestorContainer as HTMLElement;
      if (parentEl.nodeType === Node.TEXT_NODE) {
        parentEl = parentEl.parentElement as HTMLElement;
      }
      // Find the paragraph or block-level parent
      while (parentEl && !['P', 'DIV', 'SECTION'].includes(parentEl.tagName)) {
        parentEl = parentEl.parentElement as HTMLElement;
      }
      if (parentEl) {
        parentEl.style.textAlign = alignment;
        setHasChanges(true);
      }
    }
  };

  // Track selection changes to update toolbar state
  useEffect(() => {
    const handleSelectionChange = () => {
      if (isEditing) {
        updateActiveFormats();
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [isEditing]);

  // Handle paste - preserve line breaks from pasted text
  const handleSpanPaste = (e: Event) => {
    e.preventDefault();
    const pasteEvent = e as ClipboardEvent;
    const text = pasteEvent.clipboardData?.getData('text/plain') || '';
    
    // Insert text with line breaks preserved
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      // Split by newlines and insert with <br> tags
      const lines = text.split(/\r?\n/);
      const fragment = document.createDocumentFragment();
      
      lines.forEach((line, index) => {
        if (index > 0) {
          fragment.appendChild(document.createElement('br'));
        }
        fragment.appendChild(document.createTextNode(line));
      });
      
      range.insertNode(fragment);
      
      // Move cursor to end
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    setHasChanges(true);
  };

  // Mark text nodes in the rendered HTML with indices that map to XML text nodes
  const markTextNodesWithIndices = () => {
    if (!containerRef.current) return;
    
    // First, remove any existing data-docx-text-idx attributes to ensure clean state
    const existingMarked = containerRef.current.querySelectorAll('[data-docx-text-idx]');
    existingMarked.forEach(el => el.removeAttribute('data-docx-text-idx'));
    
    // Find all text-containing spans in the docx-preview output
    // docx-preview creates spans for each text run
    let textIndex = 0;
    const textMap = new Map<number, string>();
    
    const walkTextNodes = (element: Element) => {
      const childNodes = Array.from(element.childNodes);
      
      // Check if this is a leaf span (contains text but no child spans)
      if (element.tagName === 'SPAN') {
        const hasChildSpans = element.querySelector('span') !== null;
        
        if (!hasChildSpans) {
          // This is a leaf span - mark it if it has text
          const text = element.textContent || '';
          if (text.length > 0) {
            (element as HTMLElement).setAttribute('data-docx-text-idx', String(textIndex));
            textMap.set(textIndex, text);
            textIndex++;
          }
          return; // Don't recurse further
        }
      }
      
      // Recurse into children
      childNodes.forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          walkTextNodes(child as Element);
        }
      });
    };
    
    walkTextNodes(containerRef.current);
    textNodeMapRef.current = textMap;
  };

  // Extract text from a span, converting <br> tags to newline markers
  const extractTextWithLineBreaks = (element: Element): string => {
    let result = '';
    const childNodes = element.childNodes;
    
    childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.tagName === 'BR') {
          result += '\n'; // Use newline as paragraph break marker
        } else {
          result += extractTextWithLineBreaks(el);
        }
      }
    });
    
    return result;
  };

  // Collect changes by querying spans with data-docx-text-idx (set during initial render)
  const collectChangesFromDOM = (): Map<number, string> => {
    const changes = new Map<number, string>();
    if (!containerRef.current) return changes;
    
    const mapSize = textNodeMapRef.current.size;
    
    // Query all spans that were marked during initial render
    const markedSpans = containerRef.current.querySelectorAll('span[data-docx-text-idx]');
    
    markedSpans.forEach(span => {
      const idx = parseInt(span.getAttribute('data-docx-text-idx') || '-1', 10);
      
      // Only process valid indices within the map range
      if (idx >= 0 && idx < mapSize) {
        // Extract text with line breaks preserved as \n
        const currentText = extractTextWithLineBreaks(span);
        const originalText = textNodeMapRef.current.get(idx) || '';
        
        if (currentText !== originalText) {
          changes.set(idx, currentText);
        }
      }
    });
    
    return changes;
  };

  // Save document with updated content controls and edited content
  const handleSave = async () => {
    if (!workingBlob) {
      console.error('[DocxEditor] No working blob to save');
      return;
    }

    setIsSaving(true);
    try {
      // Collect changes directly from live DOM (more reliable than parsing innerHTML)
      const domChanges = collectChangesFromDOM();

      // Apply content control field values and DOM changes in the working DOCX
      const modifiedBlob = await applyChangesToDocx(workingBlob, documentFields, domChanges);
      await onSave(modifiedBlob);
      setHasChanges(false);

      // Update working blob and text reference after save so re-editing continues from the saved state
      setWorkingBlob(modifiedBlob);
      if (containerRef.current) {
        originalTextRef.current = containerRef.current.innerText;
        const updatedSpans = containerRef.current.querySelectorAll('span[data-docx-text-idx]');
        updatedSpans.forEach(span => {
          const idx = parseInt(span.getAttribute('data-docx-text-idx') || '-1', 10);
          if (idx >= 0) {
            textNodeMapRef.current.set(idx, span.textContent || '');
          }
        });
      }
    } catch (err) {
      console.error('Error saving document:', err);
      alert('Failed to save document');
    } finally {
      setIsSaving(false);
    }
  };

  // Apply changes to DOCX XML: update content controls with field values, then apply DOM text edits
  const applyChangesToDocx = async (
    blob: Blob,
    fields: DocumentField[],
    changes: Map<number, string>
  ): Promise<Blob> => {
    const xml = await readDocumentXml(blob);
    if (!xml) throw new Error('Invalid DOCX file');

    const xmlDoc = parseXml(xml);

    // Update content controls with the latest field values
    for (const field of fields) {
      updateContentControl(xmlDoc, field.tag, field.value);
    }

    let modifiedXml = serializeXml(xmlDoc);

    // Apply direct text edits if any
    if (changes.size > 0) {
      modifiedXml = applyTextChangesToXml(modifiedXml, changes);
    }

    return writeDocumentXml(blob, modifiedXml);
  };
  
  // Helper function to insert line breaks into DOCX XML for a text node
  const insertLineBreaksIntoTextNode = (textNode: Element, newText: string, xmlDoc: Document) => {
    const nsUri = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    
    // Check if text contains line breaks
    if (!newText.includes('\n')) {
      // No line breaks - simple text replacement
      textNode.textContent = newText;
      return;
    }
    
    // Split text by line breaks
    const lines = newText.split('\n');
    
    // Get the parent run element (w:r)
    const runElement = textNode.parentElement;
    if (!runElement || runElement.localName !== 'r') {
      // Fallback: just set text without line breaks
      textNode.textContent = newText.replace(/\n/g, ' ');
      return;
    }
    
    // Set first line in the original text element
    textNode.textContent = lines[0];
    
    // Insert additional lines with <w:br/> breaks
    let insertAfter: Element = textNode;
    for (let i = 1; i < lines.length; i++) {
      // Create line break element <w:br/>
      const brElement = xmlDoc.createElementNS(nsUri, 'w:br');
      runElement.insertBefore(brElement, insertAfter.nextSibling);
      insertAfter = brElement;
      
      // Create new text element for the next line
      if (lines[i].length > 0) {
        const newTextElement = xmlDoc.createElementNS(nsUri, 'w:t');
        // Preserve spaces at start/end
        if (lines[i].startsWith(' ') || lines[i].endsWith(' ')) {
          newTextElement.setAttribute('xml:space', 'preserve');
        }
        newTextElement.textContent = lines[i];
        runElement.insertBefore(newTextElement, insertAfter.nextSibling);
        insertAfter = newTextElement;
      }
    }
  };

  // Apply text changes to XML using content-based matching with context for empty fields
  const applyTextChangesToXml = (originalXml: string, changes: Map<number, string>): string => {
    if (changes.size === 0) {
      return originalXml;
    }
    
    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(originalXml, 'application/xml');
    
    // Find all w:t elements
    const textElements = xmlDoc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 't');
    const xmlTextArray = Array.from(textElements);
    
    let updatedCount = 0;
    
    // Sort changes by index to process in order
    const sortedChanges = Array.from(changes.entries()).sort((a, b) => a[0] - b[0]);
    
    for (const [idx, newText] of sortedChanges) {
      const originalText = textNodeMapRef.current.get(idx) || '';
      
      // Skip if no actual change
      if (originalText === newText) continue;
      
      // Case 1: Original has content - use content-based matching
      if (originalText.trim().length > 0) {
        const matchingNodes = xmlTextArray.filter(el => el.textContent === originalText);
        
        if (matchingNodes.length === 1) {
          insertLineBreaksIntoTextNode(matchingNodes[0], newText, xmlDoc);
          updatedCount++;
        } else if (matchingNodes.length > 1 && originalText.length > 3) {
          insertLineBreaksIntoTextNode(matchingNodes[0], newText, xmlDoc);
          updatedCount++;
        }
      }
      // Case 2: Original is empty - user is adding text to an empty field
      // Use preceding text as context to find the right position
      else if (newText.trim().length > 0) {
        // Find the preceding non-empty text in our map
        let precedingText = '';
        let precedingIdx = -1;
        for (let i = idx - 1; i >= 0; i--) {
          const prevText = textNodeMapRef.current.get(i) || '';
          if (prevText.trim().length > 0) {
            precedingText = prevText;
            precedingIdx = i;
            break;
          }
        }
        
        if (precedingText) {
          
          let inserted = false;
          
          // Strategy 1: Look for exact match then find empty slot
          for (let i = 0; i < xmlTextArray.length && !inserted; i++) {
            if (xmlTextArray[i].textContent === precedingText) {
              // Look for the next empty or near-empty w:t element after this
              for (let j = i + 1; j < xmlTextArray.length && j <= i + 5; j++) {
                const nextEl = xmlTextArray[j];
                const nextText = nextEl.textContent || '';
                if (nextText.trim().length === 0) {
                  insertLineBreaksIntoTextNode(nextEl, newText, xmlDoc);
                  updatedCount++;
                  inserted = true;
                  break;
                }
              }
              
              // Strategy 2: If no empty slot, append to the preceding text with a space
              if (!inserted) {
                const combinedText = precedingText + ' ' + newText;
                insertLineBreaksIntoTextNode(xmlTextArray[i], combinedText, xmlDoc);
                updatedCount++;
                inserted = true;
              }
              break;
            }
          }
          
          // Strategy 3: Try partial/contains match if exact match failed
          if (!inserted) {
            for (let i = 0; i < xmlTextArray.length && !inserted; i++) {
              const xmlText = xmlTextArray[i].textContent || '';
              // Check if XML contains the end of our preceding text (for split text)
              if (xmlText.length > 3 && precedingText.includes(xmlText)) {
                const combinedText = xmlText + ' ' + newText;
                insertLineBreaksIntoTextNode(xmlTextArray[i], combinedText, xmlDoc);
                updatedCount++;
                inserted = true;
              }
            }
          }
          
        }
      }
    }
    
    // Serialize back to string
    const serializer = new XMLSerializer();
    return serializer.serializeToString(xmlDoc);
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">Error: {error}</div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold">{documentTitle}</h2>
        <div className="flex items-center gap-3">
          {/* Edit mode toggle */}
          <button
            onClick={toggleEditMode}
            className={`px-4 py-2 rounded flex items-center gap-2 transition-colors ${
              isEditing 
                ? 'bg-amber-500 text-white hover:bg-amber-600' 
                : 'bg-slate-600 text-white hover:bg-slate-500'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {isEditing ? 'Editing' : 'Edit'}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              hasChanges 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-blue-400 text-white/70 cursor-not-allowed'
            } disabled:opacity-50`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>

      {/* Formatting Toolbar - Google Docs style */}
      {isEditing && (
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center gap-1 shrink-0">
          {/* Undo */}
          <button
            onClick={() => document.execCommand('undo')}
            className="p-2 rounded hover:bg-slate-200 transition-colors text-slate-600"
            title="Undo (Ctrl+Z)"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
            </svg>
          </button>

          {/* Redo */}
          <button
            onClick={() => document.execCommand('redo')}
            className="p-2 rounded hover:bg-slate-200 transition-colors text-slate-600"
            title="Redo (Ctrl+Y)"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/>
            </svg>
          </button>

          <div className="w-px h-6 bg-slate-300 mx-2" />

          {/* Font Size Dropdown */}
          <div className="relative">
            <select
              value={currentFontSize}
              onChange={(e) => handleFontSizeChange(e.target.value)}
              className="appearance-none bg-white border border-slate-300 rounded px-3 py-1.5 pr-8 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent cursor-pointer"
            >
              {fontSizeOptions.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          <div className="w-px h-6 bg-slate-300 mx-2" />

          {/* Bold */}
          <button
            onClick={() => applyFormat('bold')}
            className={`p-2 rounded hover:bg-slate-200 transition-colors ${activeFormats.bold ? 'bg-slate-300 text-slate-900' : 'text-slate-600'}`}
            title="Bold (Ctrl+B)"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/>
            </svg>
          </button>

          {/* Italic */}
          <button
            onClick={() => applyFormat('italic')}
            className={`p-2 rounded hover:bg-slate-200 transition-colors ${activeFormats.italic ? 'bg-slate-300 text-slate-900' : 'text-slate-600'}`}
            title="Italic (Ctrl+I)"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/>
            </svg>
          </button>

          {/* Underline */}
          <button
            onClick={() => applyFormat('underline')}
            className={`p-2 rounded hover:bg-slate-200 transition-colors ${activeFormats.underline ? 'bg-slate-300 text-slate-900' : 'text-slate-600'}`}
            title="Underline (Ctrl+U)"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/>
            </svg>
          </button>

          <div className="w-px h-6 bg-slate-300 mx-2" />

          {/* Strikethrough */}
          <button
            onClick={() => applyFormat('strikeThrough')}
            className="p-2 rounded hover:bg-slate-200 transition-colors text-slate-600"
            title="Strikethrough"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z"/>
            </svg>
          </button>

          <div className="w-px h-6 bg-slate-300 mx-2" />

          {/* Align Left */}
          <button
            onClick={() => handleAlignmentChange('left')}
            className={`p-2 rounded hover:bg-slate-200 transition-colors ${currentAlignment === 'left' ? 'bg-slate-300 text-slate-900' : 'text-slate-600'}`}
            title="Align left"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z"/>
            </svg>
          </button>

          {/* Align Center */}
          <button
            onClick={() => handleAlignmentChange('center')}
            className={`p-2 rounded hover:bg-slate-200 transition-colors ${currentAlignment === 'center' ? 'bg-slate-300 text-slate-900' : 'text-slate-600'}`}
            title="Align center"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z"/>
            </svg>
          </button>

          {/* Align Right */}
          <button
            onClick={() => handleAlignmentChange('right')}
            className={`p-2 rounded hover:bg-slate-200 transition-colors ${currentAlignment === 'right' ? 'bg-slate-300 text-slate-900' : 'text-slate-600'}`}
            title="Align right"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z"/>
            </svg>
          </button>

          {/* Justify */}
          <button
            onClick={() => handleAlignmentChange('justify')}
            className={`p-2 rounded hover:bg-slate-200 transition-colors ${currentAlignment === 'justify' ? 'bg-slate-300 text-slate-900' : 'text-slate-600'}`}
            title="Justify"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V7H3v2zm0-6v2h18V3H3z"/>
            </svg>
          </button>

          <div className="w-px h-6 bg-slate-300 mx-2" />

          {/* Bullet List */}
          <button
            onClick={() => applyFormat('insertUnorderedList')}
            className="p-2 rounded hover:bg-slate-200 transition-colors text-slate-600"
            title="Bullet list"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/>
            </svg>
          </button>

          {/* Numbered List */}
          <button
            onClick={() => applyFormat('insertOrderedList')}
            className="p-2 rounded hover:bg-slate-200 transition-colors text-slate-600"
            title="Numbered list"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/>
            </svg>
          </button>

          <div className="w-px h-6 bg-slate-300 mx-2" />

          {/* Text Color */}
          <div className="relative group">
            <button
              className="p-2 rounded hover:bg-slate-200 transition-colors text-slate-600 flex items-center gap-0.5"
              title="Text color"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11 2L5.5 16h2.25l1.12-3h6.25l1.12 3h2.25L13 2h-2zm-1.38 9L12 4.67 14.38 11H9.62z"/>
              </svg>
              <div className="w-4 h-1 bg-red-500 rounded-full mt-0.5"></div>
            </button>
            <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 hidden group-hover:grid grid-cols-5 gap-1 z-50 w-32">
              {['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6fa8dc', '#8e7cc3', '#c27ba0', '#a64d79', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3d85c6', '#674ea7', '#a64d79', '#85200c', '#990000'].map(color => (
                <button
                  key={color}
                  onClick={() => applyFormat('foreColor', color)}
                  className="w-5 h-5 rounded border border-slate-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Highlight Color */}
          <div className="relative group">
            <button
              className="p-2 rounded hover:bg-slate-200 transition-colors text-slate-600 flex items-center gap-0.5"
              title="Highlight color"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.14 10.98l-1.41-1.41L5.61 17.7l1.41 1.41 8.12-8.13zm-5.26 5.26L8.47 14.83l-2.33 2.33 1.41 1.41 2.33-2.33zM17.3 6.67l-1.41-1.41-3.54 3.54 1.41 1.41 3.54-3.54zm1.41 1.42L21 5.79l-2.83-2.83-2.3 2.3 2.83 2.83z"/>
              </svg>
              <div className="w-4 h-1 bg-yellow-300 rounded-full mt-0.5"></div>
            </button>
            <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 hidden group-hover:grid grid-cols-5 gap-1 z-50 w-32">
              {['#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ff0000', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#cfe2f3', '#d9d2e9', '#ead1dc', '#f4cccc', '#fce5cd', '#ffffff'].map(color => (
                <button
                  key={color}
                  onClick={() => applyFormat('hiliteColor', color)}
                  className="w-5 h-5 rounded border border-slate-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          <div className="flex-1" />

          {/* Help text */}
          <span className="text-xs text-slate-500">Select text to format • Ctrl+B/I/U for quick formatting</span>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Document fields sidebar */}
        {documentFields.length > 0 && (
          <div className="w-80 bg-slate-50 border-r border-slate-200 p-4 overflow-y-auto shrink-0">
            <h3 className="font-semibold text-slate-700 mb-1">Fill in Fields</h3>
            <p className="text-xs text-slate-500 mb-3">
              {documentFields.length} field{documentFields.length > 1 ? 's' : ''} available
            </p>
            <div className="space-y-3">
              {documentFields.map((field) => {
                const isMultiline = field.value.includes('\n') || field.tag.toLowerCase().includes('addressblock') || field.tag.toLowerCase().includes('block');
                return (
                  <div key={field.id}>
                    <label className="block text-xs text-slate-500 mb-1">
                      {field.label}
                      <span className="ml-1 text-[10px] text-slate-400 font-mono">{field.tag}</span>
                    </label>
                    {isMultiline ? (
                      <textarea
                        value={field.value}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                        placeholder={field.label}
                      />
                    ) : (
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={field.label}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Document preview */}
        <div className="flex-1 overflow-auto bg-gray-100 p-8">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500" />
                <p className="text-slate-600">Loading document...</p>
              </div>
            </div>
          )}
          {/* Edit mode indicator */}
          {isEditing && !isLoading && (
            <div className="mb-4 mx-auto max-w-[850px] bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center gap-2 text-amber-800 text-sm">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span><strong>Edit Mode:</strong> Click text to edit • Use toolbar or <kbd className="px-1.5 py-0.5 bg-amber-100 rounded text-xs font-mono">Ctrl+B/I/U</kbd> to format • Press <kbd className="px-1.5 py-0.5 bg-amber-100 rounded text-xs font-mono">Enter</kbd> for new lines</span>
            </div>
          )}
          <div
            ref={containerRef}
            className={`mx-auto bg-white shadow-lg transition-all ${
              isEditing ? 'ring-2 ring-amber-400' : ''
            }`}
            style={{ 
              display: isLoading ? 'none' : 'block',
              maxWidth: '850px', // A4 width approximately
            }}
          />
        </div>
      </div>

      {/* Styles for docx-preview */}
      <style jsx global>{`
        .docx-preview {
          padding: 20px;
        }
        .docx-preview .docx-wrapper {
          background: white;
          padding: 40px;
        }
        .docx-preview .docx-wrapper > section.docx {
          margin-bottom: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        /* Editing styles for individual editable spans */
        span[contenteditable="true"] {
          cursor: text;
          border-bottom: 1px dashed rgba(251, 191, 36, 0.6);
        }
        span[contenteditable="true"]:hover {
          background-color: rgba(251, 191, 36, 0.15);
        }
        span[contenteditable="true"]:focus {
          background-color: rgba(251, 191, 36, 0.2);
          outline: none;
        }
      `}</style>
    </div>
  );
}
