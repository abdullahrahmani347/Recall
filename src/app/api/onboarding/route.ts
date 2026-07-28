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

  const data = {
    ...parsed.data,
    interests: parsed.data.interests
      ? JSON.stringify(parsed.data.interests)
      : undefined,
  }

  const onboarding = await db.onboarding.upsert({
    where: { userId: user!.id },
    update: data,
    create: { userId: user!.id, ...data },
  })

  // If the user set a daily goal, sync it to their settings' dailyReviewLimit
  // (roughly: 1 card ≈ 30 seconds, so dailyGoalMinutes * 2 = daily review limit)
  if (parsed.data.dailyGoalMinutes !== undefined) {
    const computedLimit = Math.min(500, Math.max(10, parsed.data.dailyGoalMinutes * 2))
    await db.settings.upsert({
      where: { userId: user!.id },
      update: { dailyReviewLimit: computedLimit },
      create: { userId: user!.id, dailyReviewLimit: computedLimit },
    })
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
