import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import ZAI from 'z-ai-web-dev-sdk'
import { z } from 'zod'

const createSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(100).max(100000),
  sourceUrl: z.string().url().nullable().optional(),
})

/**
 * POST /api/articles
 * Body: { title, content, sourceUrl? }
 *
 * Creates an article and uses the LLM to split it into readable sections.
 * Each section has a heading + content. The LLM identifies natural
 * section boundaries (headings, topic shifts, paragraph clusters).
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const { title, content, sourceUrl } = parsed.data

  // Create the article first
  const article = await db.article.create({
    data: {
      userId: user!.id,
      title,
      rawContent: content,
      sourceUrl: sourceUrl ?? null,
    },
  })

  // Use LLM to split into sections
  const settings = await db.settings.findUnique({ where: { userId: user!.id } })
  if (settings?.aiProcessingOptOut) {
    // Fallback: split by existing headings or every 3 paragraphs
    const sections = splitIntoSectionsFallback(content)
    for (let i = 0; i < sections.length; i++) {
      await db.articleSection.create({
        data: {
          articleId: article.id,
          order: i,
          heading: sections[i].heading,
          content: sections[i].content,
        },
      })
    }
    return NextResponse.json({ article, sectionsCreated: sections.length }, { status: 201 })
  }

  try {
    const zai = await ZAI.create()
    const prompt = `Split this article into readable sections. Each section should be a coherent topic unit (2-5 paragraphs). Return ONLY a JSON array of { "heading": string, "content": string }.

Article title: ${title}

Article content:
${content.slice(0, 12000)}`

    const completion = (await zai.chat.completions.create({
      model: 'glm-4-flash',
      messages: [
        { role: 'system', content: 'You are a text processor. Output only valid JSON arrays.' },
        { role: 'user', content: prompt },
      ],
      stream: false,
    })) as { choices: { message: { content: string } }[] }

    const raw = completion.choices?.[0]?.message?.content ?? ''
    const sections = parseSections(raw)

    if (sections.length === 0) {
      // Fallback
      const fallback = splitIntoSectionsFallback(content)
      for (let i = 0; i < fallback.length; i++) {
        await db.articleSection.create({
          data: {
            articleId: article.id,
            order: i,
            heading: fallback[i].heading,
            content: fallback[i].content,
          },
        })
      }
    } else {
      for (let i = 0; i < sections.length; i++) {
        await db.articleSection.create({
          data: {
            articleId: article.id,
            order: i,
            heading: sections[i].heading,
            content: sections[i].content,
          },
        })
      }
    }

    return NextResponse.json({ article, sectionsCreated: sections.length || 0 }, { status: 201 })
  } catch (err) {
    // Fallback on error
    const fallback = splitIntoSectionsFallback(content)
    for (let i = 0; i < fallback.length; i++) {
      await db.articleSection.create({
        data: {
          articleId: article.id,
          order: i,
          heading: fallback[i].heading,
          content: fallback[i].content,
        },
      })
    }
    return NextResponse.json({ article, sectionsCreated: fallback.length }, { status: 201 })
  }
}

/**
 * GET /api/articles
 * Lists all articles for the user with section/highlight counts.
 */
export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  const articles = await db.article.findMany({
    where: { userId: user!.id },
    include: {
      _count: {
        select: { sections: true },
      },
      sections: {
        select: { id: true, isRead: true, _count: { select: { highlights: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    articles: articles.map((a) => {
      const totalSections = a.sections.length
      const readSections = a.sections.filter((s) => s.isRead).length
      const totalHighlights = a.sections.reduce((sum, s) => sum + s._count.highlights, 0)
      return {
        id: a.id,
        title: a.title,
        sourceUrl: a.sourceUrl,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        totalSections,
        readSections,
        totalHighlights,
        progress: totalSections > 0 ? Math.round((readSections / totalSections) * 100) : 0,
      }
    }),
  })
}

function parseSections(raw: string): { heading: string; content: string }[] {
  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) text = fence[1].trim()
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1) return []
  try {
    const arr = JSON.parse(text.slice(start, end + 1))
    if (!Array.isArray(arr)) return []
    return arr
      .filter((x): x is { heading: string; content: string } =>
        typeof x === 'object' && x !== null &&
        typeof x.heading === 'string' && typeof x.content === 'string'
      )
      .map((x) => ({ heading: x.heading.slice(0, 200), content: x.content.slice(0, 10000) }))
  } catch {
    return []
  }
}

function splitIntoSectionsFallback(content: string): { heading: string; content: string }[] {
  const lines = content.split('\n')
  const sections: { heading: string; content: string }[] = []
  let currentHeading = 'Introduction'
  let currentContent: string[] = []

  for (const line of lines) {
    if (line.startsWith('# ')) {
      if (currentContent.length > 0) {
        sections.push({ heading: currentHeading, content: currentContent.join('\n') })
      }
      currentHeading = line.replace(/^#+\s*/, '')
      currentContent = []
    } else {
      currentContent.push(line)
    }
  }
  if (currentContent.length > 0) {
    sections.push({ heading: currentHeading, content: currentContent.join('\n') })
  }

  if (sections.length === 0) {
    // Split by double newlines into chunks of ~3 paragraphs
    const paragraphs = content.split(/\n\n+/)
    for (let i = 0; i < paragraphs.length; i += 3) {
      sections.push({
        heading: `Section ${sections.length + 1}`,
        content: paragraphs.slice(i, i + 3).join('\n\n'),
      })
    }
  }

  return sections.length > 0 ? sections : [{ heading: 'Full text', content }]
}
