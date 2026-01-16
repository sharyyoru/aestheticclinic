"use client";

import React, { useCallback, useMemo, useState } from 'react';
import { createEditor, Descendant, Editor, Transforms, Element as SlateElement } from 'slate';
import { Slate, Editable, withReact, RenderElementProps, RenderLeafProps } from 'slate-react';
import { withHistory } from 'slate-history';
import { CustomElement, CustomText } from '@/lib/docx/types';
import Toolbar from './Toolbar';

interface DocxEditorProps {
  initialValue?: Descendant[];
  onChange?: (value: Descendant[]) => void;
  readOnly?: boolean;
}

const DocxEditor: React.FC<DocxEditorProps> = ({ 
  initialValue, 
  onChange,
  readOnly = false 
}) => {
  const [value, setValue] = useState<Descendant[]>(
    initialValue || [
      {
        type: 'paragraph',
        children: [{ text: '' }],
      },
    ]
  );

  const editor = useMemo(() => withHistory(withReact(createEditor())), []);

  const renderElement = useCallback((props: RenderElementProps) => {
    return <Element {...props} />;
  }, []);

  const renderLeaf = useCallback((props: RenderLeafProps) => {
    return <Leaf {...props} />;
  }, []);

  const handleChange = (newValue: Descendant[]) => {
    setValue(newValue);
    onChange?.(newValue);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <Slate editor={editor} initialValue={value} onChange={handleChange}>
        {!readOnly && <Toolbar />}
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-4xl mx-auto bg-white shadow-lg" style={{ minHeight: '11in', padding: '1in' }}>
            <Editable
              renderElement={renderElement}
              renderLeaf={renderLeaf}
              placeholder="Start typing..."
              spellCheck
              autoFocus
              readOnly={readOnly}
              className="outline-none"
            />
          </div>
        </div>
      </Slate>
    </div>
  );
};

// Element renderer
const Element = ({ attributes, children, element }: RenderElementProps) => {
  const style: React.CSSProperties = { 
    textAlign: 'align' in element ? element.align as any : undefined 
  };

  switch (element.type) {
    case 'heading-one':
      return (
        <h1 {...attributes} style={style} className="text-3xl font-bold mb-4">
          {children}
        </h1>
      );
    case 'heading-two':
      return (
        <h2 {...attributes} style={style} className="text-2xl font-bold mb-3">
          {children}
        </h2>
      );
    case 'heading-three':
      return (
        <h3 {...attributes} style={style} className="text-xl font-bold mb-2">
          {children}
        </h3>
      );
    case 'bulleted-list':
      return (
        <ul {...attributes} className="list-disc ml-6 mb-2">
          {children}
        </ul>
      );
    case 'numbered-list':
      return (
        <ol {...attributes} className="list-decimal ml-6 mb-2">
          {children}
        </ol>
      );
    case 'list-item':
      return (
        <li {...attributes} className="mb-1">
          {children}
        </li>
      );
    case 'table':
      return (
        <table {...attributes} className="border-collapse border border-gray-300 w-full mb-4">
          <tbody>{children}</tbody>
        </table>
      );
    case 'table-row':
      return <tr {...attributes}>{children}</tr>;
    case 'table-cell':
      return (
        <td {...attributes} className="border border-gray-300 p-2">
          {children}
        </td>
      );
    default:
      return (
        <p {...attributes} style={style} className="mb-2">
          {children}
        </p>
      );
  }
};

// Leaf renderer (for text formatting)
const Leaf = ({ attributes, children, leaf }: RenderLeafProps) => {
  let element = children;

  if (leaf.bold) {
    element = <strong>{element}</strong>;
  }

  if (leaf.italic) {
    element = <em>{element}</em>;
  }

  if (leaf.underline) {
    element = <u>{element}</u>;
  }

  return <span {...attributes}>{element}</span>;
};

export default DocxEditor;
