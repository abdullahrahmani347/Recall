import { NextRequest, NextResponse } from 'next/server'
import { handleOAuthCallback } from '@/lib/oauth-helpers'

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || ''
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || ''
const REDIRECT_URI = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/oauth/callback/github`

/**
 * GET /api/auth/oauth/callback/github
 * Handles the OAuth callback from GitHub — exchanges the code for
 * an access token, fetches the user profile, and creates/signs in the user.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(error)}`, process.env.NEXTAUTH_URL || 'http://localhost:3000'))
  }
  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
  }

  // Verify state cookie
  const stateCookie = req.cookies.get('oauth_state')?.value
  if (state !== stateCookie) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }

  // Exchange code for access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      code,
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/?auth_error=token_exchange_failed', process.env.NEXTAUTH_URL || 'http://localhost:3000'))
  }

  const tokenData = await tokenRes.json()
  const accessToken = tokenData.access_token

  if (!accessToken) {
    return NextResponse.redirect(new URL('/?auth_error=no_access_token', process.env.NEXTAUTH_URL || 'http://localhost:3000'))
  }

  // Fetch user profile
  const profileRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!profileRes.ok) {
    return NextResponse.redirect(new URL('/?auth_error=profile_fetch_failed', process.env.NEXTAUTH_URL || 'http://localhost:3000'))
  }

  const profile = await profileRes.json()

  // GitHub doesn't always return email in profile — fetch from /user/emails
  let email = profile.email
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })
    if (emailsRes.ok) {
      const emails = await emailsRes.json()
      const primaryEmail = emails.find((e: any) => e.primary)
      email = primaryEmail?.email
    }
  }

  if (!email) {
    return NextResponse.redirect(new URL('/?auth_error=no_email', process.env.NEXTAUTH_URL || 'http://localhost:3000'))
  }

  return handleOAuthCallback({
    email,
    name: profile.name || profile.login || null,
    avatarUrl: profile.avatar_url || null,
    provider: 'github',
  })
}
