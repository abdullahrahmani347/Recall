import { db } from '@/lib/db'
import { signAccessToken, signRefreshToken, setAuthCookies } from '@/lib/auth'
import { NextResponse } from 'next/server'

interface OAuthUserInfo {
  email: string
  name: string | null
  avatarUrl: string | null
  provider: 'google' | 'github'
}

/**
 * Shared OAuth callback handler — finds or creates a user from OAuth
 * profile data, then sets auth cookies and redirects to the app.
 */
export async function handleOAuthCallback(userInfo: OAuthUserInfo): Promise<NextResponse> {
  // Find existing user by email
  let user = await db.user.findUnique({
    where: { email: userInfo.email },
  })

  if (!user) {
    // Create new user with no password (OAuth-only account)
    user = await db.user.create({
      data: {
        email: userInfo.email,
        name: userInfo.name,
        avatarUrl: userInfo.avatarUrl,
        authProvider: userInfo.provider,
        passwordHash: null, // OAuth users don't have a password
      },
    })

    // Create default settings
    await db.settings.create({
      data: { userId: user.id },
    })
  } else if (user.authProvider === 'email' && !user.passwordHash) {
    // Upgrade email-only account to OAuth if it was a stub
    await db.user.update({
      where: { id: user.id },
      data: { authProvider: userInfo.provider, avatarUrl: userInfo.avatarUrl || user.avatarUrl },
    })
  }

  // Issue tokens and set cookies
  const authUser = { id: user.id, email: user.email, name: user.name }
  const access = await signAccessToken(authUser)
  const refresh = await signRefreshToken(authUser)
  await setAuthCookies(access, refresh)

  // Redirect to the app home
  const res = NextResponse.redirect(new URL('/', process.env.NEXTAUTH_URL || 'http://localhost:3000'))
  return res
}
