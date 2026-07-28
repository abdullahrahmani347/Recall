import { db } from '@/lib/db'
import { resolveCurrentUser, type AuthUser } from '@/lib/auth'
import { NextResponse } from 'next/server'

/**
 * Resolve the current authenticated user from cookies.
 * Returns `{ user, response }` — if `response` is non-null, send it directly.
 */
export async function requireUser(): Promise<{
  user: AuthUser | null
  response: NextResponse | null
}> {
  const user = await resolveCurrentUser(async (id) => {
    const u = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true },
    })
    return u
  })

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { user, response: null }
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function notFound(message = 'Not found'): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 })
}

/** Strip markdown to plain text for FTS indexing (cheap, no deps). */
export function markdownToPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ') // code blocks
    .replace(/`[^`]*`/g, ' ') // inline code
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^\)]*\)/g, '$1') // links → label
    .replace(/[#>*_~\-]+/g, ' ') // md punctuation
    .replace(/\s+/g, ' ')
    .trim()
}
