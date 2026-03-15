"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  name: string;
  label: string;
  initialHtml?: string | null;
  placeholder?: string;
  helpText?: string;
  minHeight?: number;
};

type Cmd =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'insertUnorderedList'
  | 'insertOrderedList'
  | 'indent'
  | 'outdent'
  | 'undo'
  | 'redo';

type ActiveState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  unordered: boolean;
  ordered: boolean;
};

const EMPTY_ACTIVE: ActiveState = {
  bold: false,
  italic: false,
  underline: false,
  unordered: false,
  ordered: false,
};

function safeInitialHtml(html?: string | null): string {
  const s = (html ?? '').toString();
  return s
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '')
    .trim();
}

function exec(cmd: Cmd) {
  try {
    // eslint-disable-next-line deprecation/deprecation
    document.execCommand(cmd);
  } catch {
    // ignore
  }
}

function execWithValue(command: string, value?: string) {
  try {
    // eslint-disable-next-line deprecation/deprecation
    document.execCommand(command, false, value);
  } catch {
    // ignore
  }
}

function execInsertHtml(html: string) {
  execWithValue('insertHTML', html);
}

function selectionInsideEditor(editor: HTMLDivElement | null): boolean {
  if (!editor) return false;
  const sel = typeof window !== 'undefined' ? window.getSelection() : null;
  if (!sel || sel.rangeCount === 0) return false;
  const anchor = sel.anchorNode;
  const focus = sel.focusNode;
  const containsAnchor = !!anchor && editor.contains(anchor);
  const containsFocus = !!focus && editor.contains(focus);
  return containsAnchor || containsFocus || document.activeElement === editor;
}

function selectionElement(editor: HTMLDivElement | null): Element | null {
  if (!editor) return null;
  const sel = typeof window !== 'undefined' ? window.getSelection() : null;
  if (!sel || sel.rangeCount === 0) return null;
  const anchor = sel.anchorNode;
  if (!anchor) return null;
  const el = anchor.nodeType === Node.ELEMENT_NODE ? (anchor as Element) : anchor.parentElement;
  return el && editor.contains(el) ? el : null;
}

function closestInside(editor: HTMLDivElement | null, el: Element | null, selector: string): Element | null {
  if (!editor || !el) return null;
  let cur: Element | null = el;
  while (cur && cur !== editor) {
    if (cur.matches(selector)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

export default function RichLegacyEditor({
  name,
  label,
  initialHtml,
  placeholder,
  helpText,
  minHeight = 160,
}: Props) {
  const initial = useMemo(() => safeInitialHtml(initialHtml), [initialHtml]);
  const [active, setActive] = useState<ActiveState>(EMPTY_ACTIVE);
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceValue, setSourceValue] = useState(initial);

  // Keep the editable region uncontrolled so React re-renders never stomp the user's typing.
  const ref = useRef<HTMLDivElement | null>(null);
  const hiddenRef = useRef<HTMLTextAreaElement | null>(null);
  const sourceRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingVisualHtmlRef = useRef<string | null>(null);

  const refreshActiveState = () => {
    if (sourceMode || !selectionInsideEditor(ref.current)) {
      setActive((prev) =>
        prev.bold || prev.italic || prev.underline || prev.unordered || prev.ordered ? EMPTY_ACTIVE : prev,
      );
      return;
    }

    const editor = ref.current;
    const el = selectionElement(editor);
    const next: ActiveState = {
      bold: !!closestInside(editor, el, 'b,strong'),
      italic: !!closestInside(editor, el, 'i,em'),
      underline: !!closestInside(editor, el, 'u'),
      unordered: !!closestInside(editor, el, 'ul'),
      ordered: !!closestInside(editor, el, 'ol'),
    };

    setActive((prev) =>
      prev.bold === next.bold &&
      prev.italic === next.italic &&
      prev.underline === next.underline &&
      prev.unordered === next.unordered &&
      prev.ordered === next.ordered
        ? prev
        : next,
    );
  };

  const syncHiddenFromDom = () => {
    const el = ref.current;
    if (!el || !hiddenRef.current) return;
    hiddenRef.current.value = el.innerHTML;
  };

  const syncAll = () => {
    syncHiddenFromDom();
    window.requestAnimationFrame(refreshActiveState);
  };

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initial || '';
    if (hiddenRef.current) hiddenRef.current.value = initial || '';
    setSourceValue(initial || '');
    setSourceMode(false);
    setActive(EMPTY_ACTIVE);
  }, [initial]);

  useEffect(() => {
    const onSelectionChange = () => refreshActiveState();
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceMode]);
  useEffect(() => {
    if (!sourceMode && ref.current && pendingVisualHtmlRef.current !== null) {
      ref.current.innerHTML = pendingVisualHtmlRef.current;
      pendingVisualHtmlRef.current = null;
      window.requestAnimationFrame(() => {
        focusEditor();
        refreshActiveState();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceMode]);

  const focusEditor = () => {
    ref.current?.focus();
  };

  const runCommand = (cmd: Cmd) => {
    if (sourceMode) return;
    exec(cmd);
    syncAll();
    focusEditor();
  };

  const insertLink = () => {
    if (sourceMode) return;
    const url = window.prompt('Link URL');
    if (!url) return;
    const trimmed = url.trim();
    const safe = /^\s*javascript:/i.test(trimmed) ? '#' : trimmed;
    execWithValue('createLink', safe);
    syncAll();
    focusEditor();
  };

  const onToolMouseDown = (e: React.MouseEvent, action: () => void) => {
    // Keep the selection/caret inside the editor. Using mousedown instead of click
    // avoids the toolbar taking focus and "eating" the next keypress.
    e.preventDefault();
    action();
  };

  const toggleSourceMode = () => {
    if (sourceMode) {
      const next = safeInitialHtml(sourceRef.current?.value ?? sourceValue);
      pendingVisualHtmlRef.current = next;
      if (hiddenRef.current) hiddenRef.current.value = next;
      setSourceValue(next);
      setSourceMode(false);
      return;
    }

    const current = ref.current?.innerHTML ?? hiddenRef.current?.value ?? '';
    setSourceValue(current);
    if (hiddenRef.current) hiddenRef.current.value = current;
    setSourceMode(true);
    setActive(EMPTY_ACTIVE);
    window.requestAnimationFrame(() => {
      sourceRef.current?.focus();
      if (sourceRef.current) {
        const len = sourceRef.current.value.length;
        sourceRef.current.setSelectionRange(len, len);
      }
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const wantsModifier = e.ctrlKey || e.metaKey;
    if (wantsModifier && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        runCommand('bold');
        return;
      }
      if (key === 'i') {
        e.preventDefault();
        runCommand('italic');
        return;
      }
      if (key === 'u') {
        e.preventDefault();
        runCommand('underline');
        return;
      }
    }

    const sel = window.getSelection();
    const anchor = sel?.anchorNode as Node | null;
    const element = anchor && anchor.nodeType === Node.ELEMENT_NODE
      ? (anchor as Element)
      : anchor?.parentElement ?? null;
    const inList = !!element?.closest?.('ul,ol,li');

    if (e.key === 'Tab' && inList) {
      e.preventDefault();
      runCommand(e.shiftKey ? 'outdent' : 'indent');
      return;
    }

    // Shift+Enter = soft line break. Enter = paragraph break.
    if (e.key === 'Enter') {
      if (inList) {
        if (e.shiftKey) {
          e.preventDefault();
          execInsertHtml('<br />');
          syncAll();
        }
        return;
      }

      e.preventDefault();
      if (e.shiftKey) {
        execInsertHtml('<br />');
      } else {
        execWithValue('defaultParagraphSeparator', 'div');
        try {
          // eslint-disable-next-line deprecation/deprecation
          const inserted = document.execCommand('insertParagraph');
          if (!inserted) execInsertHtml('<div><br /></div>');
        } catch {
          execInsertHtml('<div><br /></div>');
        }
      }
      syncAll();
    }
  };

  const buttonClass = (isActive = false, disabled = false) => {
    const out = ['rle-btn'];
    if (isActive) out.push('is-active');
    if (disabled) out.push('is-disabled');
    return out.join(' ');
  };

  const toolDisabled = sourceMode;

  return (
    <div className="rich-legacy-editor">
      <label className="legacy-label">{label}</label>

      <div className="rich-legacy-editor__shell">
        <div className="rich-legacy-editor__toolbar">
          <button
            type="button"
            className={buttonClass(active.bold, toolDisabled)}
            title="Bold (Ctrl/Cmd+B)"
            disabled={toolDisabled}
            onMouseDown={(e) => onToolMouseDown(e, () => runCommand('bold'))}
          >
            <span className="font-bold">B</span>
          </button>
          <button
            type="button"
            className={buttonClass(active.italic, toolDisabled)}
            title="Italic (Ctrl/Cmd+I)"
            disabled={toolDisabled}
            onMouseDown={(e) => onToolMouseDown(e, () => runCommand('italic'))}
          >
            <span className="italic">I</span>
          </button>
          <button
            type="button"
            className={buttonClass(active.underline, toolDisabled)}
            title="Underline (Ctrl/Cmd+U)"
            disabled={toolDisabled}
            onMouseDown={(e) => onToolMouseDown(e, () => runCommand('underline'))}
          >
            <span className="underline">U</span>
          </button>
          <div className="rle-sep" />
          <button
            type="button"
            className={buttonClass(active.unordered, toolDisabled)}
            title="Bulleted list"
            disabled={toolDisabled}
            onMouseDown={(e) => onToolMouseDown(e, () => runCommand('insertUnorderedList'))}
          >
            • List
          </button>
          <button
            type="button"
            className={buttonClass(active.ordered, toolDisabled)}
            title="Numbered list"
            disabled={toolDisabled}
            onMouseDown={(e) => onToolMouseDown(e, () => runCommand('insertOrderedList'))}
          >
            1.
          </button>
          <div className="rle-sep" />
          <button
            type="button"
            className={buttonClass(false, toolDisabled)}
            title="Indent (Tab in lists)"
            disabled={toolDisabled}
            onMouseDown={(e) => onToolMouseDown(e, () => runCommand('indent'))}
          >
            ↦
          </button>
          <button
            type="button"
            className={buttonClass(false, toolDisabled)}
            title="Outdent (Shift+Tab in lists)"
            disabled={toolDisabled}
            onMouseDown={(e) => onToolMouseDown(e, () => runCommand('outdent'))}
          >
            ↤
          </button>
          <div className="rle-sep" />
          <button
            type="button"
            className={buttonClass(false, toolDisabled)}
            title="Link"
            disabled={toolDisabled}
            onMouseDown={(e) => onToolMouseDown(e, insertLink)}
          >
            Link
          </button>
          <div className="rle-spacer" />
          <button
            type="button"
            className={buttonClass(sourceMode)}
            title="Toggle HTML source"
            onMouseDown={(e) => onToolMouseDown(e, toggleSourceMode)}
          >
            HTML
          </button>
          <button
            type="button"
            className={buttonClass(false, toolDisabled)}
            title="Undo"
            disabled={toolDisabled}
            onMouseDown={(e) => onToolMouseDown(e, () => runCommand('undo'))}
          >
            Undo
          </button>
          <button
            type="button"
            className={buttonClass(false, toolDisabled)}
            title="Redo"
            disabled={toolDisabled}
            onMouseDown={(e) => onToolMouseDown(e, () => runCommand('redo'))}
          >
            Redo
          </button>
        </div>

        {sourceMode ? (
          <textarea
            ref={sourceRef}
            className="rich-legacy-editor__source"
            style={{ minHeight }}
            value={sourceValue}
            onChange={(e) => {
              const next = e.target.value;
              setSourceValue(next);
              if (hiddenRef.current) hiddenRef.current.value = next;
            }}
            spellCheck={false}
          />
        ) : (
          <div
            ref={ref}
            className="rich-legacy-editor__content"
            contentEditable
            suppressContentEditableWarning
            data-placeholder={placeholder ?? ''}
            style={{ minHeight }}
            onInput={syncAll}
            onBlur={syncHiddenFromDom}
            onFocus={refreshActiveState}
            onKeyDown={onKeyDown}
            onKeyUp={refreshActiveState}
            onMouseUp={refreshActiveState}
          />
        )}
      </div>

      {/* Form value submitted to the server action */}
      <textarea ref={hiddenRef} name={name} defaultValue={initial} readOnly className="hidden" />

      {helpText ? <div className="mt-2 text-xs text-white/55">{helpText}</div> : null}
    </div>
  );
}
