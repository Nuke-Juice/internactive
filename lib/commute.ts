import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

type TransportMode = 'driving' | 'transit' | 'walking' | 'cycling'

type Point = { lat: number; lng: number }

type LocationTokenInput = {
  city?: string | null
  state?: string | null
  zip?: string | null
  point?: Point | null
}

type DestinationInput = {
  internshipId: string
  workMode?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  point?: Point | null
  fallbackCity?: string | null
  fallbackState?: string | null
  fallbackZip?: string | null
  fallbackPoint?: Point | null
}

type OriginInput = {
  city?: string | null
  state?: string | null
  zip?: string | null
  point?: Point | null
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function toPoint(lat: number | null | undefined, lng: number | null | undefined): Point | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

function locationToken(input: LocationTokenInput): string | null {
  if (input.point) {
    return `p:${input.point.lat.toFixed(4)},${input.point.lng.toFixed(4)}`
  }
  const zip = normalizeText(input.zip)
  if (zip) return `z:${zip}`
  const city = normalizeText(input.city)
  const state = normalizeText(input.state)
  if (city && state) return `c:${city}|${state}`
  return null
}

function haversineMiles(a: Point, b: Point) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const earthRadiusMiles = 3958.8

  const latDelta = toRadians(b.lat - a.lat)
  const lngDelta = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)

  const sinLat = Math.sin(latDelta / 2)
  const sinLng = Math.sin(lngDelta / 2)
  const value = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  const centralAngle = 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
  return earthRadiusMiles * centralAngle
}

function estimateMinutesFromPoints(origin: Point, destination: Point, transportMode: TransportMode) {
  const miles = haversineMiles(origin, destination)
  const speedByMode: Record<TransportMode, number> = {
    driving: 28,
    transit: 16,
    walking: 3,
    cycling: 10,
  }
  const mph = speedByMode[transportMode]
  const minutes = Math.round((miles / mph) * 60 + 5)
  return Math.max(5, Math.min(180, minutes))
}

function estimateMinutesFallback(originToken: string, destinationToken: string) {
  if (originToken === destinationToken) return 12

  if (originToken.startsWith('z:') && destinationToken.startsWith('z:')) {
    return 28
  }

  if (originToken.startsWith('c:') && destinationToken.startsWith('c:')) {
    const [, originCityState] = originToken.split('c:')
    const [, destinationCityState] = destinationToken.split('c:')
    const [, originState = ''] = originCityState.split('|')
    const [, destinationState = ''] = destinationCityState.split('|')
    return originState === destinationState ? 35 : 70
  }

  return 45
}

function normalizeTransportMode(value: string | null | undefined): TransportMode {
  if (value === 'transit' || value === 'walking' || value === 'cycling') return value
  return 'driving'
}

function isRemote(workMode: string | null | undefined) {
  return normalizeText(workMode) === 'remote'
}

function buildDestination(input: DestinationInput) {
  const point = input.point ?? input.fallbackPoint ?? null
  const city = input.city ?? input.fallbackCity ?? null
  const state = input.state ?? input.fallbackState ?? null
  const zip = input.zip ?? input.fallbackZip ?? null
  return { point, city, state, zip }
}

export async function getCommuteMinutesForListings(params: {
  supabase: SupabaseClient
  userId: string
  origin: OriginInput
  transportMode?: string | null
  destinations: DestinationInput[]
}) {
  const { supabase, userId, origin, transportMode, destinations } = params
  const normalizedMode = normalizeTransportMode(transportMode)

  const originToken = locationToken({ point: origin.point ?? null, city: origin.city, state: origin.state, zip: origin.zip })
  if (!originToken) return new Map<string, number>()

  const nowIso = new Date().toISOString()
  const result = new Map<string, number>()

  for (const destinationInput of destinations) {
    if (isRemote(destinationInput.workMode)) continue

    const destination = buildDestination(destinationInput)
    const destinationToken = locationToken(destination)
    if (!destinationToken) continue

    const originHash = hashValue(originToken)
    const destinationHash = hashValue(destinationToken)

    const { data: cached } = await supabase
      .from('commute_time_cache')
      .select('commute_minutes')
      .eq('user_id', userId)
      .eq('internship_id', destinationInput.internshipId)
      .eq('transport_mode', normalizedMode)
      .eq('origin_hash', originHash)
      .eq('destination_hash', destinationHash)
      .gt('expires_at', nowIso)
      .maybeSingle()

    if (typeof cached?.commute_minutes === 'number') {
      result.set(destinationInput.internshipId, cached.commute_minutes)
      continue
    }

    const minutes =
      origin.point && destination.point
        ? estimateMinutesFromPoints(origin.point, destination.point, normalizedMode)
        : estimateMinutesFallback(originToken, destinationToken)

    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()

    await supabase.from('commute_time_cache').upsert(
      {
        user_id: userId,
        internship_id: destinationInput.internshipId,
        transport_mode: normalizedMode,
        origin_hash: originHash,
        destination_hash: destinationHash,
        commute_minutes: minutes,
        expires_at: expiresAt,
      },
      { onConflict: 'user_id,internship_id,transport_mode,origin_hash,destination_hash' }
    )

    result.set(destinationInput.internshipId, minutes)
  }

  return result
}

export function toGeoPoint(lat: number | null | undefined, lng: number | null | undefined) {
  return toPoint(lat, lng)
}
