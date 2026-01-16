"use client";

import React from 'react';
import { useSlate } from 'slate-react';
import { Editor, Transforms, Element as SlateElement } from 'slate';

const Toolbar: React.FC = () => {
  const editor = useSlate();

  return (
    <div className="border-b border-gray-200 bg-gray-50 p-2 flex flex-wrap gap-1">
      {/* Text formatting */}
      <ToolbarButton
        active={isMarkActive(editor, 'bold')}
        onMouseDown={(e) => {
          e.preventDefault();
          toggleMark(editor, 'bold');
        }}
      >
        <strong>B</strong>
      </ToolbarButton>

      <ToolbarButton
        active={isMarkActive(editor, 'italic')}
        onMouseDown={(e) => {
          e.preventDefault();
          toggleMark(editor, 'italic');
        }}
      >
        <em>I</em>
      </ToolbarButton>

      <ToolbarButton
        active={isMarkActive(editor, 'underline')}
        onMouseDown={(e) => {
          e.preventDefault();
          toggleMark(editor, 'underline');
        }}
      >
        <u>U</u>
      </ToolbarButton>

      <div className="w-px bg-gray-300 mx-1" />

      {/* Block types */}
      <ToolbarButton
        active={isBlockActive(editor, 'heading-one')}
        onMouseDown={(e) => {
          e.preventDefault();
          toggleBlock(editor, 'heading-one');
        }}
      >
        H1
      </ToolbarButton>

      <ToolbarButton
        active={isBlockActive(editor, 'heading-two')}
        onMouseDown={(e) => {
          e.preventDefault();
          toggleBlock(editor, 'heading-two');
        }}
      >
        H2
      </ToolbarButton>

      <ToolbarButton
        active={isBlockActive(editor, 'heading-three')}
        onMouseDown={(e) => {
          e.preventDefault();
          toggleBlock(editor, 'heading-three');
        }}
      >
        H3
      </ToolbarButton>

      <div className="w-px bg-gray-300 mx-1" />

      {/* Lists */}
      <ToolbarButton
        active={isBlockActive(editor, 'bulleted-list')}
        onMouseDown={(e) => {
          e.preventDefault();
          toggleBlock(editor, 'bulleted-list');
        }}
      >
        • List
      </ToolbarButton>

      <ToolbarButton
        active={isBlockActive(editor, 'numbered-list')}
        onMouseDown={(e) => {
          e.preventDefault();
          toggleBlock(editor, 'numbered-list');
        }}
      >
        1. List
      </ToolbarButton>

      <div className="w-px bg-gray-300 mx-1" />

      {/* Alignment */}
      <ToolbarButton
        active={isAlignActive(editor, 'left')}
        onMouseDown={(e) => {
          e.preventDefault();
          toggleAlign(editor, 'left');
        }}
      >
        ⬅
      </ToolbarButton>

      <ToolbarButton
        active={isAlignActive(editor, 'center')}
        onMouseDown={(e) => {
          e.preventDefault();
          toggleAlign(editor, 'center');
        }}
      >
        ↔
      </ToolbarButton>

      <ToolbarButton
        active={isAlignActive(editor, 'right')}
        onMouseDown={(e) => {
          e.preventDefault();
          toggleAlign(editor, 'right');
        }}
      >
        ➡
      </ToolbarButton>
    </div>
  );
};

// Toolbar button component
const ToolbarButton: React.FC<{
  active: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}> = ({ active, onMouseDown, children }) => {
  return (
    <button
      onMouseDown={onMouseDown}
      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
        active
          ? 'bg-blue-500 text-white'
          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
      }`}
    >
      {children}
    </button>
  );
};

// Helper functions
const isMarkActive = (editor: Editor, format: string) => {
  const marks = Editor.marks(editor) as any;
  return marks ? marks[format] === true : false;
};

const toggleMark = (editor: Editor, format: string) => {
  const isActive = isMarkActive(editor, format);
  if (isActive) {
    Editor.removeMark(editor, format);
  } else {
    Editor.addMark(editor, format, true);
  }
};

const isBlockActive = (editor: Editor, format: string) => {
  const { selection } = editor;
  if (!selection) return false;

  const [match] = Array.from(
    Editor.nodes(editor, {
      at: Editor.unhangRange(editor, selection),
      match: (n) =>
        !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === format,
    })
  );

  return !!match;
};

const toggleBlock = (editor: Editor, format: string) => {
  const isActive = isBlockActive(editor, format);
  const isList = ['numbered-list', 'bulleted-list'].includes(format);

  Transforms.unwrapNodes(editor, {
    match: (n) =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      ['numbered-list', 'bulleted-list'].includes(n.type),
    split: true,
  });

  const newProperties: Partial<SlateElement> = {
    type: (isActive ? 'paragraph' : isList ? 'list-item' : format) as any,
  };

  Transforms.setNodes<SlateElement>(editor, newProperties);

  if (!isActive && isList) {
    const block = { type: format, children: [] } as any;
    Transforms.wrapNodes(editor, block);
  }
};

const isAlignActive = (editor: Editor, align: string) => {
  const { selection } = editor;
  if (!selection) return false;

  const [match] = Array.from(
    Editor.nodes(editor, {
      at: Editor.unhangRange(editor, selection),
      match: (n) =>
        !Editor.isEditor(n) && SlateElement.isElement(n) && (n as any).align === align,
    })
  );

  return !!match;
};

const toggleAlign = (editor: Editor, align: string) => {
  const isActive = isAlignActive(editor, align);
  Transforms.setNodes(
    editor,
    { align: isActive ? undefined : align } as any,
    { match: (n) => Editor.isBlock(editor, n) }
  );
};

export default Toolbar;
