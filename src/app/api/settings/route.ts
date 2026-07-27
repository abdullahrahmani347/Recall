import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

const settingsSchema = z.object({
  theme: z.enum(['dark', 'light']).optional(),
  reducedMotion: z.boolean().optional(),
  dailyNewCardLimit: z.number().int().min(1).max(500).optional(),
  dailyReviewLimit: z.number().int().min(1).max(1000).optional(),
  timezone: z.string().max(80).optional(),
  aiProcessingOptOut: z.boolean().optional(),
})

export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  const settings = await db.settings.findUnique({ where: { userId: user!.id } })
  return NextResponse.json({ settings: settings ?? null })
}

export async function PATCH(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = settingsSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const settings = await db.settings.upsert({
    where: { userId: user!.id },
    update: parsed.data,
    create: { userId: user!.id, ...parsed.data },
  })

  return NextResponse.json({ settings })
}
