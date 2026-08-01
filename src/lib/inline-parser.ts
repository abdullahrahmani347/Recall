/**
 * Inline parsing for Recall's note content.
 *
 * Two syntaxes are supported in the markdown body:
 *
 * 1. Inline flashcards: `Term :: Definition`
 *    - Creates a basic flashcard with front=Term, back=Definition
 *    - One per line. The `::` separates front from back.
 *    - Example: "FSRS :: Free Spaced Repetition Scheduler"
 *
 * 2. Bidirectional links: `[[Note Title]]`
 *    - Creates a link to the note with that title (case-insensitive)
 *    - If the target note doesn't exist, it's created as a stub
 *    - Example: "This relates to [[Ebbinghaus forgetting curve]]"
 *
 * This module extracts these structures from markdown text so the
 * note save API can create/update Flashcard and NoteLink rows.
 */

export interface InlineCard {
  front: string
  back: string
  cardType?: 'basic' | 'cloze'
}

export interface InlineLink {
  targetTitle: string
}

/**
 * Extract inline flashcards from markdown content.
 * Two types:
 * 1. Basic: `Term :: Definition` — creates a basic front/back card
 * 2. Cloze: lines containing `{{c1::text}}` syntax — creates cloze deletion cards
 *    Each unique cloze number (c1, c2, c3...) becomes a separate card.
 */
export function extractInlineCards(markdown: string): InlineCard[] {
  const cards: InlineCard[] = []
  const lines = markdown.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // Check for cloze deletions first: {{c1::text}}, {{c2::text}}, etc.
    const clozeMatches = [...trimmed.matchAll(/\{\{c(\d+)::([^}]+)\}\}/g)]
    if (clozeMatches.length > 0) {
      // Get unique cloze numbers
      const clozeNumbers = [...new Set(clozeMatches.map((m) => m[1]))]
      // Create one card per cloze number
      for (const num of clozeNumbers) {
        cards.push({
          front: trimmed,
          back: num,
          cardType: 'cloze',
        })
      }
      continue // Skip basic card check for cloze lines
    }

    // Match "Term :: Definition" — the :: must have spaces around it
    // Skip lines that start with - (list items) unless they have ::
    const basicMatch = trimmed.match(/^(.+?)\s*::\s*(.+)$/)
    if (basicMatch && !trimmed.startsWith('-')) {
      const front = basicMatch[1].trim()
      const back = basicMatch[2].trim()
      if (front.length > 0 && front.length <= 5000 && back.length > 0 && back.length <= 5000) {
        cards.push({ front, back, cardType: 'basic' })
      }
    }
  }

  return cards
}

/**
 * Extract bidirectional links from markdown content.
 * Matches `[[Title]]` syntax. Titles are case-insensitive.
 */
export function extractLinks(markdown: string): InlineLink[] {
  const links: InlineLink[] = []
  const regex = /\[\[([^\]]+)\]\]/g
  let match

  while ((match = regex.exec(markdown)) !== null) {
    const title = match[1].trim()
    if (title.length > 0 && title.length <= 500) {
      links.push({ targetTitle: title })
    }
  }

  // Deduplicate by title (case-insensitive)
  const seen = new Set<string>()
  return links.filter((link) => {
    const key = link.targetTitle.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Check if a line contains an inline card (for editor highlighting).
 */
export function isInlineCardLine(line: string): boolean {
  return /^\s*.+?\s*::\s*.+\s*$/.test(line) && !line.trim().startsWith('#')
}

/**
 * Check if a line contains a wiki link (for editor highlighting).
 */
export function hasWikiLink(line: string): boolean {
  return /\[\[([^\]]+)\]\]/.test(line)
}

/**
 * Render markdown with wiki links converted to internal links.
 * Used by the markdown preview to make [[links]] clickable.
 */
export function renderWikiLinks(markdown: string): string {
  return markdown.replace(/\[\[([^\]]+)\]\]/g, (match, title) => {
    return `[${title}](#wiki:${encodeURIComponent(title)})`
  })
}
