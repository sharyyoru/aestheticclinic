"use client";

import { useRef, useCallback, useEffect } from "react";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write your content...",
  className = "",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  // Sync value prop to editor content
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value;
      }
    }
    isInternalChange.current = false;
  }, [value]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  }, [handleInput]);

  const handleBold = () => execCommand("bold");
  const handleItalic = () => execCommand("italic");
  const handleUnderline = () => execCommand("underline");
  const handleBulletList = () => execCommand("insertUnorderedList");
  const handleNumberedList = () => execCommand("insertOrderedList");

  const handleLink = () => {
    const url = prompt("Enter URL:", "https://");
    if (url) {
      execCommand("createLink", url);
    }
  };

  const handleColor = (color: string) => {
    execCommand("foreColor", color);
  };

  const handleHighlight = (color: string) => {
    execCommand("hiliteColor", color);
  };

  const colors = [
    { name: "Black", value: "#1e293b" },
    { name: "Red", value: "#dc2626" },
    { name: "Blue", value: "#2563eb" },
    { name: "Green", value: "#16a34a" },
    { name: "Orange", value: "#ea580c" },
    { name: "Purple", value: "#9333ea" },
  ];

  const highlightColors = [
    { name: "Yellow", value: "#fef08a" },
    { name: "Green", value: "#bbf7d0" },
    { name: "Blue", value: "#bfdbfe" },
    { name: "Pink", value: "#fbcfe8" },
    { name: "None", value: "transparent" },
  ];

  return (
    <div className={`rounded-lg border border-slate-200 bg-white ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50/80 px-2 py-1.5">
        {/* Bold */}
        <button
          type="button"
          onClick={handleBold}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          title="Bold (Ctrl+B)"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/>
          </svg>
        </button>

        {/* Italic */}
        <button
          type="button"
          onClick={handleItalic}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          title="Italic (Ctrl+I)"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/>
          </svg>
        </button>

        {/* Underline */}
        <button
          type="button"
          onClick={handleUnderline}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          title="Underline (Ctrl+U)"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/>
          </svg>
        </button>

        <div className="mx-1 h-5 w-px bg-slate-300" />

        {/* Bullet List */}
        <button
          type="button"
          onClick={handleBulletList}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          title="Bullet List"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/>
          </svg>
        </button>

        {/* Numbered List */}
        <button
          type="button"
          onClick={handleNumberedList}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          title="Numbered List"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/>
          </svg>
        </button>

        <div className="mx-1 h-5 w-px bg-slate-300" />

        {/* Link */}
        <button
          type="button"
          onClick={handleLink}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          title="Insert Link"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
          </svg>
        </button>

        <div className="mx-1 h-5 w-px bg-slate-300" />

        {/* Text Color Dropdown */}
        <div className="relative group">
          <button
            type="button"
            className="inline-flex h-7 items-center gap-0.5 rounded px-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            title="Text Color"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11 2L5.5 16h2.25l1.12-3h6.25l1.12 3h2.25L13 2h-2zm-1.38 9L12 4.67 14.38 11H9.62z"/>
            </svg>
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
          <div className="absolute left-0 top-full z-10 mt-1 hidden w-32 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg group-hover:block">
            <div className="grid grid-cols-3 gap-1">
              {colors.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => handleColor(color.value)}
                  className="h-6 w-6 rounded border border-slate-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Highlight Color Dropdown */}
        <div className="relative group">
          <button
            type="button"
            className="inline-flex h-7 items-center gap-0.5 rounded px-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            title="Highlight Color"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.59 2.34c-.22-.22-.58-.22-.8 0L12.7 4.43 9.21 .94c-.78-.78-2.05-.78-2.83 0L3.93 3.39c-.78.78-.78 2.05 0 2.83l3.49 3.49-2.09 2.09c-.22.22-.22.58 0 .8l.61.61-1.41 1.41 1.41 1.41 1.41-1.41.61.61c.22.22.58.22.8 0l2.09-2.09 3.49 3.49c.78.78 2.05.78 2.83 0l2.45-2.45c.78-.78.78-2.05 0-2.83l-3.49-3.49 2.09-2.09c.22-.22.22-.58 0-.8l-.61-.61 1.41-1.41-1.41-1.41-1.41 1.41-.61-.61zM6.36 4.8l2.45-2.45c.2-.2.51-.2.71 0l3.49 3.49-3.16 3.16L6.36 5.51c-.2-.2-.2-.51 0-.71zm8.49 12.69l-2.45 2.45c-.2.2-.51.2-.71 0L8.2 16.45l3.16-3.16 3.49 3.49c.2.2.2.51 0 .71z"/>
              <path d="M2 20h20v4H2z" opacity="0.5"/>
            </svg>
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
          <div className="absolute left-0 top-full z-10 mt-1 hidden w-32 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg group-hover:block">
            <div className="grid grid-cols-3 gap-1">
              {highlightColors.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => handleHighlight(color.value)}
                  className="h-6 w-6 rounded border border-slate-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color.value === "transparent" ? "#fff" : color.value }}
                  title={color.name}
                >
                  {color.value === "transparent" && (
                    <svg className="h-full w-full text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="min-h-[200px] px-3 py-2 text-xs text-slate-900 focus:outline-none [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_a]:text-sky-600 [&_a]:underline"
        style={{ whiteSpace: "pre-wrap" }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      {/* Placeholder styles */}
      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
