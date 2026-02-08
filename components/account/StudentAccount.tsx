'use client'

import { useEffect, useMemo, useState } from 'react'
import UniversityCombobox from '@/components/account/UniversityCombobox'
import { supabaseBrowser } from '@/lib/supabase/client'

type StudentProfileRow = {
  university_id: string | number | null
  school: string | null
  majors: string[] | string | null
  year: string | null
  coursework: string[] | string | null
  experience_level: string | null
  availability_start_month: string | null
  availability_hours_per_week: number | string | null
  interests: string | null
}

type University = {
  id: string | number
  name: string
  state?: string | null
  country?: string | null
  verified?: boolean | null
}

type ExperienceLevel = 'none' | 'projects' | 'internship'

type Props = {
  userId: string
  initialProfile: StudentProfileRow | null
}

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

const interestAreas = [
  'Finance',
  'Accounting',
  'Data',
  'Marketing',
  'Product',
  'Operations',
  'Design',
  'Sales',
  'HR',
  'Engineering',
]

const graduationYears = ['2026', '2027', '2028', '2029', '2030']
const experienceLevels: Array<{ label: string; value: ExperienceLevel }> = [
  { label: "I'm new to this (no relevant experience yet)", value: 'none' },
  { label: "I've taken classes / built projects related to it", value: 'projects' },
  { label: "I've had an internship or role in the field", value: 'internship' },
]
const seasons = ['Summer', 'Fall', 'Spring'] as const
const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const hoursPerWeekOptions = [5, 10, 15, 20, 25, 30, 35, 40]

function normalizeExperienceLevel(value: string | null | undefined): ExperienceLevel {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()

  if (!normalized) return 'none'
  if (normalized === 'none' || normalized === 'projects' || normalized === 'internship') {
    return normalized
  }
  if (normalized.includes('project')) return 'projects'
  if (normalized.includes('intern') || normalized.includes('work')) return 'internship'
  return 'none'
}

function getExperienceLabel(value: ExperienceLevel) {
  if (value === 'projects') return "I've taken classes / built projects related to it"
  if (value === 'internship') return "I've had an internship or role in the field"
  return "I'm new to this (no relevant experience yet)"
}

function getPrimaryMajor(value: StudentProfileRow['majors']) {
  if (Array.isArray(value)) return value[0] ?? ''
  if (typeof value === 'string') return value
  return ''
}

function getCourseworkText(value: StudentProfileRow['coursework']) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((course) => course.trim())
      .filter(Boolean)
  }
  return []
}

function normalizeHoursPerWeek(value: number | string | null | undefined) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 20
}

function defaultSeasonFromMonth(value: string | null) {
  if (!value) return ['Summer']
  const normalized = value.toLowerCase()
  if (normalized.startsWith('jan') || normalized.startsWith('feb') || normalized.startsWith('mar')) {
    return ['Spring']
  }
  if (normalized.startsWith('sep') || normalized.startsWith('oct') || normalized.startsWith('nov')) {
    return ['Fall']
  }
  return ['Summer']
}

function parsePreferences(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const maybeObject = value as { remoteOk?: unknown; seasons?: unknown; availability?: unknown }

  const rawSeasons = Array.isArray(maybeObject.seasons)
    ? maybeObject.seasons
    : Array.isArray(maybeObject.availability)
      ? maybeObject.availability
      : []
  const parsedSeasons = rawSeasons.filter(
    (item): item is string => typeof item === 'string' && seasons.includes(item as (typeof seasons)[number])
  )

  return {
    remoteOk: Boolean(maybeObject.remoteOk),
    seasons: parsedSeasons,
  }
}

function parseLegacyInterests(value: string | null) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as unknown
    return parsePreferences(parsed)
  } catch {
    return null
  }
}

function normalizeCourseworkName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function includesCoursework(list: string[], value: string) {
  const normalized = normalizeCourseworkName(value).toLowerCase()
  return list.some((item) => normalizeCourseworkName(item).toLowerCase() === normalized)
}

export default function StudentAccount({ userId, initialProfile }: Props) {
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null)
  const [universityQuery, setUniversityQuery] = useState(initialProfile?.school ?? '')
  const [universityOptions, setUniversityOptions] = useState<University[]>([])
  const [universityLoading, setUniversityLoading] = useState(false)
  const [universityError, setUniversityError] = useState<string | null>(null)
  const [universitySearchError, setUniversitySearchError] = useState<string | null>(null)

  const [major, setMajor] = useState(getPrimaryMajor(initialProfile?.majors ?? null) || 'Finance')
  const [graduationYear, setGraduationYear] = useState(initialProfile?.year ?? '2028')
  const [coursework, setCoursework] = useState<string[]>(getCourseworkText(initialProfile?.coursework ?? null))
  const [courseworkInput, setCourseworkInput] = useState('')
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    normalizeExperienceLevel(initialProfile?.experience_level)
  )
  const [availabilityStartMonth, setAvailabilityStartMonth] = useState(
    initialProfile?.availability_start_month ?? 'May'
  )
  const [availabilityHoursPerWeek, setAvailabilityHoursPerWeek] = useState(
    normalizeHoursPerWeek(initialProfile?.availability_hours_per_week)
  )
  const [availability, setAvailability] = useState<string[]>(
    defaultSeasonFromMonth(initialProfile?.availability_start_month ?? null)
  )
  const [remoteOk, setRemoteOk] = useState(false)
  const [suggestedCoursework, setSuggestedCoursework] = useState<string[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const hasSavedProfile = useMemo(() => {
    return Boolean(
      universityQuery.trim() ||
        major.trim() ||
        graduationYear.trim() ||
        coursework.length > 0 ||
        availabilityStartMonth.trim() ||
        availabilityHoursPerWeek
    )
  }, [availabilityHoursPerWeek, availabilityStartMonth, coursework, graduationYear, major, universityQuery])

  const [mode, setMode] = useState<'view' | 'edit'>(hasSavedProfile ? 'view' : 'edit')

  useEffect(() => {
    const supabase = supabaseBrowser()

    async function loadLatestProfile() {
      setLoading(true)
      const { data, error: loadError } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (loadError || !data) {
        setLoading(false)
        return
      }

      const row = data as Record<string, unknown>
      const dbMajor = getPrimaryMajor((row.majors as StudentProfileRow['majors']) ?? null)
      const dbCoursework = getCourseworkText((row.coursework as StudentProfileRow['coursework']) ?? null)
      const dbStartMonth =
        typeof row.availability_start_month === 'string' && row.availability_start_month.trim()
          ? row.availability_start_month
          : 'May'
      const parsedPreferences =
        parsePreferences(row.preferences) ?? parseLegacyInterests((row.interests as string) ?? null)

      setMajor(dbMajor || 'Finance')
      setGraduationYear((row.year as string) ?? '2028')
      setCoursework(dbCoursework)
      setExperienceLevel(normalizeExperienceLevel((row.experience_level as string) ?? null))
      setAvailabilityStartMonth(dbStartMonth)
      setAvailabilityHoursPerWeek(
        normalizeHoursPerWeek((row.availability_hours_per_week as number | string | null) ?? null)
      )
      setAvailability(
        parsedPreferences?.seasons && parsedPreferences.seasons.length > 0
          ? parsedPreferences.seasons
          : defaultSeasonFromMonth(dbStartMonth)
      )
      setRemoteOk(Boolean(parsedPreferences?.remoteOk))

      const universityId =
        typeof row.university_id === 'string' || typeof row.university_id === 'number'
          ? row.university_id
          : null
      const schoolText = typeof row.school === 'string' ? row.school : ''

      if (universityId) {
        const { data: university } = await supabase
          .from('universities')
          .select('id, name, verified')
          .eq('id', universityId)
          .maybeSingle()

        if (university?.id && university?.name) {
          const selected = { id: university.id as string | number, name: String(university.name) }
          setSelectedUniversity(selected)
          setUniversityQuery(selected.name)
        } else {
          setSelectedUniversity(null)
          setUniversityQuery(schoolText)
        }
      } else {
        if (schoolText.trim()) {
          const { data: matchedUniversity } = await supabase
            .from('universities')
            .select('id, name, verified')
            .ilike('name', schoolText.trim())
            .maybeSingle()

          if (matchedUniversity?.id && matchedUniversity?.name) {
            const selected = {
              id: matchedUniversity.id as string | number,
              name: String(matchedUniversity.name),
              verified: typeof matchedUniversity.verified === 'boolean' ? matchedUniversity.verified : null,
            }
            setSelectedUniversity(selected)
            setUniversityQuery(selected.name)
          } else {
            setSelectedUniversity(null)
            setUniversityQuery(schoolText)
          }
        } else {
          setSelectedUniversity(null)
          setUniversityQuery(schoolText)
        }
      }

      setLoading(false)
    }

    void loadLatestProfile()
  }, [userId])

  useEffect(() => {
    const query = universityQuery.trim()
    if (query.length < 2 || (selectedUniversity && selectedUniversity.name === universityQuery)) {
      return
    }

    const supabase = supabaseBrowser()
    let active = true

    const timer = setTimeout(() => {
      void (async () => {
        if (!active) return
        setUniversityLoading(true)

        const urlPrefix =
          process.env.NODE_ENV !== 'production'
            ? (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').slice(0, 10)
            : ''
        if (process.env.NODE_ENV !== 'production') {
          console.log('[UniversitySearch] supabase url prefix:', urlPrefix)
          console.log('[UniversitySearch] query:', query)
        }

        const { data, error: searchError } = await supabase
          .from('universities')
          .select('id,name,state,country,verified')
          .ilike('name', `%${query}%`)
          .order('name', { ascending: true })
          .limit(10)

        if (!active) return

        if (searchError) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[UniversitySearch] error:', searchError.message)
          }
          setUniversitySearchError(searchError.message)
          setUniversityOptions([])
        } else {
          setUniversitySearchError(null)
          const nextOptions = (data ?? []).reduce<University[]>((acc, item) => {
            if (
              !item ||
              (typeof item.id !== 'string' && typeof item.id !== 'number') ||
              typeof item.name !== 'string'
            ) {
              return acc
            }

            acc.push({
              id: item.id,
              name: item.name,
              state: typeof item.state === 'string' ? item.state : null,
              country: typeof item.country === 'string' ? item.country : null,
              verified: typeof item.verified === 'boolean' ? item.verified : null,
            })
            return acc
          }, [])

          if (process.env.NODE_ENV !== 'production') {
            console.log('[UniversitySearch] row count:', nextOptions.length)
          }
          setUniversityOptions(nextOptions)
        }

        setUniversityLoading(false)
      })()
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [selectedUniversity, universityQuery])

  const addCourseworkOptions = useMemo(() => {
    return [...new Set([...suggestedCoursework])].filter((course) => !includesCoursework(coursework, course))
  }, [coursework, suggestedCoursework])

  const filteredCourseworkOptions = useMemo(() => {
    const query = normalizeCourseworkName(courseworkInput).toLowerCase()
    if (!query) return addCourseworkOptions.slice(0, 8)
    return addCourseworkOptions.filter((course) => course.toLowerCase().includes(query)).slice(0, 8)
  }, [addCourseworkOptions, courseworkInput])

  useEffect(() => {
    let active = true

    const timer = setTimeout(() => {
      void (async () => {
        if (!active) return

        if (!selectedUniversity || !major.trim()) {
          setSuggestedCoursework([])
          return
        }

        const universityIdValue =
          typeof selectedUniversity.id === 'number'
            ? selectedUniversity.id
            : Number(selectedUniversity.id)

        if (!Number.isFinite(universityIdValue)) {
          setSuggestedCoursework([])
          return
        }

        const supabase = supabaseBrowser()
        setSuggestionsLoading(true)

        const { data, error: suggestionError } = await supabase.rpc('course_suggestions', {
          p_university_id: universityIdValue,
          p_major: major,
          p_query: '',
          p_limit: 12,
        })

        if (!active) return

        if (suggestionError) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[CourseSuggestions] error:', suggestionError.message)
          }
          setSuggestedCoursework([])
          setSuggestionsLoading(false)
          return
        }

        const nextSuggestions = (Array.isArray(data) ? data : []).reduce((acc: string[], row: unknown) => {
          const code =
            row && typeof row === 'object' && 'code' in row && typeof row.code === 'string'
              ? row.code.trim()
              : ''
          if (!code || includesCoursework(acc, code)) return acc
          acc.push(code)
          return acc
        }, [])

        setSuggestedCoursework(nextSuggestions)
        setSuggestionsLoading(false)
      })()
    }, 150)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [major, selectedUniversity])

  function addCourseworkItem(value: string) {
    const normalized = normalizeCourseworkName(value)
    if (!normalized || includesCoursework(coursework, normalized)) return
    setCoursework((prev) => [...prev, normalized])
    setCourseworkInput('')
  }

  function removeCourseworkItem(value: string) {
    setCoursework((prev) =>
      prev.filter((item) => normalizeCourseworkName(item).toLowerCase() !== normalizeCourseworkName(value).toLowerCase())
    )
  }

  function toggleAvailability(season: (typeof seasons)[number]) {
    setAvailability((prev) =>
      prev.includes(season) ? prev.filter((item) => item !== season) : [...prev, season]
    )
  }

  async function saveProfile() {
    setError(null)
    setSuccess(null)
    setUniversityError(null)

    if (!selectedUniversity) {
      setUniversityError('Please select a university from the list.')
      setError('Please select a verified university before saving.')
      return
    }

    if (availability.length === 0) {
      setError('Select at least one season.')
      return
    }

    setSaving(true)
    const supabase = supabaseBrowser()

    const safeExperienceLevel = normalizeExperienceLevel(experienceLevel)
    const normalizedCourseworkList = coursework
      .map((course) => normalizeCourseworkName(course))
      .filter(Boolean)
    const normalizedCourseworkText =
      normalizedCourseworkList.length > 0 ? normalizedCourseworkList.join(', ') : ''
    const normalizedMajor = major.trim() || null

    const basePayload = {
      user_id: userId,
      university_id: selectedUniversity.id,
      school: selectedUniversity.name,
      year: graduationYear.trim() || null,
      experience_level: safeExperienceLevel,
      availability_start_month: availabilityStartMonth.trim() || null,
      availability_hours_per_week: Number(availabilityHoursPerWeek),
    }

    function buildPayloadVariants(options: {
      includeUniversityId: boolean
      includePreferences: boolean
    }): Array<Record<string, unknown>> {
      const payloadBase: Record<string, unknown> = { ...basePayload }
      if (!options.includeUniversityId) {
        delete payloadBase.university_id
      }

      const attachPreferences = (payload: Record<string, unknown>) =>
        options.includePreferences
          ? { ...payload, preferences: { remoteOk, seasons: availability } }
          : payload

      return [
        attachPreferences({
          ...payloadBase,
          majors: normalizedMajor,
          coursework: normalizedCourseworkText,
        }),
        attachPreferences({
          ...payloadBase,
          majors: normalizedMajor ? [normalizedMajor] : null,
          coursework: normalizedCourseworkText,
        }),
        attachPreferences({
          ...payloadBase,
          majors: normalizedMajor,
          coursework: normalizedCourseworkList.length > 0 ? normalizedCourseworkList : [],
        }),
        attachPreferences({
          ...payloadBase,
          majors: normalizedMajor ? [normalizedMajor] : null,
          coursework: normalizedCourseworkList.length > 0 ? normalizedCourseworkList : [],
        }),
      ]
    }

    async function tryUpserts(variants: Array<Record<string, unknown>>) {
      const errors: string[] = []
      let lastMessage = ''

      for (const payload of variants) {
        const { error: saveError } = await supabase.from('student_profiles').upsert(payload, {
          onConflict: 'user_id',
        })

        if (!saveError) {
          return { saved: true, errors, lastMessage: '' }
        }

        lastMessage = saveError.message
        errors.push(saveError.message.toLowerCase())
      }

      return { saved: false, errors, lastMessage }
    }

    const fallbackConfigs = [
      { includeUniversityId: true, includePreferences: true },
      { includeUniversityId: true, includePreferences: false },
      { includeUniversityId: false, includePreferences: true },
      { includeUniversityId: false, includePreferences: false },
    ] as const

    let attempt = { saved: false, errors: [] as string[], lastMessage: '' }
    let saved = false

    for (const config of fallbackConfigs) {
      attempt = await tryUpserts(buildPayloadVariants(config))
      if (attempt.saved) {
        saved = true
        break
      }
    }

    setSaving(false)

    if (!saved) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[StudentProfileSave] failed:', attempt.lastMessage || 'unknown error')
      }
      setError(attempt.lastMessage || 'Unable to save profile right now. Please try again.')
      return
    }

    setSuccess('Preferences saved.')
    setMode('view')
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Student account</h1>
          <p className="mt-1 text-sm text-slate-600">
            {mode === 'view' ? 'Your saved profile settings.' : 'Update your profile in about a minute.'}
          </p>
        </div>
        {mode === 'view' && (
          <button
            type="button"
            onClick={() => {
              setSuccess(null)
              setMode('edit')
            }}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit profile
          </button>
        )}
      </div>

      {mode === 'edit' && !hasSavedProfile && (
        <div className="mt-5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Set your preferences to get better matches.
        </div>
      )}

      {loading && (
        <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Loading latest profile...
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {mode === 'view' ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">University</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{selectedUniversity?.name || universityQuery || 'Not set'}</div>
            {!selectedUniversity && universityQuery && (
              <div className="mt-1 text-xs text-amber-700">Unverified university. Edit profile to verify.</div>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Major / interest area</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{major || 'Not set'}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Graduation year</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{graduationYear || 'Not set'}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Experience level</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{getExperienceLabel(experienceLevel)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Availability start month</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{availabilityStartMonth || 'Not set'}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Hours per week</div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              {availabilityHoursPerWeek ? `${availabilityHoursPerWeek} hours/week` : 'Not set'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Coursework</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {coursework.length > 0 ? (
                coursework.map((course) => (
                  <span
                    key={course}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700"
                  >
                    {course}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-700">Not set</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Season preferences</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {availability.length > 0 ? (
                availability.map((season) => (
                  <span
                    key={season}
                    className="rounded-full border border-blue-600 bg-blue-50 px-3 py-1 text-sm text-blue-700"
                  >
                    {season}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-700">Not set</span>
              )}
            </div>
            <div className="mt-3 text-sm text-slate-700">Remote OK: {remoteOk ? 'Yes' : 'No'}</div>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <UniversityCombobox
                query={universityQuery}
                onQueryChange={(value) => {
                  setUniversityQuery(value)
                  setUniversityError(null)
                  setUniversitySearchError(null)
                  setError(null)
                  if (selectedUniversity && value.trim() !== selectedUniversity.name) {
                    setSelectedUniversity(null)
                  }
                }}
                options={universityOptions}
                selectedUniversity={selectedUniversity}
                onSelect={(university) => {
                  setSelectedUniversity(university)
                  setUniversityQuery(university.name)
                  setUniversityOptions([])
                  setUniversityError(null)
                }}
                loading={universityLoading}
                error={universityError ?? (process.env.NODE_ENV !== 'production' ? universitySearchError : null)}
              />
              {!selectedUniversity && universityQuery.trim().length > 0 && !universityError && (
                <p className="mt-1 text-xs text-amber-700">Select a verified university from the dropdown list.</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Major / interest area</label>
              <select className={FIELD} value={major} onChange={(e) => setMajor(e.target.value)}>
                {interestAreas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Graduation year</label>
              <select className={FIELD} value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)}>
                {graduationYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Relevant experience (in your intended field)
              </label>
              <select
                className={FIELD}
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(normalizeExperienceLevel(e.target.value))}
              >
                {experienceLevels.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Not about having any job—about experience related to your major/career path.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Availability start month</label>
              <select
                className={FIELD}
                value={availabilityStartMonth}
                onChange={(e) => setAvailabilityStartMonth(e.target.value)}
              >
                {months.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Availability hours per week</label>
              <select
                className={FIELD}
                value={String(availabilityHoursPerWeek)}
                onChange={(e) => setAvailabilityHoursPerWeek(Number(e.target.value))}
              >
                {hoursPerWeekOptions.map((hours) => (
                  <option key={hours} value={hours}>
                    {hours}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Coursework</label>
              {(suggestionsLoading || suggestedCoursework.length > 0) && (
                <div className="mt-2">
                  <div className="text-xs text-slate-500">Suggested coursework</div>
                  {suggestionsLoading ? (
                    <div className="mt-2 text-sm text-slate-500">Loading suggestions...</div>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {suggestedCoursework.map((course) => {
                        const added = includesCoursework(coursework, course)
                        return (
                          <button
                            key={course}
                            type="button"
                            onClick={() => addCourseworkItem(course)}
                            disabled={added}
                            className={`rounded-full border px-3 py-1 text-sm ${
                              added
                                ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
                                : 'border-blue-600 bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                          >
                            {course}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="relative mt-3">
                <input
                  className={FIELD}
                  value={courseworkInput}
                  onChange={(e) => setCourseworkInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCourseworkItem(courseworkInput)
                    }
                  }}
                  placeholder="Add coursework"
                />
                {courseworkInput.trim().length > 0 && filteredCourseworkOptions.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                    {filteredCourseworkOptions.map((course) => (
                      <button
                        key={course}
                        type="button"
                        onClick={() => addCourseworkItem(course)}
                        className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {course}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">Press Enter to add custom coursework.</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {coursework.length > 0 ? (
                  coursework.map((course) => (
                    <button
                      key={course}
                      type="button"
                      onClick={() => removeCourseworkItem(course)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {course} ×
                    </button>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">No coursework added yet.</span>
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <div className="text-sm font-medium text-slate-700">Season preferences</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {seasons.map((season) => {
                  const active = availability.includes(season)
                  return (
                    <button
                      key={season}
                      type="button"
                      onClick={() => toggleAvailability(season)}
                      className={`rounded-full border px-3 py-1 text-sm ${
                        active
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {season}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                  checked={remoteOk}
                  onChange={(e) => setRemoteOk(e.target.checked)}
                />
                Remote OK
              </label>
            </div>
          </div>

          <div className="mt-8">
            <button
              type="button"
              onClick={saveProfile}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-md bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
