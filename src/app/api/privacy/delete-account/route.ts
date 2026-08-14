import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

const schema = z.object({
  confirmEmail: z.string().email(),
})

/**
 * POST /api/privacy/delete-account
 * Body: { confirmEmail: string }
 *
 * Permanently deletes the user's account and ALL associated data.
 * Requires email confirmation to prevent accidental deletion.
 *
 * This action is IRREVERSIBLE.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  // Verify the confirmation email matches
  const userRecord = await db.user.findUnique({ where: { id: user!.id } })
  if (!userRecord) return badRequest('User not found')
  if (userRecord.email !== parsed.data.confirmEmail) {
    return NextResponse.json({ error: 'Email does not match. Type your email to confirm deletion.' }, { status: 400 })
  }

  // Delete the user — cascading deletes will remove all related data
  // (notes, decks, cards, review logs, etc. all have onDelete: Cascade)
  await db.user.delete({ where: { id: user!.id } })

  return NextResponse.json({ ok: true, message: 'Account and all data permanently deleted.' })
}
