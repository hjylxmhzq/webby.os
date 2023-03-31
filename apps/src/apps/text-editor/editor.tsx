import React, { useEffect, useRef } from 'react';
import Cherry from 'cherry-markdown/dist/cherry-markdown.core';
import 'cherry-markdown/dist/cherry-markdown.css';


export default function TextEditor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const log = () => {
    if (editorRef.current) {
      console.log((editorRef.current as any).getContent());
    }
  };
  useEffect(() => {
    if (editorRef.current) {
      const cherryInstance = new Cherry({
        id: 'text-editor-container',
        value: '# welcome to cherry editor!',
      });
    }
  }, [])
  return (
    <>
      <div
        id="text-editor-container"
        ref={editorRef}
      ></div>
    </>
  );
}