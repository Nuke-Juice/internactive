import type { NextResponse } from 'next/server'
import { jsonError } from '@/src/server/api/respond'

export async function parseJsonBody(request: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  try {
    const body = await request.json()
    return { ok: true, body }
  } catch {
    return { ok: false, response: jsonError('Invalid JSON body', 400) }
  }
}
