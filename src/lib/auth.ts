import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'recall-dev-secret-change-me-in-prod-min-32-chars'
)

const ACCESS_TOKEN_TTL = 60 * 15 // 15 min
const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30 // 30 days

export interface AuthUser {
  id: string
  email: string
  name: string | null
}

export interface JwtPayload {
  sub: string
  email: string
  name: string | null
  type: 'access' | 'refresh'
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function signAccessToken(user: AuthUser): Promise<string> {
  return new SignJWT({ ...user, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL}s`)
    .sign(JWT_SECRET)
}

export async function signRefreshToken(user: AuthUser): Promise<string> {
  return new SignJWT({ sub: user.id, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL}s`)
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}

export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const store = await cookies()
  store.set('recall_access', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_TTL,
  })
  store.set('recall_refresh', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: REFRESH_TOKEN_TTL,
  })
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies()
  store.delete('recall_access')
  store.delete('recall_refresh')
}

/**
 * Resolve the current user from cookies, with refresh-token rotation.
 * Pass a `getUserById` callback to avoid circular deps with the db module.
 */
export async function resolveCurrentUser(
  getUserById: (id: string) => Promise<AuthUser | null>
): Promise<AuthUser | null> {
  const store = await cookies()
  const accessToken = store.get('recall_access')?.value

  if (accessToken) {
    const payload = await verifyToken(accessToken)
    if (payload && payload.type === 'access') {
      return { id: payload.sub, email: payload.email, name: payload.name }
    }
  }

  // Refresh path
  const refreshToken = store.get('recall_refresh')?.value
  if (!refreshToken) return null
  const payload = await verifyToken(refreshToken)
  if (!payload || payload.type !== 'refresh') return null

  const user = await getUserById(payload.sub)
  if (!user) return null

  // Rotate: issue a fresh access cookie so subsequent calls succeed.
  const newAccess = await signAccessToken(user)
  store.set('recall_access', newAccess, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_TTL,
  })

  return user
}
