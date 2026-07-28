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
  } else {
    return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
  }

  return NextResponse.json({ notesCreated, tagsCreated })
}
