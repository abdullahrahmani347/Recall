'use client'

import { useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { X, FileText, Book, Languages, Users, Clock } from 'lucide-react'

export interface NoteTemplate {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  content: string
}

export const BUILT_IN_TEMPLATES: NoteTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    icon: FileText,
    title: '',
    content: '',
  },
  {
    id: 'lecture',
    name: 'Lecture notes',
    icon: Clock,
    title: 'Lecture: ',
    content: `## Topic

## Key points
- 

## Questions
- 

## Summary
`,
  },
  {
    id: 'book',
    name: 'Book summary',
    icon: Book,
    title: '',
    content: `## Chapter

## Key takeaways
- 

## Quotes
> 

## Related concepts
- [[ ]]
`,
  },
  {
    id: 'vocabulary',
    name: 'Vocabulary',
    icon: Languages,
    title: '',
    content: `## Word

**Definition:** 

**Example:** 

**Etymology:** 

**Related:** [[ ]]
`,
  },
  {
    id: 'meeting',
    name: 'Meeting notes',
    icon: Users,
    title: 'Meeting: ',
    content: `## Attendees
- 

## Agenda
1. 

## Decisions
- 

## Action items
- [ ] 
`,
  },
]

interface TemplatePickerProps {
  onPick: (template: NoteTemplate) => void
  onClose: () => void
}

export function TemplatePicker({ onPick, onClose }: TemplatePickerProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl border border-hairline bg-card-surface p-5 shadow-panel animate-fade-in-up sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Choose a template"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">New note</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-recall hover:text-primary-recall"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-sm text-secondary-recall">
          Pick a template or start from blank.
        </p>
        <div className="grid gap-2">
          {BUILT_IN_TEMPLATES.map((template) => {
            const Icon = template.icon
            return (
              <button
                key={template.id}
                onClick={() => onPick(template)}
                className="flex items-center gap-3 rounded-xl border border-hairline bg-card-surface p-3 text-left transition-smooth press hover:border-accent-brand/50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-brand-dim text-accent-brand">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{template.name}</p>
                  {template.content && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-recall">
                      {template.content.split('\n').filter((l) => l.trim()).slice(0, 2).join(' · ')}
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
