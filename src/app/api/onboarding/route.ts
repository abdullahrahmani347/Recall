import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

const onboardingSchema = z.object({
  completed: z.boolean().optional(),
  studyGoal: z.enum(['exam', 'language', 'hobby', 'work', 'school']).nullable().optional(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']).nullable().optional(),
  interests: z.array(z.string().max(60)).max(20).optional(),
  dailyGoalMinutes: z.number().int().min(5).max(240).optional(),
})

export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  const onboarding = await db.onboarding.findUnique({ where: { userId: user!.id } })
  if (!onboarding) {
    return NextResponse.json({ onboarding: null })
  }
  return NextResponse.json({
    onboarding: {
      completed: onboarding.completed,
      studyGoal: onboarding.studyGoal,
      experienceLevel: onboarding.experienceLevel,
      interests: JSON.parse(onboarding.interests),
      dailyGoalMinutes: onboarding.dailyGoalMinutes,
    },
  })
}

/**
 * POST /api/onboarding
 * Creates or updates the user's onboarding record. When `completed: true`
 * is set, the client treats the user as having finished onboarding and
 * won't show the flow again.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = onboardingSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  try {
    // Build update data — only include fields that were provided
    const updateData: any = {}
    if (parsed.data.completed !== undefined) updateData.completed = parsed.data.completed
    if (parsed.data.studyGoal !== undefined) updateData.studyGoal = parsed.data.studyGoal
    if (parsed.data.experienceLevel !== undefined) updateData.experienceLevel = parsed.data.experienceLevel
    if (parsed.data.interests !== undefined) updateData.interests = JSON.stringify(parsed.data.interests)
    if (parsed.data.dailyGoalMinutes !== undefined) updateData.dailyGoalMinutes = parsed.data.dailyGoalMinutes

    // Build create data — use defaults for missing fields
    const createData = {
      userId: user!.id,
      completed: parsed.data.completed ?? false,
      studyGoal: parsed.data.studyGoal ?? null,
      experienceLevel: parsed.data.experienceLevel ?? null,
      interests: parsed.data.interests ? JSON.stringify(parsed.data.interests) : '[]',
      dailyGoalMinutes: parsed.data.dailyGoalMinutes ?? 15,
    }

    const onboarding = await db.onboarding.upsert({
      where: { userId: user!.id },
      update: updateData,
      create: createData,
    })

    // Ensure settings row exists, then update dailyReviewLimit if needed
    const settingsUpdate = parsed.data.dailyGoalMinutes !== undefined
      ? { dailyReviewLimit: Math.min(500, Math.max(10, parsed.data.dailyGoalMinutes * 2)) }
      : {}

    await db.settings.upsert({
      where: { userId: user!.id },
      update: settingsUpdate,
      create: {
        userId: user!.id,
        ...settingsUpdate,
      },
    })

    return NextResponse.json({
      onboarding: {
        completed: onboarding.completed,
        studyGoal: onboarding.studyGoal,
        experienceLevel: onboarding.experienceLevel,
        interests: JSON.parse(onboarding.interests),
        dailyGoalMinutes: onboarding.dailyGoalMinutes,
      },
    })
  } catch (err) {
    console.error('Onboarding POST error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save onboarding' },
      { status: 500 }
    )
  }
}
