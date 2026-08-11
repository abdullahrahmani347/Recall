'use client'

import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Extension, Mark } from '@tiptap/core'
import { Plugin, type EditorState } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { Node as PmNode } from 'prosemirror-model'
import { useEffect, useRef, useState } from 'react'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, List, ListOrdered, Quote, Code2,
  Link as LinkIcon, Undo2, Redo2, CheckSquare, Highlighter, Braces,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'

interface RichTextEditorProps {
  content: string
  onChange: (markdown: string) => void
  placeholder?: string
  hideToolbar?: boolean
}

export function RichTextEditor({ content, onChange, placeholder, hideToolbar }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-accent-brand underline underline-offset-2' } }),
      Placeholder.configure({ placeholder: placeholder || 'Start writing…' }),
      Underline,
      Highlight.configure({ multicolor: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      ClozeMark, InlineCardMark, WikiLinkMark, WikiLinkSuggestion,
    ],
    content: htmlFromMarkdown(content),
    onUpdate: ({ editor }) => onChange(markdownFromHtml(editor.getHTML())),
    editorProps: { attributes: { class: 'prose-recall min-h-[50vh] focus:outline-none text-base leading-relaxed' } },
  })

  useEffect(() => {
    if (editor && content !== markdownFromHtml(editor.getHTML())) {
      editor.commands.setContent(htmlFromMarkdown(content), { emitUpdate: false })
    }
  }, [content, editor])

  if (!editor) return null

  return (
    <div className="rich-text-editor relative">
      {!hideToolbar && <RichTextToolbar editor={editor} />}
      <div className="mt-3" />
      <EditorContent editor={editor} />
      <WikiLinkPopover editor={editor} />
      <style>{editorStyles}</style>
    </div>
  )
}

export function RichTextToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null
  const btn = (onClick: () => void, isActive: boolean, icon: React.ReactNode, label: string) => (
    <button type="button" onClick={onClick}
      className={cn('flex h-8 w-8 items-center justify-center rounded-md transition',
        isActive ? 'bg-accent-brand-dim text-accent-brand' : 'text-secondary-recall hover:bg-void hover:text-primary-recall')}
      aria-label={label} title={label}>{icon}</button>
  )
  return (
    <div className="flex items-center gap-1 rounded-xl border border-hairline bg-card-surface p-1.5">
      {btn(() => editor.chain().focus().undo().run(), false, <Undo2 className="h-4 w-4" />, 'Undo')}
      {btn(() => editor.chain().focus().redo().run(), false, <Redo2 className="h-4 w-4" />, 'Redo')}
      <span className="mx-1 h-5 w-px bg-hairline" />
      {btn(() => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }), <Heading1 className="h-4 w-4" />, 'H1')}
      {btn(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }), <Heading2 className="h-4 w-4" />, 'H2')}
      {btn(() => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), <Bold className="h-4 w-4" />, 'Bold')}
      {btn(() => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), <Italic className="h-4 w-4" />, 'Italic')}
      {btn(() => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'), <UnderlineIcon className="h-4 w-4" />, 'Underline')}
      {btn(() => editor.chain().focus().toggleStrike().run(), editor.isActive('strike'), <Strikethrough className="h-4 w-4" />, 'Strike')}
      {btn(() => editor.chain().focus().toggleHighlight().run(), editor.isActive('highlight'), <Highlighter className="h-4 w-4" />, 'Highlight')}
      {btn(() => {
        const sel = editor.state.selection
        const selected = editor.state.doc.textBetween(sel.from, sel.to) || 'cloze text'
        editor.chain().focus().insertContent(`{{c1::${selected}}}`).run()
      }, false, <Braces className="h-4 w-4" />, 'Cloze')}
      <span className="mx-1 h-5 w-px bg-hairline" />
      {btn(() => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'), <List className="h-4 w-4" />, 'Bullets')}
      {btn(() => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), <ListOrdered className="h-4 w-4" />, 'Numbers')}
      {btn(() => editor.chain().focus().toggleTaskList().run(), editor.isActive('taskList'), <CheckSquare className="h-4 w-4" />, 'Tasks')}
      {btn(() => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'), <Quote className="h-4 w-4" />, 'Quote')}
      {btn(() => editor.chain().focus().toggleCodeBlock().run(), editor.isActive('codeBlock'), <Code2 className="h-4 w-4" />, 'Code')}
      <span className="mx-1 h-5 w-px bg-hairline" />
      {btn(() => { const u = window.prompt('URL'); if (u) editor.chain().focus().setLink({ href: u }).run() }, editor.isActive('link'), <LinkIcon className="h-4 w-4" />, 'Link')}
    </div>
  )
}

const ClozeMark = Mark.create({ name: 'cloze', inclusive: false, parseHTML: () => [{ tag: 'span[data-cloze]' }], renderHTML: () => ['span', { 'data-cloze': '', class: 'cloze-mark' }, 0] })
const InlineCardMark = Mark.create({ name: 'inlineCard', inclusive: false, parseHTML: () => [{ tag: 'span[data-inline-card]' }], renderHTML: () => ['span', { 'data-inline-card': '', class: 'inline-card-mark' }, 0] })
const WikiLinkMark = Mark.create({ name: 'wikiLink', inclusive: false, parseHTML: () => [{ tag: 'span[data-wiki-link]' }], renderHTML: () => ['span', { 'data-wiki-link': '', class: 'wiki-link-mark' }, 0] })

const WikiLinkSuggestion = Extension.create({
  name: 'wikiLinkSuggestion',
  addProseMirrorPlugins() {
    const buildDecorations = (doc: PmNode): DecorationSet => {
      const decos: Decoration[] = []
      doc.descendants((node: any, pos: number) => {
        if (!node.isText || !node.text) return
        const text = node.text
        let m: RegExpExecArray | null
        const clozeRe = /\{\{c\d+::[^}]*\}\}/g
        while ((m = clozeRe.exec(text)) !== null) decos.push(Decoration.inline(pos + m.index, pos + m.index + m[0].length, { class: 'cloze-deco' }))
        const inlineRe = /::([^:\n]{2,80}?)::/g
        while ((m = inlineRe.exec(text)) !== null) decos.push(Decoration.inline(pos + m.index, pos + m.index + m[0].length, { class: 'inline-card-deco' }))
        const wikiRe = /\[\[([^\]\n]{1,120})\]\]/g
        while ((m = wikiRe.exec(text)) !== null) decos.push(Decoration.inline(pos + m.index, pos + m.index + m[0].length, { class: 'wiki-link-deco' }))
      })
      return DecorationSet.create(doc, decos)
    }
    return [new Plugin({
      state: { init: (_, state: EditorState) => buildDecorations(state.doc), apply: (tr: any) => buildDecorations(tr.doc) },
      props: { decorations: (state: EditorState) => buildDecorations(state.doc) },
    })]
  },
})

interface NoteSuggestion { id: string; title: string }

function WikiLinkPopover({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<NoteSuggestion[]>([])
  const [selected, setSelected] = useState(0)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const fromPosRef = useRef<number | null>(null)

  useEffect(() => {
    if (!editor) return
    const handler = () => {
      const { selection } = editor.state
      if (selection.empty) { if (open) setOpen(false); return }
      const $pos = selection.$head
      const textBefore = $pos.parent.textContent.slice(0, $pos.parentOffset)
      const openIdx = textBefore.lastIndexOf('[[')
      if (openIdx === -1) { if (open) setOpen(false); return }
      const afterOpen = textBefore.slice(openIdx + 2)
      if (afterOpen.includes(']]') || afterOpen.includes('\n')) { if (open) setOpen(false); return }
      setQuery(afterOpen)
      fromPosRef.current = $pos.start() + openIdx
      try {
        const c = editor.view.coordsAtPos(selection.from)
        const container = editor.view.dom.closest('.rich-text-editor')
        const rect = container?.getBoundingClientRect()
        if (rect) setCoords({ top: c.bottom - rect.top + 4, left: c.left - rect.left })
      } catch { setCoords(null) }
      setOpen(true)
    }
    editor.on('update', handler)
    editor.on('selectionUpdate', handler)
    return () => { editor.off('update', handler); editor.off('selectionUpdate', handler) }
  }, [editor, open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const res = await api<{ notes: NoteSuggestion[] }>(`/api/notes?archived=false${query ? `&q=${encodeURIComponent(query)}` : ''}`)
        if (!cancelled) { setSuggestions((res.notes ?? []).slice(0, 8)); setSelected(0) }
      } catch { if (!cancelled) setSuggestions([]) }
    }, 150)
    return () => { cancelled = true; clearTimeout(t) }
  }, [open, query])

  const accept = (s: NoteSuggestion) => {
    if (!editor || fromPosRef.current === null) return
    const from = fromPosRef.current
    const to = editor.state.selection.from
    editor.chain().focus().deleteRange({ from, to }).insertContent(`[[${s.title}]]`).run()
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, suggestions.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
      else if (e.key === 'Enter') { if (suggestions[selected]) { e.preventDefault(); e.stopPropagation(); accept(suggestions[selected]) } }
      else if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [open, suggestions, selected])

  if (!open || !coords) return null
  return (
    <div className="absolute z-50 max-h-72 w-72 overflow-y-auto rounded-xl border border-hairline bg-card-surface p-1 shadow-floating animate-scale-in scrollbar-thin"
      style={{ top: coords.top, left: coords.left }} role="listbox" aria-label="Note suggestions">
      {suggestions.length === 0 ? (
        <div className="px-3 py-2 text-xs text-muted-recall">{query ? 'No matching notes' : 'Type to search notes…'}</div>
      ) : suggestions.map((s, i) => (
        <button key={s.id} role="option" aria-selected={i === selected} onMouseEnter={() => setSelected(i)}
          onMouseDown={(e) => { e.preventDefault(); accept(s) }}
          className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition',
            i === selected ? 'bg-accent-brand-dim text-accent-brand' : 'text-secondary-recall hover:bg-void')}>
          <span className="truncate">{s.title || 'Untitled'}</span>
        </button>
      ))}
    </div>
  )
}

function htmlFromMarkdown(md: string): string {
  if (!md) return ''
  let html = md
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
  html = html.replace(/__(.+?)__/g, '<u>$1</u>').replace(/~~(.+?)~~/g, '<s>$1</s>')
  html = html.replace(/==(.+?)==/g, '<mark>$1</mark>').replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>').replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
  html = html.replace(/^- \[ \] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>$1</p></li></ul>')
  html = html.replace(/^- \[x\] (.+)$/gm, '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>$1</p></li></ul>')
  html = html.replace(/^- (.+)$/gm, '<ul><li>$1</li></ul>').replace(/^\d+\. (.+)$/gm, '<ol><li>$1</li></ol>')
  html = html.split(/\n\n+/).map(block => {
    if (block.match(/^<(h[1-6]|ul|ol|pre|blockquote)/)) return block
    if (block.trim() === '') return ''
    return `<p>${block.replace(/\n/g, '<br>')}</p>`
  }).join('')
  return html
}

function markdownFromHtml(html: string): string {
  if (!html) return ''
  let md = html
  md = md.replace(/<h1>(.*?)<\/h1>/g, '# $1\n').replace(/<h2>(.*?)<\/h2>/g, '## $1\n').replace(/<h3>(.*?)<\/h3>/g, '### $1\n')
  md = md.replace(/<strong>(.*?)<\/strong>/g, '**$1**').replace(/<b>(.*?)<\/b>/g, '**$1**')
  md = md.replace(/<em>(.*?)<\/em>/g, '*$1*').replace(/<i>(.*?)<\/i>/g, '*$1*')
  md = md.replace(/<u>(.*?)<\/u>/g, '__$1__').replace(/<s>(.*?)<\/s>/g, '~~$1~~').replace(/<del>(.*?)<\/del>/g, '~~$1~~')
  md = md.replace(/<mark>(.*?)<\/mark>/g, '==$1==').replace(/<code>(.*?)<\/code>/g, '`$1`')
  md = md.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, '```\n$1\n```')
  md = md.replace(/<a href="([^"]+)">(.*?)<\/a>/g, '[$2]($1)').replace(/<blockquote>(.*?)<\/blockquote>/g, '> $1\n')
  md = md.replace(/<li data-type="taskItem" data-checked="false"><p>(.*?)<\/p><\/li>/g, '- [ ] $1\n')
  md = md.replace(/<li data-type="taskItem" data-checked="true"><p>(.*?)<\/p><\/li>/g, '- [x] $1\n')
  md = md.replace(/<ul[^>]*>/g, '').replace(/<\/ul>/g, '').replace(/<ol[^>]*>/g, '').replace(/<\/ol>/g, '')
  md = md.replace(/<li><p>(.*?)<\/p><\/li>/g, '- $1\n').replace(/<li>(.*?)<\/li>/g, '- $1\n')
  md = md.replace(/<p>(.*?)<\/p>/g, '$1\n\n').replace(/<br>/g, '\n').replace(/<[^>]+>/g, '')
  md = md.replace(/\n{3,}/g, '\n\n').trim()
  return md
}

const editorStyles = `
  .prose-recall { color: var(--text-secondary); }
  .prose-recall h1 { font-family: var(--font-space-grotesk); font-size: 1.5rem; font-weight: 600; color: var(--text-primary); margin: 1rem 0 0.5rem; }
  .prose-recall h2 { font-family: var(--font-space-grotesk); font-size: 1.25rem; font-weight: 600; color: var(--text-primary); margin: 1rem 0 0.5rem; }
  .prose-recall h3 { font-family: var(--font-space-grotesk); font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin: 0.75rem 0 0.5rem; }
  .prose-recall p { margin: 0.5rem 0; line-height: 1.7; }
  .prose-recall ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
  .prose-recall ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
  .prose-recall li { margin: 0.25rem 0; }
  .prose-recall blockquote { border-left: 3px solid var(--accent-brand); padding-left: 1rem; margin: 0.75rem 0; color: var(--text-muted); font-style: italic; }
  .prose-recall pre { background: var(--void); border: 1px solid var(--border-hairline); border-radius: 8px; padding: 1rem; overflow-x: auto; margin: 0.75rem 0; font-family: var(--font-jetbrains-mono); font-size: 0.875rem; }
  .prose-recall code { background: var(--void); padding: 0.125rem 0.375rem; border-radius: 4px; font-family: var(--font-jetbrains-mono); font-size: 0.875rem; color: var(--accent-brand); }
  .prose-recall a { color: var(--accent-brand); text-decoration: underline; text-underline-offset: 2px; }
  .prose-recall mark { background: var(--accent-brand); color: var(--void); padding: 0.125rem 0.25rem; border-radius: 3px; }
  .prose-recall strong { color: var(--text-primary); font-weight: 600; }
  .prose-recall ul[data-type="taskList"] { list-style: none; padding-left: 0; }
  .prose-recall ul[data-type="taskList"] li { display: flex; gap: 0.5rem; align-items: start; }
  .prose-recall ul[data-type="taskList"] li label { margin-top: 0.25rem; }
  .prose-recall ul[data-type="taskList"] li div { flex: 1; }
  .prose-recall p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--text-muted); pointer-events: none; float: left; height: 0; }
  .cloze-deco { background: rgba(255, 184, 0, 0.18); border-bottom: 1px dashed rgba(255, 184, 0, 0.8); border-radius: 3px; padding: 0 2px; }
  .inline-card-deco { border-bottom: 2px solid #34E7A8; background: rgba(52, 231, 168, 0.08); border-radius: 2px; padding: 0 1px; }
  .wiki-link-deco { color: var(--accent-brand); background: rgba(76, 140, 255, 0.08); border-radius: 3px; padding: 0 2px; font-weight: 500; }
`
