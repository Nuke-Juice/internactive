import Link from 'next/link'
import EmployerVerificationBadge from '@/components/badges/EmployerVerificationBadge'
import ApplyButton from './ApplyButton'

type Listing = {
  id: string
  title: string | null
  company_name: string | null
  employer_id?: string | null
  employer_avatar_url?: string | null
  employer_verification_tier?: string | null
  location: string | null
  location_city?: string | null
  location_state?: string | null
  remote_eligibility?: string | null
  remote_eligibility_scope?: string | null
  role_category?: string | null
  work_mode?: string | null
  apply_mode?: string | null
  application_cap?: number | null
  applications_count?: number | null
  employer_response_rate?: number | null
  employer_response_total?: number | null
  term?: string | null
  hours_min?: number | null
  hours_max?: number | null
  application_deadline?: string | null
  created_at?: string | null
  experience_level: string | null
  hours_per_week: number | null
  majorsText: string | null
  pay: string | null
  short_summary?: string | null
  description?: string | null
  skills?: string[] | null
  required_skills?: string[] | null
  preferred_skills?: string[] | null
  commuteMinutes?: number | null
  maxCommuteMinutes?: number | null
  matchScore?: number | null
}

type Props = {
  listing: Listing
  isAuthenticated: boolean
  userRole?: 'student' | 'employer' | null
  showMatchPrompt?: boolean
  showWhyMatch?: boolean
  whyMatchReasons?: string[]
  isSponsored?: boolean
}

type LocationChip = {
  label: string
  primary?: boolean
}

function badgeClass(primary = false) {
  if (primary) {
    return 'inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700'
  }
  return 'inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700'
}

function toWorkModeLabel(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized === 'remote') return 'Remote'
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'onsite' || normalized === 'on-site' || normalized === 'in person' || normalized === 'in_person') return 'In-person'
  return null
}

function deriveBaseLocationLabel(listing: Listing) {
  const city = listing.location_city?.trim()
  const state = listing.location_state?.trim().toUpperCase()
  if (city && state) return `${city}, ${state}`

  const locationText = (listing.location ?? '').trim()
  if (!locationText) return null
  const normalized = locationText.toLowerCase()
  const remoteWithinMatch = normalized.match(/remote\s+within\s+([a-z\s]+)/i)
  if (remoteWithinMatch?.[1]) {
    return `${remoteWithinMatch[1].trim().replace(/\b\w/g, (token) => token.toUpperCase())}-based`
  }
  const commaLocation = locationText.match(/^\s*([^,]+),\s*([A-Za-z]{2})\s*$/)
  if (commaLocation) {
    const parsedCity = commaLocation[1]?.trim()
    const parsedState = commaLocation[2]?.trim().toUpperCase()
    if (parsedCity && parsedState) return `${parsedCity}, ${parsedState}`
  }
  return null
}

function getLocationChips(listing: Listing): LocationChip[] {
  const chips: LocationChip[] = []
  const workModeLabel = toWorkModeLabel(listing.work_mode)
  const baseLocationLabel = deriveBaseLocationLabel(listing)

  if (workModeLabel) {
    chips.push({ label: workModeLabel, primary: true })
  }

  if (workModeLabel === 'Remote') {
    const remoteEligibility = listing.remote_eligibility?.trim()
    const remoteEligibilityScope = listing.remote_eligibility_scope?.trim()
    const locationText = (listing.location ?? '').toLowerCase()
    const state = listing.location_state?.trim().toUpperCase()
    const city = listing.location_city?.trim()
    if (city) {
      chips.push({ label: `${city}-based` })
    } else if (state) {
      chips.push({ label: `${state === 'UT' ? 'Utah' : state}-based` })
    } else if (remoteEligibility) {
      chips.push({ label: remoteEligibility })
    } else if (remoteEligibilityScope === 'us_only') {
      chips.push({ label: 'US only' })
    } else if (remoteEligibilityScope === 'worldwide') {
      chips.push({ label: 'Worldwide' })
    } else if (locationText.includes('utah')) {
      chips.push({ label: 'Utah-based' })
    } else if (locationText.includes('salt lake city') || locationText.includes('slc')) {
      chips.push({ label: 'SLC-based' })
    }
    return chips
  }

  if (baseLocationLabel) {
    chips.push({ label: baseLocationLabel })
  } else if (!workModeLabel && listing.location) {
    chips.push({ label: listing.location })
  }

  return chips
}

function formatDateShort(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

function daysUntil(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)
  const diff = endOfDay.getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function daysSince(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const diff = Date.now() - date.getTime()
  if (diff < 0) return 0
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function mapExperienceLevel(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'freshman') return 'Freshman'
  if (normalized === 'sophomore') return 'Sophomore'
  if (normalized === 'junior') return 'Junior'
  if (normalized === 'senior') return 'Senior'
  if (normalized === 'any') return 'Any year'
  return value
}

function normalizeSummaryComparable(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isMeaningfulSummary(candidate: string, listing: Listing) {
  const trimmed = candidate.trim()
  if (!trimmed) return false

  const normalized = normalizeSummaryComparable(trimmed)
  if (!normalized) return false

  const normalizedTitle = normalizeSummaryComparable(listing.title)
  const normalizedCategory = normalizeSummaryComparable(listing.role_category)
  const normalizedCategoryFallback = normalizeSummaryComparable(listing.role_category ?? listing.majorsText ?? null)

  if (normalized === normalizedTitle || normalized === normalizedCategory || normalized === normalizedCategoryFallback) {
    return false
  }

  const words = normalized.split(' ').filter(Boolean)
  const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)
  const hasSentencePunctuation = /[.!?]/.test(trimmed)
  if (words.length <= 2 && !hasSentencePunctuation) return false
  if (isAllCaps && words.length <= 4) return false

  return true
}

function trimSummaryForCard(value: string) {
  const trimmed = value
    .replace(/\s+/g, ' ')
    .replace(/^[\s•\-–—]+/, '')
    .trim()
  if (trimmed.length <= 180) return trimmed
  return `${trimmed.slice(0, 177).trimEnd()}...`
}

function cleanDescriptionSummarySource(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''

  // Drop generated listing sections so card summary stays concise.
  const sectionMatch = normalized.match(/\b(Responsibilities|Qualifications|Screening question):/i)
  const cutoff = sectionMatch?.index ?? normalized.length
  return normalized.slice(0, cutoff).trim()
}

function extractFirstResponsibility(value: string | null | undefined) {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) return null
  const markerMatch = normalized.match(/\bResponsibilities:\s*/i)
  if (!markerMatch || markerMatch.index === undefined) return null
  const afterMarker = normalized.slice(markerMatch.index + markerMatch[0].length).trim()
  if (!afterMarker) return null
  const cutoffMatch = afterMarker.match(/\b(Qualifications|Screening question):/i)
  const cutoff = cutoffMatch?.index ?? afterMarker.length
  const section = afterMarker.slice(0, cutoff).trim()
  if (!section) return null
  const firstBullet = section
    .replace(/^[\s•\-–—]+/, '')
    .split(/\s+(?:-|•)\s+/)
    .map((item) => item.trim())
    .find(Boolean)
  if (!firstBullet) return null
  if (firstBullet.length <= 180) return firstBullet
  return `${firstBullet.slice(0, 177).trimEnd()}...`
}

function getListingSummary(listing: Listing) {
  const summary = listing.short_summary?.trim()
  if (summary && isMeaningfulSummary(summary, listing)) {
    return trimSummaryForCard(summary)
  }

  const source = cleanDescriptionSummarySource(listing.description ?? '')
  if (!source) return null
  const descriptionSentences = source.match(/[^.!?]+[.!?]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [source]
  const firstMeaningfulSentence = descriptionSentences.find((sentence) => isMeaningfulSummary(sentence, listing))
  if (firstMeaningfulSentence) return trimSummaryForCard(firstMeaningfulSentence)

  const responsibilityFallback = extractFirstResponsibility(listing.description)
  if (responsibilityFallback) return responsibilityFallback
  return null
}

function getPrimaryMajorLabel(majorsText: string | null | undefined) {
  if (!majorsText) return null
  const primary = majorsText
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)[0]
  return primary?.toLowerCase() ?? null
}

function getIndustryLabel(roleCategory: string | null | undefined, majorsText: string | null | undefined) {
  const category = roleCategory?.trim()
  if (!category) return null
  const normalizedCategory = category.toLowerCase()
  const primaryMajor = getPrimaryMajorLabel(majorsText)
  if (primaryMajor && primaryMajor === normalizedCategory) return null
  return category
}

function getHoursText(listing: Listing) {
  if (typeof listing.hours_min === 'number' || typeof listing.hours_max === 'number') {
    return `${listing.hours_min ?? '—'}-${listing.hours_max ?? '—'} hrs/week`
  }
  if (typeof listing.hours_per_week === 'number') {
    return `${listing.hours_per_week} hrs/week`
  }
  return null
}

export default function JobCard({
  listing,
  isAuthenticated,
  userRole = null,
  showMatchPrompt = false,
  isSponsored = false,
}: Props) {
  const locationChips = getLocationChips(listing)
  const levelLabel = mapExperienceLevel(listing.experience_level)
  const listingSummary = getListingSummary(listing)
  const industryLabel = getIndustryLabel(listing.role_category, listing.majorsText)
  const categoryLabel = listing.role_category?.trim() || listing.majorsText?.split(',')[0]?.trim() || null
  const hoursText = getHoursText(listing)
  const deadlineDays = listing.application_deadline ? daysUntil(listing.application_deadline) : null
  const deadlineShort = listing.application_deadline ? formatDateShort(listing.application_deadline) : null
  const postedDays = listing.created_at ? daysSince(listing.created_at) : null
  const isClosed = typeof deadlineDays === 'number' && deadlineDays < 0
  const isUrgent = typeof deadlineDays === 'number' && deadlineDays >= 0 && deadlineDays <= 7
  const applicationCap = typeof listing.application_cap === 'number' ? listing.application_cap : 60
  const applicationsCount = typeof listing.applications_count === 'number' ? listing.applications_count : 0
  const capReached = applicationsCount >= applicationCap
  const nearCap = applicationsCount >= 50 && !capReached
  const companyInitial = (listing.company_name ?? 'C').trim().charAt(0).toUpperCase()

  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex flex-1 items-start gap-3">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
            {listing.employer_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listing.employer_avatar_url} alt={`${listing.company_name ?? 'Company'} logo`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-600">{companyInitial}</div>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-slate-900">{listing.title || 'Internship'}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              {listing.employer_id ? (
                <Link
                  href={`/employers/${encodeURIComponent(listing.employer_id)}`}
                  className="text-sm font-medium text-blue-700 hover:underline"
                  title="View employer profile"
                >
                  {listing.company_name || 'Company'}
                </Link>
              ) : (
                <p className="text-sm font-medium text-slate-700">{listing.company_name || 'Company'}</p>
              )}
              <EmployerVerificationBadge tier={listing.employer_verification_tier ?? 'free'} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated && userRole === 'student' && typeof listing.matchScore === 'number' ? (
            <div className="inline-flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border-2 border-emerald-200 bg-emerald-50 text-emerald-700">
              <span className="text-sm font-semibold leading-none">{Math.round(listing.matchScore)}%</span>
              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide">match</span>
            </div>
          ) : showMatchPrompt ? (
            <span className="text-[11px] font-medium text-slate-500">Log in to see match score</span>
          ) : null}
          {listing.pay ? <span className={badgeClass(true)}>{listing.pay}</span> : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {isSponsored ? <span className={badgeClass(true)}>Sponsored</span> : null}
        {locationChips.map((chip) => (
          <span key={chip.label} className={badgeClass(Boolean(chip.primary))}>
            {chip.label}
          </span>
        ))}
        {listing.term ? <span className={badgeClass()}>{listing.term}</span> : null}
        {levelLabel ? <span className={badgeClass()}>{levelLabel}</span> : null}
      </div>

      {listingSummary ? (
        <div className="mt-2">
          <p className="line-clamp-1 text-sm text-slate-700">{listingSummary}</p>
        </div>
      ) : null}

      <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
        <div className="grid gap-x-3 gap-y-1 text-xs text-slate-600 sm:grid-cols-3">
          <p className="font-medium text-slate-700">
            {applicationsCount}/{applicationCap} applicants
            {nearCap ? (
              <span className="ml-1.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                Nearly full
              </span>
            ) : null}
            {capReached ? (
              <span className="ml-1.5 rounded-full border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                Closed
              </span>
            ) : null}
          </p>
          {hoursText ? <p className="font-medium text-slate-700">{hoursText}</p> : <p className="text-slate-500">Hours TBD</p>}
          {listing.application_deadline && deadlineDays !== null ? (
            <p className={`${isClosed ? 'font-semibold text-slate-500' : isUrgent ? 'font-semibold text-amber-700' : 'text-slate-700'}`}>
              {isClosed ? 'Closed' : `${deadlineDays} day${deadlineDays === 1 ? '' : 's'} left`}
              {deadlineShort ? <span className="ml-1 text-[11px] text-slate-500">({deadlineShort})</span> : null}
            </p>
          ) : (
            <p className="text-slate-500">No deadline</p>
          )}
          <p className="sm:col-span-3 text-[11px] text-slate-500">
            {postedDays !== null ? `Posted ${postedDays === 0 ? 'today' : `${postedDays} day${postedDays === 1 ? '' : 's'} ago`}` : 'Recently posted'}
            {categoryLabel ? ` · ${categoryLabel}` : ''}
            {industryLabel ? ` · ${industryLabel}` : ''}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Link
          href={`/jobs/${listing.id}`}
          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          View details
        </Link>
        <ApplyButton
          listingId={listing.id}
          applyMode={listing.apply_mode}
          isAuthenticated={isAuthenticated}
          userRole={userRole}
          isClosed={isClosed || capReached}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        />
      </div>
    </article>
  )
}
