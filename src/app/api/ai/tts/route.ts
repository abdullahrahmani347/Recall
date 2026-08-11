import { NextRequest, NextResponse } from 'next/server'
import { requireUser, badRequest } from '@/lib/api-helpers'
import ZAI from 'z-ai-web-dev-sdk'
import { z } from 'zod'

const schema = z.object({ text: z.string().min(1).max(5000), voice: z.string().optional() })

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
  const settings = await (await import('@/lib/db')).db.settings.findUnique({ where: { userId: user!.id } })
  if (settings?.aiProcessingOptOut) return NextResponse.json({ error: 'AI processing is disabled' }, { status: 403 })
  try {
    const zai = await ZAI.create()
    const result = await zai.audio.tts.create({ input: parsed.data.text, voice: parsed.data.voice })
    const audioBase64 = typeof result === 'string' ? result : (result as any)?.data?.audio || (result as any)?.audio || ''
    if (!audioBase64) return NextResponse.json({ error: 'TTS produced no audio' }, { status: 422 })
    return NextResponse.json({ audio: audioBase64 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'TTS request failed' }, { status: 502 })
  }
}
