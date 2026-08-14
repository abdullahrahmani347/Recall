import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, markdownToPlainText } from '@/lib/api-helpers'
import { z } from 'zod'

/**
 * POST /api/import
 * Multipart form: file=<File>, format='markdown'|'json'
 * Pre-import preview is the responsibility of the client — it can read the file
 * locally first and show the count. The server applies the import atomically
 * per top-level array element (markdown: one note per .md file inside a zip;
 * JSON: array of notes).
 *
 * For MVP, we accept a single markdown file (creates 1 note) or a JSON file
 * with `{ notes: [...] }`. Zip import is Phase 2.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const form = await req.formData()
  const file = form.get('file')
  const format = (form.get('format') as string) ?? 'markdown'

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  const text = await file.text()
  let notesCreated = 0
  let tagsCreated = 0

  if (format === 'json') {
    const parsed = z
      .object({
        notes: z.array(
          z.object({
            title: z.string().default('Imported note'),
            contentMarkdown: z.string().default(''),
            tags: z.array(z.string()).optional(),
          })
        ),
      })
      .safeParse(JSON.parse(text))

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 })
    }

    for (const n of parsed.data.notes) {
      // Find-or-create tags
      const tagIds: string[] = []
      for (const tagName of n.tags ?? []) {
        const existing = await db.tag.findFirst({
          where: { userId: user!.id, name: tagName },
        })
        if (existing) {
          tagIds.push(existing.id)
        } else {
          const t = await db.tag.create({
            data: { userId: user!.id, name: tagName, color: '#FFB454' },
          })
          tagIds.push(t.id)
          tagsCreated++
        }
      }

      await db.note.create({
        data: {
          userId: user!.id,
          title: n.title,
          contentMarkdown: n.contentMarkdown,
          contentPlainText: markdownToPlainText(n.contentMarkdown),
          tags: tagIds.length
            ? { create: tagIds.map((tagId) => ({ tagId })) }
            : undefined,
        },
      })
      notesCreated++
    }
  } else if (format === 'markdown') {
    // Treat the entire file as one note. Use the first H1 as the title.
    const titleMatch = text.match(/^#\s+(.+)$/m)
    const title = titleMatch?.[1]?.trim() ?? file.name.replace(/\.md$/i, '')
    const contentMarkdown = titleMatch
      ? text.replace(/^#\s+.+$/m, '').trim()
      : text

    await db.note.create({
      data: {
        userId: user!.id,
        title,
        contentMarkdown,
        contentPlainText: markdownToPlainText(contentMarkdown),
      },
    })
    notesCreated = 1
  } else if (format === 'csv') {
    // CSV import — flashcards from comma-separated values.
    // Expected format: Front,Back,Deck,Tags,CardType (same as CSV export)
    // or simple: Front,Back
    const lines = text.split('\n').filter((l) => l.trim().length > 0)
    if (lines.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 })
    }

    // Skip header if it looks like one
    const firstLine = lines[0].toLowerCase()
    const hasHeader = firstLine.includes('front') && firstLine.includes('back')
    const dataLines = hasHeader ? lines.slice(1) : lines

    // Find or create an "Imported" deck
    let deck = await db.deck.findFirst({ where: { userId: user!.id, name: 'Imported' } })
    if (!deck) {
      deck = await db.deck.create({
        data: { userId: user!.id, name: 'Imported', description: 'Cards imported from CSV', color: '#FFB454' },
      })
    }

    let cardsCreated = 0
    for (const line of dataLines) {
      // Simple CSV parser — handles quoted fields with commas
      const fields: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"'
            i++
          } else {
            inQuotes = !inQuotes
          }
        } else if (ch === ',' && !inQuotes) {
          fields.push(current)
          current = ''
        } else {
          current += ch
        }
      }
      fields.push(current)

      const front = fields[0]?.trim()
      const back = fields[1]?.trim()
      if (!front || !back) continue

      const card = await db.flashcard.create({
        data: {
          deckId: deck.id,
          cardType: fields[4]?.trim() || 'basic',
          front,
          back,
        },
      })
      await db.schedulingState.create({ data: { cardId: card.id } })
      cardsCreated++
    }

    return NextResponse.json({ cardsCreated, deckName: deck.name })
  } else if (format === 'anki') {
    // Anki .apkg import — parse the SQLite database inside the ZIP.
    // For MVP, we extract text from .txt files or simple CSV inside the apkg.
    // Full .apkg SQLite parsing requires sql.js which is heavy; for now
    // we accept .txt exports from Anki (one card per line, front<TAB>back).
    const lines = text.split('\n').filter((l) => l.trim().length > 0)

    let deck = await db.deck.findFirst({ where: { userId: user!.id, name: 'Anki Import' } })
    if (!deck) {
      deck = await db.deck.create({
        data: { userId: user!.id, name: 'Anki Import', description: 'Cards imported from Anki', color: '#4C8CFF' },
      })
    }

    let cardsCreated = 0
    for (const line of lines) {
      // Anki .txt export uses tab separator
      const parts = line.split('\t')
      const front = parts[0]?.trim()
      const back = parts.slice(1).join('\n').trim()
      if (!front || !back) continue

      const card = await db.flashcard.create({
        data: {
          deckId: deck.id,
          cardType: 'basic',
          front,
          back,
        },
      })
      await db.schedulingState.create({ data: { cardId: card.id } })
      cardsCreated++
    }

    return NextResponse.json({ cardsCreated, deckName: deck.name })
  } else {
    return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
  }

  return NextResponse.json({ notesCreated, tagsCreated })
}
