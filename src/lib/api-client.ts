/**
 * Tiny fetch wrapper — credentials: 'include' so httpOnly auth cookies
 * are sent with every request automatically. No token juggling in JS.
 */
export async function api<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      // ignore JSON parse errors
    }
    const err = new Error(message) as Error & { status: number }
    err.status = res.status
    throw err
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function apiUpload<T = unknown>(
  path: string,
  formData: FormData
): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  if (!res.ok) {
    let message = `Upload failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      // ignore
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}

export async function apiDownload(path: string): Promise<Blob> {
  const res = await fetch(path, { credentials: 'include' })
  if (!res.ok) throw new Error(`Download failed (${res.status})`)
  return res.blob()
}
