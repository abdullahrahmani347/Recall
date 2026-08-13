import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import ZAI from 'z-ai-web-dev-sdk'
import { z } from 'zod'

const schema = z.object({
  image: z.string().min(1), // base64-encoded image (no data URL prefix)
  mimeType: z.string().optional(), // e.g. 'image/png', 'image/jpeg'
  title: z.string().optional(),
})

/**
 * POST /api/ai/ocr
 * Body: { image: base64-encoded-image, mimeType?: string, title?: string }
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

    // Detect image type from base64 header or use provided mimeType
    let mimeType = parsed.data.mimeType || 'image/jpeg'
    // Try to detect from the first bytes of the base64 data
    const header = parsed.data.image.slice(0, 4)
    if (header === '/9j/') mimeType = 'image/jpeg'
    else if (header === 'iVBOR') mimeType = 'image/png'
    else if (header === 'R0lG') mimeType = 'image/gif'
    else if (header === 'UklG') mimeType = 'image/webp'

    const dataUrl = `data:${mimeType};base64,${parsed.data.image}`

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
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    })

    const extractedText =
      (result as any)?.choices?.[0]?.message?.content ||
      (result as any)?.content ||
      (result as any)?.data?.content ||
      ''

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
    console.error('OCR error:', err)
    const message = err instanceof Error ? err.message : 'OCR failed'
    // Return more helpful error message
    if (message.includes('413') || message.includes('too large')) {
      return NextResponse.json(
        { error: 'Image too large. Please use a smaller image (max 5MB).' },
        { status: 413 }
      )
    }
    if (message.includes('400') || message.includes('invalid')) {
      return NextResponse.json(
        { error: 'Invalid image format. Please try a different image (PNG or JPG).' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
