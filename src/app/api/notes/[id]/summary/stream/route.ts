import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'
import ZAI from 'z-ai-web-dev-sdk'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/notes/[id]/summary/stream
 * Server-Sent Events endpoint that streams summary tokens as the LLM
 * generates them. Terminates with a `done` event containing the final
 * summary text and the persisted summary id.
 *
 * Per §7 of the brief, this is one-directional SSE (server → client),
 * deliberately simpler than a WebSocket — adequate for streaming the
 * output of an LLM summarization call.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const note = await db.note.findFirst({
    where: { id, userId: user!.id },
    include: { summaries: { orderBy: { createdAt: 'desc' }, take: 1 } },
  })
  if (!note) {
    return new Response('Note not found', { status: 404 })
  }

  const settings = await db.settings.findUnique({ where: { userId: user!.id } })
  if (settings?.aiProcessingOptOut) {
    return new Response('AI processing is disabled', { status: 403 })
  }

  // Use the most recent pending/streaming summary, or create a new one
  let summary =
    note.summaries[0]?.status === 'pending' || note.summaries[0]?.status === 'streaming'
      ? note.summaries[0]
      : await db.summary.create({
          data: { noteId: id, status: 'streaming', modelUsed: 'z-ai-glm' },
        })

  await db.summary.update({
    where: { id: summary.id },
    data: { status: 'streaming' },
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )
      }

      try {
        const zai = await ZAI.create()
        const prompt = `Summarize the following note in 4-6 concise bullet points. Use markdown. Capture the key ideas only; do not add commentary or new information.

Note title: ${note.title || 'Untitled'}

Note content:
${note.contentMarkdown || '(empty note)'}`

        const upstream = (await zai.chat.completions.create({
          model: 'glm-4-flash',
          messages: [
            {
              role: 'system',
              content:
                'You are a careful study assistant. Summarize the user note in tight, faithful bullet points.',
            },
            { role: 'user', content: prompt },
          ],
          stream: true,
        })) as ReadableStream<Uint8Array>

        const reader = upstream.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let fullText = ''

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // SSE frames separated by \n\n
          let idx: number
          while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 2)
            const lines = frame.split('\n')
            for (const line of lines) {
              if (!line.startsWith('data:')) continue
              const payload = line.slice(5).trim()
              if (payload === '[DONE]') continue
              try {
                const json = JSON.parse(payload)
                const token = json?.choices?.[0]?.delta?.content ?? ''
                if (token) {
                  fullText += token
                  send('token', { token })
                }
              } catch {
                // ignore malformed frames
              }
            }
          }
        }

        await db.summary.update({
          where: { id: summary.id },
          data: { status: 'complete', summaryText: fullText },
        })

        send('done', { summaryId: summary.id, summary: fullText })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        await db.summary.update({
          where: { id: summary.id },
          data: { status: 'failed', summaryText: `Failed to summarize: ${message}` },
        })
        send('error', { error: message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable proxy buffering
    },
  })
}
