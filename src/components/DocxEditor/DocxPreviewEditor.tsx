"use client";

import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';

interface PatientData {
  firstName?: string;
  lastName?: string;
  salutation?: string;
  birthdate?: string;
  email?: string;
  phone?: string;
  [key: string]: string | undefined;
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
  const [placeholders, setPlaceholders] = useState<Map<string, string>>(new Map());
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const originalTextRef = useRef<string>('');
  const textNodeMapRef = useRef<Map<number, string>>(new Map()); // Maps text index to original content

  // Render DOCX preview
  useEffect(() => {
    if (!containerRef.current || !documentBlob) return;

    setIsLoading(true);
    setOriginalBlob(documentBlob);

    renderAsync(documentBlob, containerRef.current, undefined, {
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
        setIsLoading(false);
        // Extract placeholders from rendered content
        extractPlaceholders();
        // Store original text for comparison and mark text nodes with indices
        if (containerRef.current) {
          originalTextRef.current = containerRef.current.innerText;
          markTextNodesWithIndices();
        }
      })
      .catch((err) => {
        console.error('Error rendering DOCX:', err);
        setError('Failed to render document');
        setIsLoading(false);
      });
  }, [documentBlob]);

  // Extract placeholders and auto-fill with patient data
  const extractPlaceholders = () => {
    if (!containerRef.current) return;
    
    const content = containerRef.current.innerText;
    const placeholderRegex = /\$\{([^}]+)\}/g;
    const found = new Map<string, string>();
    
    let match;
    while ((match = placeholderRegex.exec(content)) !== null) {
      const placeholder = match[0];
      const fieldPath = match[1]; // e.g., "patientInfo.firstName"
      
      // Try to auto-fill from patient data
      let value = '';
      if (patientData && fieldPath.startsWith('patientInfo.')) {
        const fieldName = fieldPath.replace('patientInfo.', '');
        value = patientData[fieldName] || '';
      }
      
      found.set(placeholder, value);
    }
    
    setPlaceholders(found);
  };

  // Handle placeholder value change
  const handlePlaceholderChange = (placeholder: string, value: string) => {
    setPlaceholders(prev => {
      const newMap = new Map(prev);
      newMap.set(placeholder, value);
      return newMap;
    });
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

  // Prevent Enter key from creating new lines in spans
  const handleSpanKeyDown = (e: Event) => {
    const keyEvent = e as KeyboardEvent;
    if (keyEvent.key === 'Enter') {
      e.preventDefault();
    }
  };

  // Handle input changes on spans
  const handleSpanInput = () => {
    setHasChanges(true);
  };

  // Handle paste - strip formatting and prevent structural changes
  const handleSpanPaste = (e: Event) => {
    e.preventDefault();
    const pasteEvent = e as ClipboardEvent;
    const text = pasteEvent.clipboardData?.getData('text/plain') || '';
    // Remove newlines from pasted text
    const cleanText = text.replace(/[\r\n]+/g, ' ');
    document.execCommand('insertText', false, cleanText);
    setHasChanges(true);
  };

  // Mark text nodes in the rendered HTML with indices that map to XML text nodes
  const markTextNodesWithIndices = () => {
    if (!containerRef.current) return;
    
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
    console.log('[DocxEditor] Marked text nodes:', textIndex, 'Map size:', textMap.size);
  };

  // Collect changes from live DOM spans
  const collectChangesFromDOM = (): Map<number, string> => {
    const changes = new Map<number, string>();
    if (!containerRef.current) return changes;
    
    const liveSpans = containerRef.current.querySelectorAll('span[data-docx-text-idx]');
    console.log('[DocxEditor] Collecting changes from', liveSpans.length, 'live spans');
    
    liveSpans.forEach(span => {
      const idx = parseInt(span.getAttribute('data-docx-text-idx') || '-1', 10);
      if (idx >= 0) {
        const currentText = span.textContent || '';
        const originalText = textNodeMapRef.current.get(idx) || '';
        
        if (currentText !== originalText) {
          console.log(`[DocxEditor] Change at index ${idx}: "${originalText}" -> "${currentText}"`);
          changes.set(idx, currentText);
        }
      }
    });
    
    console.log('[DocxEditor] Total changes collected:', changes.size);
    return changes;
  };

  // Save document with replaced placeholders and edited content
  const handleSave = async () => {
    if (!originalBlob) return;
    
    setIsSaving(true);
    try {
      // Collect changes directly from live DOM (more reliable than parsing innerHTML)
      const domChanges = collectChangesFromDOM();
      
      console.log('[DocxEditor] Saving with hasChanges:', hasChanges, 'DOM changes:', domChanges.size);
      
      // Replace placeholders and apply DOM changes in the original DOCX
      const modifiedBlob = await applyChangesToDocx(originalBlob, placeholders, domChanges);
      await onSave(modifiedBlob);
      setHasChanges(false);
      
      // Update original text reference and text node map after save
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

  // Apply changes to DOCX XML using the changes map from DOM
  const applyChangesToDocx = async (
    blob: Blob,
    replacements: Map<string, string>,
    changes: Map<number, string>
  ): Promise<Blob> => {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(blob);
    
    // Get document.xml
    const documentXml = await zip.file('word/document.xml')?.async('string');
    if (!documentXml) {
      throw new Error('Invalid DOCX file');
    }
    
    // Replace placeholders first
    let modifiedXml = documentXml;
    replacements.forEach((value, placeholder) => {
      if (value) {
        // Escape XML special characters
        const escapedValue = value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
        
        modifiedXml = modifiedXml.split(placeholder).join(escapedValue);
      }
    });
    
    // Apply text changes if any
    if (changes.size > 0) {
      modifiedXml = applyTextChangesToXml(modifiedXml, changes);
    }
    
    // Update the zip
    zip.file('word/document.xml', modifiedXml);
    
    // Generate new blob
    const newBlob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    
    return newBlob;
  };
  
  // Apply text changes to XML using content-based matching
  // Instead of relying on index matching (which can fail due to docx-preview rendering differences),
  // we find XML text nodes by their original content and replace them
  const applyTextChangesToXml = (originalXml: string, changes: Map<number, string>): string => {
    // Build a map of original text -> new text for content-based matching
    const contentChanges = new Map<string, string>();
    changes.forEach((newText, idx) => {
      const originalText = textNodeMapRef.current.get(idx);
      if (originalText && originalText !== newText) {
        contentChanges.set(originalText, newText);
        console.log(`[DocxEditor] Content change: "${originalText}" -> "${newText}"`);
      }
    });
    
    if (contentChanges.size === 0) {
      console.log('[DocxEditor] No content changes to apply');
      return originalXml;
    }
    
    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(originalXml, 'application/xml');
    
    // Find all w:t elements (text runs in DOCX)
    const textElements = xmlDoc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 't');
    console.log('[DocxEditor] XML text elements found:', textElements.length);
    
    let updatedCount = 0;
    
    // For each XML text element, check if its content matches any of our changes
    for (let i = 0; i < textElements.length; i++) {
      const textEl = textElements[i];
      const text = textEl.textContent || '';
      
      if (contentChanges.has(text)) {
        const newText = contentChanges.get(text) || '';
        console.log(`[DocxEditor] Updating XML text: "${text}" -> "${newText}"`);
        textEl.textContent = newText;
        updatedCount++;
        // Remove from map to avoid double-updating if same text appears multiple times
        // (first match wins)
        contentChanges.delete(text);
      }
    }
    
    console.log(`[DocxEditor] Updated ${updatedCount} XML text nodes`);
    
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

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Placeholder editor sidebar */}
        {placeholders.size > 0 && (
          <div className="w-80 bg-slate-50 border-r border-slate-200 p-4 overflow-y-auto shrink-0">
            <h3 className="font-semibold text-slate-700 mb-3">Fill in Fields</h3>
            <div className="space-y-3">
              {Array.from(placeholders.entries()).map(([placeholder, value]) => (
                <div key={placeholder}>
                  <label className="block text-xs text-slate-500 mb-1">
                    {placeholder.replace(/\$\{|\}/g, '')}
                  </label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => handlePlaceholderChange(placeholder, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={placeholder}
                  />
                </div>
              ))}
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
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span><strong>Edit Mode:</strong> Click anywhere in the document to edit text directly. Changes are saved when you click Save.</span>
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
