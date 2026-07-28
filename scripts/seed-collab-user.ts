// Seed a second test user + shared notebook for collaboration testing.
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  // Create second user if not exists
  const email2 = 'collab@recall.app'
  let user2 = await db.user.findUnique({ where: { email: email2 } })
  if (!user2) {
    const hash = await bcrypt.hash('password123', 12)
    user2 = await db.user.create({
      data: { email: email2, passwordHash: hash, name: 'Collaborator', authProvider: 'email' },
    })
    await db.settings.create({ data: { userId: user2.id } })
    console.log(`Created collaborator user: ${email2}`)
  } else {
    console.log(`Collaborator user already exists: ${email2}`)
  }

  // Mark the existing test user's onboarding as completed (skip onboarding flow for testing)
  const user1 = await db.user.findUnique({ where: { email: 'test@recall.app' } })
  if (user1) {
    await db.onboarding.upsert({
      where: { userId: user1.id },
      update: { completed: true },
      create: {
        userId: user1.id,
        completed: true,
        studyGoal: 'school',
        experienceLevel: 'intermediate',
        interests: JSON.stringify(['Mathematics', 'Computer Science']),
        dailyGoalMinutes: 15,
      },
    })
    console.log('Marked test user onboarding as completed')
  }

  if (user2) {
    await db.onboarding.upsert({
      where: { userId: user2.id },
      update: { completed: true },
      create: {
        userId: user2.id,
        completed: true,
        studyGoal: 'language',
        experienceLevel: 'beginner',
        interests: JSON.stringify(['Languages']),
        dailyGoalMinutes: 15,
      },
    })
    console.log('Marked collaborator onboarding as completed')
  }

  console.log(`Total users: ${await db.user.count()}`)
}

main().catch(console.error).finally(() => process.exit(0))
