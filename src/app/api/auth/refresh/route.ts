import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  signAccessToken,
  signRefreshToken,
  setAuthCookies,
  verifyToken,
} from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST() {
  const store = await cookies()
  const refreshToken = store.get('recall_refresh')?.value
  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 })
  }
  const payload = await verifyToken(refreshToken)
  if (!payload || payload.type !== 'refresh') {
    return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 })
  }
  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 })
  }
  const access = await signAccessToken(user)
  const refresh = await signRefreshToken(user)
  await setAuthCookies(access, refresh)
  return NextResponse.json({ ok: true })
}
