'use client'

import {
  MDXEditor,
  type MDXEditorMethods,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  linkPlugin,
  linkDialogPlugin,
  tablePlugin,
  codeBlockPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  ListsToggle,
  BlockTypeSelect,
  CodeToggle,
  CreateLink,
  InsertCodeBlock,
  Separator,
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'

interface RichTextEditorProps {
  content: string
  onChange: (markdown: string) => void
  placeholder?: string
}

interface NoteSuggestion {
  id: string
  title: string
}

/**
 * RichTextEditor — MDX-based WYSIWYG editor using @mdxeditor/editor.
 *
 * Features:
 * - Inline formatting (bold/italic/underline) without typing **
 * - Headings, lists, quotes, code blocks, tables, links
 * - Outputs markdown (so storage and preview stay unchanged)
 * - [[wiki link]] autocomplete — dropdown of matching note titles
 * - Visual feedback for ::inline cards:: and {{c1::cloze}} via CSS overlay
 */
export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null)
  const [autocomplete, setAutocomplete] = useState<{
    open: boolean
    query: string
    suggestions: NoteSuggestion[]
    selected: number
    rect: { top: number; left: number } | null
    from: number
  }>({ open: false, query: '', suggestions: [], selected: 0, rect: null, from: -1 })

  // Sync external content changes (e.g., loading a note)
  useEffect(() => {
    if (editorRef.current && content !== editorRef.current.getMarkdown()) {
      editorRef.current.setMarkdown(content)
    }
  }, [content])

  // Debounced fetch of note suggestions for [[autocomplete]]
  useEffect(() => {
    if (!autocomplete.open) return
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const res = await api<{ notes: NoteSuggestion[] }>(
          `/api/notes?archived=false${autocomplete.query ? `&q=${encodeURIComponent(autocomplete.query)}` : ''}`
        )
        if (!cancelled) {
          setAutocomplete((prev) => ({ ...prev, suggestions: (res.notes ?? []).slice(0, 8), selected: 0 }))
        }
      } catch {
        if (!cancelled) setAutocomplete((prev) => ({ ...prev, suggestions: [] }))
      }
    }, 150)
    return () => { cancelled = true; clearTimeout(t) }
  }, [autocomplete.open, autocomplete.query])

  // Accept a suggestion: replace `[[query` with `[[title]]`
  const acceptSuggestion = useCallback((s: NoteSuggestion) => {
    const editor = editorRef.current
    if (!editor) return
    // The editor exposes getMarkdown / setMarkdown; we manipulate the raw markdown
    // to insert the [[title]] link. This is simpler than trying to use Lexical's
    // internal API through the MDXEditor wrapper.
    const md = editor.getMarkdown()
    // Find the last unclosed [[
    const lastOpen = md.lastIndexOf('[[')
    if (lastOpen === -1) return
    // Find the cursor position — we approximate by using the end of the query
    const before = md.slice(0, lastOpen)
    const after = md.slice(lastOpen + 2 + autocomplete.query.length)
    const newMd = `${before}[[${s.title}]]${after}`
    editor.setMarkdown(newMd)
    onChange(newMd)
    setAutocomplete((prev) => ({ ...prev, open: false }))
  }, [autocomplete.query, onChange])

  // Keyboard nav for autocomplete
  useEffect(() => {
    if (!autocomplete.open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setAutocomplete((prev) => ({ ...prev, selected: Math.min(prev.selected + 1, prev.suggestions.length - 1) }))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setAutocomplete((prev) => ({ ...prev, selected: Math.max(prev.selected - 1, 0) }))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        const s = autocomplete.suggestions[autocomplete.selected]
        if (s) {
          e.preventDefault()
          e.stopPropagation()
          acceptSuggestion(s)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setAutocomplete((prev) => ({ ...prev, open: false }))
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [autocomplete.open, autocomplete.suggestions, autocomplete.selected, acceptSuggestion])

  // Detect when user is typing inside [[...]] — monitor content changes
  const handleChange = useCallback((newMd: string) => {
    onChange(newMd)
    // Check if there's an unclosed [[ near the end
    const lastOpen = newMd.lastIndexOf('[[')
    if (lastOpen === -1) {
      setAutocomplete((prev) => (prev.open ? { ...prev, open: false } : prev))
      return
    }
    const afterOpen = newMd.slice(lastOpen + 2)
    // If there's a closing ]] after the last [[, the link is complete
    if (afterOpen.includes(']]')) {
      setAutocomplete((prev) => (prev.open ? { ...prev, open: false } : prev))
      return
    }
    // Don't allow newlines in the query
    if (afterOpen.includes('\n')) {
      setAutocomplete((prev) => (prev.open ? { ...prev, open: false } : prev))
      return
    }
    // We're inside [[... — show autocomplete
    const query = afterOpen
    // Compute dropdown position from the current selection
    let rect: { top: number; left: number } | null = null
    try {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0).cloneRange()
        const caretRect = range.getClientRects()[0]
        if (caretRect) {
          const container = document.querySelector('.rich-text-editor')
          const containerRect = container?.getBoundingClientRect()
          if (containerRect) {
            rect = { top: caretRect.bottom - containerRect.top + 4, left: caretRect.left - containerRect.left }
          }
        }
      }
    } catch {
      rect = null
    }
    setAutocomplete({ open: true, query, suggestions: [], selected: 0, rect, from: lastOpen })
  }, [onChange])

  return (
    <div className="rich-text-editor relative">
      <MDXEditor
        ref={editorRef}
        markdown={content}
        onChange={handleChange}
        placeholder={placeholder || 'Start writing…'}
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          tablePlugin(),
          codeBlockPlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <Separator />
                <BoldItalicUnderlineToggles />
                <Separator />
                <BlockTypeSelect />
                <ListsToggle />
                <Separator />
                <CodeToggle />
                <InsertCodeBlock />
                <CreateLink />
              </>
            ),
          }),
        ]}
        contentEditableClassName="prose-recall-content"
      />
      <style>{editorStyles}</style>

      {autocomplete.open && autocomplete.rect && (
        <div
          className="absolute z-50 max-h-72 w-72 overflow-y-auto rounded-xl border border-hairline bg-card-surface p-1 shadow-floating animate-scale-in scrollbar-thin"
          style={{ top: autocomplete.rect.top, left: autocomplete.rect.left }}
          role="listbox"
          aria-label="Note suggestions"
        >
          {autocomplete.suggestions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-recall">
              {autocomplete.query ? 'No matching notes' : 'Type to search notes…'}
            </div>
          ) : (
            autocomplete.suggestions.map((s, i) => (
              <button
                key={s.id}
                role="option"
                aria-selected={i === autocomplete.selected}
                onMouseEnter={() => setAutocomplete((prev) => ({ ...prev, selected: i }))}
                onMouseDown={(e) => { e.preventDefault(); acceptSuggestion(s) }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition',
                  i === autocomplete.selected
                    ? 'bg-accent-brand-dim text-accent-brand'
                    : 'text-secondary-recall hover:bg-accent-brand-dim hover:text-accent-brand'
                )}
              >
                <span className="truncate">{s.title || 'Untitled'}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

const editorStyles = `
  /* Override MDX editor's hardcoded light theme variables.
     The MDX editor sets --basePageBg: white in its CSS module class,
     which makes the editor background white even in dark mode.
     We override ALL the base variables to use the app's dark palette. */
  .rich-text-editor .mdxeditor {
    --basePageBg: var(--card-surface);
    --baseBase: var(--void);
    --baseBgSubtle: var(--card-surface);
    --baseBg: var(--void);
    --baseBgHover: var(--accent-brand-dim);
    --baseBgActive: var(--accent-brand-dim);
    --baseLine: var(--border-hairline);
    --baseBorder: var(--border-hairline);
    --baseBorderHover: var(--accent-brand);
    --baseSolid: var(--accent-brand);
    --baseSolidHover: var(--accent-brand);
    --baseText: var(--text-secondary);
    --baseTextContrast: var(--text-primary);
    --accentBase: var(--accent-brand-dim);
    --accentBgSubtle: var(--accent-brand-dim);
    --accentBg: var(--accent-brand-dim);
    --accentBgHover: var(--accent-brand-dim);
    --accentBgActive: var(--accent-brand-dim);
    --accentText: var(--accent-brand);
    --accentTextContrast: var(--accent-brand);
  }
  .rich-text-editor .mdxeditor {
    border: 1px solid var(--border-hairline);
    border-radius: 12px;
    background: var(--card-surface);
    overflow: hidden;
  }
  .rich-text-editor .mdxeditor [contenteditable] {
    min-height: 50vh;
    padding: 1rem 1.25rem;
    color: var(--text-secondary);
    font-size: 16px;
    line-height: 1.7;
    outline: none;
  }
  .rich-text-editor .mdxeditor [contenteditable] h1 {
    font-family: var(--font-space-grotesk);
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 1rem 0 0.5rem;
  }
  .rich-text-editor .mdxeditor [contenteditable] h2 {
    font-family: var(--font-space-grotesk);
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 1rem 0 0.5rem;
  }
  .rich-text-editor .mdxeditor [contenteditable] h3 {
    font-family: var(--font-space-grotesk);
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0.75rem 0 0.5rem;
  }
  .rich-text-editor .mdxeditor [contenteditable] p { margin: 0.5rem 0; }
  .rich-text-editor .mdxeditor [contenteditable] ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
  .rich-text-editor .mdxeditor [contenteditable] ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
  .rich-text-editor .mdxeditor [contenteditable] li { margin: 0.25rem 0; }
  .rich-text-editor .mdxeditor [contenteditable] blockquote {
    border-left: 3px solid var(--accent-brand);
    padding-left: 1rem;
    margin: 0.75rem 0;
    color: var(--text-muted);
    font-style: italic;
  }
  .rich-text-editor .mdxeditor [contenteditable] pre {
    background: var(--void);
    border: 1px solid var(--border-hairline);
    border-radius: 8px;
    padding: 1rem;
    overflow-x: auto;
    margin: 0.75rem 0;
    font-family: var(--font-jetbrains-mono);
    font-size: 0.875rem;
  }
  .rich-text-editor .mdxeditor [contenteditable] code {
    background: var(--void);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-family: var(--font-jetbrains-mono);
    font-size: 0.875rem;
    color: var(--accent-brand);
  }
  .rich-text-editor .mdxeditor [contenteditable] a {
    color: var(--accent-brand);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .rich-text-editor .mdxeditor [contenteditable] strong { color: var(--text-primary); font-weight: 600; }
  .rich-text-editor .mdxeditor-toolbar {
    background: var(--card-surface);
    border-bottom: 1px solid var(--border-hairline);
    padding: 0.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .rich-text-editor .mdxeditor-toolbar button {
    color: var(--text-secondary);
    padding: 0.375rem;
    border-radius: 6px;
    transition: all 0.15s;
  }
  .rich-text-editor .mdxeditor-toolbar button:hover {
    background: var(--void);
    color: var(--text-primary);
  }
  .rich-text-editor .mdxeditor-toolbar button[aria-pressed="true"],
  .rich-text-editor .mdxeditor-toolbar button.active {
    background: var(--accent-brand-dim);
    color: var(--accent-brand);
  }
`
