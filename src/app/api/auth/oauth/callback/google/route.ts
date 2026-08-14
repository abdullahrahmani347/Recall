import { NextRequest, NextResponse } from 'next/server'
import { handleOAuthCallback } from '@/lib/oauth-helpers'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const REDIRECT_URI = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/oauth/callback/google`

/**
 * GET /api/auth/oauth/callback/google
 * Handles the OAuth callback from Google — exchanges the code for
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

  // Verify state cookie for CSRF protection
  const stateCookie = req.cookies.get('oauth_state')?.value
  if (state !== stateCookie) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }

  // Exchange code for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    console.error('Google token exchange failed:', errText)
    return NextResponse.redirect(new URL('/?auth_error=token_exchange_failed', process.env.NEXTAUTH_URL || 'http://localhost:3000'))
  }

  const tokenData = await tokenRes.json()
  const accessToken = tokenData.access_token

  // Fetch user profile
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!profileRes.ok) {
    return NextResponse.redirect(new URL('/?auth_error=profile_fetch_failed', process.env.NEXTAUTH_URL || 'http://localhost:3000'))
  }

  const profile = await profileRes.json()

  return handleOAuthCallback({
    email: profile.email,
    name: profile.name || profile.given_name || null,
    avatarUrl: profile.picture || null,
    provider: 'google',
  })
}
