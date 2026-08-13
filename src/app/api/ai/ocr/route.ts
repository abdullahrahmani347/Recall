import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import ZAI from 'z-ai-web-dev-sdk'
import { z } from 'zod'

const schema = z.object({
  image: z.string().min(1), // base64-encoded image
  title: z.string().optional(),
})

/**
 * POST /api/ai/ocr
 * Body: { image: base64-encoded-image, title?: string }
 *
 * Uses the z-ai-web-dev-sdk's VLM (Vision Language Model) capability
 * to extract text from a photo of a textbook page, whiteboard, or
 * handwritten notes. Creates a note with the extracted text.
 *
 * Returns { note: { id, title, contentMarkdown } }
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const settings = await db.settings.findUnique({ where: { userId: user!.id } })
  if (settings?.aiProcessingOptOut) {
    return NextResponse.json({ error: 'AI processing is disabled' }, { status: 403 })
  }

  try {
    const zai = await ZAI.create()
    const result = await zai.chat.completions.createVision({
      model: 'glm-4v',
      messages: [
        {
          role: 'system',
          content: 'You are an OCR assistant. Extract ALL text from the image exactly as written. Preserve headings, bullet points, and structure using markdown. If the text is handwritten, do your best to read it. Return ONLY the extracted text in markdown format, no explanations.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all text from this image as markdown.' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${parsed.data.image}` } },
          ],
        },
      ],
    })

    const extractedText = (result as any)?.choices?.[0]?.message?.content || (result as any)?.content || ''

    if (!extractedText || extractedText.trim().length < 5) {
      return NextResponse.json({ error: 'No text could be extracted from the image' }, { status: 422 })
    }

    // Auto-generate a title from the first line if not provided
    const firstLine = extractedText.split('\n').find((l) => l.trim().length > 0) || 'Scanned note'
    const title = parsed.data.title || firstLine.replace(/^#+\s*/, '').slice(0, 100)

    // Create the note
    const note = await db.note.create({
      data: {
        userId: user!.id,
        title,
        contentMarkdown: extractedText,
        contentPlainText: extractedText.replace(/[#*`>\-\[\]]/g, ''),
      },
    })

    return NextResponse.json({
      note: {
        id: note.id,
        title: note.title,
        contentMarkdown: note.contentMarkdown,
      },
    }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'OCR failed' },
      { status: 502 }
    )
  }
}
