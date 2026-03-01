import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireRole } from '@/lib/auth/requireRole'
import { hasCompletedConciergeIntake } from '@/lib/pilotMode'
import { supabaseServer } from '@/lib/supabase/server'

type SearchParams = Promise<{
  success?: string
  error?: string
}>

type ConciergeIntakeAnswers = {
  internship_timing?: string
  hours_per_week_now?: number | null
  hours_per_week_summer?: number | null
  preferred_roles?: string[]
  location_flexibility?: string
  work_authorization?: string
  short_pitch?: string
  constraints?: string
}

function parseRoleTokens(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/g)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

function normalizeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function normalizeAnswers(value: unknown): ConciergeIntakeAnswers {
  if (!value || typeof value !== 'object') return {}
  const input = value as Record<string, unknown>
  return {
    internship_timing: typeof input.internship_timing === 'string' ? input.internship_timing : '',
    hours_per_week_now: normalizeNumber(input.hours_per_week_now),
    hours_per_week_summer: normalizeNumber(input.hours_per_week_summer),
    preferred_roles: Array.isArray(input.preferred_roles)
      ? input.preferred_roles.map((item) => String(item).trim()).filter(Boolean)
      : [],
    location_flexibility: typeof input.location_flexibility === 'string' ? input.location_flexibility : '',
    work_authorization: typeof input.work_authorization === 'string' ? input.work_authorization : '',
    short_pitch: typeof input.short_pitch === 'string' ? input.short_pitch : '',
    constraints: typeof input.constraints === 'string' ? input.constraints : '',
  }
}

export default async function StudentPilotScreeningPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const { user } = await requireRole('student', { requestedPath: '/student/pilot-screening' })
  const supabase = await supabaseServer()
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  const { data: profile } = await supabase
    .from('student_profiles')
    .select(
      'concierge_opt_in, concierge_intake_answers, concierge_intake_completed_at, pilot_screening_answers, pilot_screening_completed_at'
    )
    .eq('user_id', user.id)
    .maybeSingle<{
      concierge_opt_in: boolean | null
      concierge_intake_answers: unknown
      concierge_intake_completed_at: string | null
      pilot_screening_answers: unknown
      pilot_screening_completed_at: string | null
    }>()

  const answers = normalizeAnswers(profile?.concierge_intake_answers ?? profile?.pilot_screening_answers)
  const isCompleted = hasCompletedConciergeIntake(profile) || Boolean(profile?.pilot_screening_completed_at)

  async function savePilotScreeningAction(formData: FormData) {
    'use server'

    const { user: actionUser } = await requireRole('student', { requestedPath: '/student/pilot-screening' })
    const actionSupabase = await supabaseServer()

    const internshipTiming = String(formData.get('internship_timing') ?? '').trim()
    const hoursNowInput = String(formData.get('hours_per_week_now') ?? '').trim()
    const hoursSummerInput = String(formData.get('hours_per_week_summer') ?? '').trim()
    const preferredRolesInput = String(formData.get('preferred_roles') ?? '').trim()
    const locationFlexibility = String(formData.get('location_flexibility') ?? '').trim()
    const workAuthorization = String(formData.get('work_authorization') ?? '').trim()
    const shortPitch = String(formData.get('short_pitch') ?? '').trim().slice(0, 1200)
    const constraints = String(formData.get('constraints') ?? '').trim().slice(0, 400)

    const hoursPerWeekNow = hoursNowInput ? Number(hoursNowInput) : null
    const hoursPerWeekSummer = hoursSummerInput ? Number(hoursSummerInput) : null

    if (!internshipTiming || !locationFlexibility || !workAuthorization || !shortPitch) {
      redirect('/student/pilot-screening?error=Please+complete+the+required+fields')
    }
    if (shortPitch.length < 80) {
      redirect('/student/pilot-screening?error=Keep+the+short+pitch+to+at+least+80+characters')
    }
    if (
      (hoursPerWeekNow !== null && (!Number.isFinite(hoursPerWeekNow) || hoursPerWeekNow < 0 || hoursPerWeekNow > 80)) ||
      (hoursPerWeekSummer !== null && (!Number.isFinite(hoursPerWeekSummer) || hoursPerWeekSummer < 0 || hoursPerWeekSummer > 80))
    ) {
      redirect('/student/pilot-screening?error=Enter+valid+hours+per+week+values')
    }

    const intakeAnswers = {
      internship_timing: internshipTiming,
      hours_per_week_now: hoursPerWeekNow === null ? null : Math.round(hoursPerWeekNow),
      hours_per_week_summer: hoursPerWeekSummer === null ? null : Math.round(hoursPerWeekSummer),
      preferred_roles: parseRoleTokens(preferredRolesInput),
      location_flexibility: locationFlexibility,
      work_authorization: workAuthorization,
      short_pitch: shortPitch,
      constraints,
    }

    const payload = {
      user_id: actionUser.id,
      concierge_opt_in: true,
      concierge_intake_answers: intakeAnswers,
      concierge_intake_completed_at: new Date().toISOString(),
      pilot_screening_answers: intakeAnswers,
      pilot_screening_completed_at: new Date().toISOString(),
    }

    const { error } = await actionSupabase.from('student_profiles').upsert(payload, { onConflict: 'user_id' })
    if (error) {
      redirect(`/student/pilot-screening?error=${encodeURIComponent(error.message)}`)
    }

    redirect('/student/pilot-screening?success=1')
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/"
          aria-label="Go back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Apply for Concierge Placement</h1>
              <p className="mt-2 text-sm text-slate-600">
                Tell us what you&apos;re looking for. We manually review your profile and introduce top-fit candidates to 1-3 employers as roles open.
              </p>
            </div>
          </div>

          {resolvedSearchParams?.error ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {resolvedSearchParams.error}
            </div>
          ) : null}
          {resolvedSearchParams?.success ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Concierge preferences saved. You are in the concierge pool.
            </div>
          ) : null}

          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Founder-led pilot: we manually review each profile and make curated introductions to employers as roles open.
          </div>

          <form action={savePilotScreeningAction} className="mt-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Availability</h2>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-800">Internship timing</label>
              <select
                name="internship_timing"
                defaultValue={answers.internship_timing ?? ''}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                <option value="">Select one</option>
                <option value="part_time_now">Part-time now</option>
                <option value="full_time_summer">Full-time summer</option>
                <option value="either">Either</option>
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-800">Hours per week now</label>
                <input
                  type="number"
                  min="0"
                  max="80"
                  name="hours_per_week_now"
                  defaultValue={answers.hours_per_week_now ?? ''}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-800">Hours per week in summer</label>
                <input
                  type="number"
                  min="0"
                  max="80"
                  name="hours_per_week_summer"
                  defaultValue={answers.hours_per_week_summer ?? ''}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-800">Target roles</label>
              <textarea
                name="preferred_roles"
                rows={3}
                defaultValue={(answers.preferred_roles ?? []).join(', ')}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="Finance analyst, operations intern, data analyst"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-800">Location flexibility</label>
              <select
                name="location_flexibility"
                defaultValue={answers.location_flexibility ?? ''}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                <option value="">Select one</option>
                <option value="in_person">In-person</option>
                <option value="hybrid">Hybrid</option>
                <option value="remote">Remote</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-800">Work authorization</label>
              <select
                name="work_authorization"
                defaultValue={answers.work_authorization ?? ''}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                <option value="">Select one</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-800">Why are you a strong fit for the roles you&apos;re targeting?</label>
              <textarea
                name="short_pitch"
                rows={6}
                defaultValue={answers.short_pitch ?? ''}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="Highlight relevant experience, skills, coursework, or projects."
              />
              <p className="mt-2 text-xs text-slate-500">Highlight relevant experience, skills, coursework, or projects. Aim for 100-200 words.</p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-800">Scheduling or placement constraints (optional)</label>
              <textarea
                name="constraints"
                rows={3}
                defaultValue={answers.constraints ?? ''}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder="Commute limits, class schedule, sponsorship constraints, or anything we should know"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Submit for Concierge Placement
              </button>
              <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}
