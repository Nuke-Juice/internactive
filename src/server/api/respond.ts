import { NextResponse } from 'next/server'

export function jsonOk(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status })
}

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}
