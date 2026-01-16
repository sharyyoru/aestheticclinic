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
  };

  // Save document with replaced placeholders
  const handleSave = async () => {
    if (!originalBlob) return;
    
    setIsSaving(true);
    try {
      // Replace placeholders in the original DOCX
      const modifiedBlob = await replacePlaceholdersInDocx(originalBlob, placeholders);
      await onSave(modifiedBlob);
    } catch (err) {
      console.error('Error saving document:', err);
      alert('Failed to save document');
    } finally {
      setIsSaving(false);
    }
  };

  // Replace placeholders in DOCX XML
  const replacePlaceholdersInDocx = async (
    blob: Blob,
    replacements: Map<string, string>
  ): Promise<Blob> => {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(blob);
    
    // Get document.xml
    const documentXml = await zip.file('word/document.xml')?.async('string');
    if (!documentXml) {
      throw new Error('Invalid DOCX file');
    }
    
    // Replace placeholders
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
    
    // Update the zip
    zip.file('word/document.xml', modifiedXml);
    
    // Generate new blob
    const newBlob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    
    return newBlob;
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
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
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
          <div
            ref={containerRef}
            className="mx-auto bg-white shadow-lg"
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
      `}</style>
    </div>
  );
}
