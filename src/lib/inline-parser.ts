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
}

export interface InlineLink {
  targetTitle: string
}

/**
 * Extract inline flashcards from markdown content.
 * Matches lines containing ` :: ` (with spaces) to avoid false positives
 * with URLs or code.
 */
export function extractInlineCards(markdown: string): InlineCard[] {
  const cards: InlineCard[] = []
  const lines = markdown.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue

    // Match "Term :: Definition" — the :: must have spaces around it
    const match = trimmed.match(/^(.+?)\s*::\s*(.+)$/)
    if (match) {
      const front = match[1].trim()
      const back = match[2].trim()
      if (front.length > 0 && front.length <= 5000 && back.length > 0 && back.length <= 5000) {
        cards.push({ front, back })
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
