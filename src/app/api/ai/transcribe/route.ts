import { NextRequest, NextResponse } from 'next/server'
import { requireUser, badRequest } from '@/lib/api-helpers'
import ZAI from 'z-ai-web-dev-sdk'
import { z } from 'zod'

const schema = z.object({ audio: z.string().min(1) })

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const settings = await (await import('@/lib/db')).db.settings.findUnique({ where: { userId: user!.id } })
  if (settings?.aiProcessingOptOut) {
    return NextResponse.json({ error: 'AI processing is disabled' }, { status: 403 })
  }

  try {
    const zai = await ZAI.create()
    const result = await zai.audio.asr.create({ file_base64: parsed.data.audio })
    const text = typeof result === 'string' ? result : (result as any)?.text || (result as any)?.data?.text || ''
    if (!text) return NextResponse.json({ text: '', error: 'No speech detected' }, { status: 422 })
    return NextResponse.json({ text })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'ASR failed' }, { status: 502 })
  }
}
