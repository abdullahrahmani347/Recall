import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  setAuthCookies,
  resolveCurrentUser,
} from '@/lib/auth'
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(80).optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

async function emitAuthResponse(userId: string, email: string, name: string | null) {
  const user = { id: userId, email, name }
  const access = await signAccessToken(user)
  const refresh = await signRefreshToken(user)
  await setAuthCookies(access, refresh)

  // Ensure settings row exists
  const existing = await db.settings.findUnique({ where: { userId } })
  if (!existing) {
    await db.settings.create({ data: { userId } })
  }

  return NextResponse.json({
    user: { id: userId, email, name },
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const mode = body.mode as 'register' | 'login' | undefined

  if (mode === 'register' || (body.name && body.email && body.password)) {
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 }
      )
    }
    const { email, password, name } = parsed.data
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }
    const passwordHash = await hashPassword(password)
    const user = await db.user.create({
      data: { email, passwordHash, name, authProvider: 'email' },
    })
    return emitAuthResponse(user.id, user.email, user.name)
  }

  // Login path
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }
  const { email, password } = parsed.data
  const user = await db.user.findUnique({ where: { email } })
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }
  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }
  return emitAuthResponse(user.id, user.email, user.name)
}

export async function GET() {
  const user = await resolveCurrentUser(async (id) => {
    const u = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true },
    })
    return u
  })
  if (!user) return NextResponse.json({ user: null }, { status: 200 })
  const settings = await db.settings.findUnique({ where: { userId: user.id } })
  return NextResponse.json({
    user: { ...user, settings: settings ?? undefined },
  })
}
