import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/requireRole'
import { normalizeExternalApplyUrl } from '@/lib/apply/externalApply'
import { normalizeEmployerAtsDefaultMode } from '@/lib/apply/effectiveAts'
import { supabaseServer } from '@/lib/supabase/server'
import EmployerDashboardHeader from '@/components/employer/EmployerDashboardHeader'

type SearchParams = Promise<{ success?: string; error?: string; internship_id?: string }>

type EmployerSettingsRow = {
  default_ats_stage_mode: string | null
  default_external_apply_url: string | null
  default_external_apply_type: string | null
  default_external_apply_label: string | null
}

export default async function EmployerAtsSettingsPage({ searchParams }: { searchParams?: SearchParams }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const selectedInternshipId = String(resolvedSearchParams?.internship_id ?? '').trim()
  const { user } = await requireRole('employer', { requestedPath: '/dashboard/employer/settings' })
  const supabase = await supabaseServer()

  const [{ data: settingsRow }, { data: internshipsData }] = await Promise.all([
    supabase
      .from('employer_settings')
      .select('default_ats_stage_mode, default_external_apply_url, default_external_apply_type, default_external_apply_label')
      .eq('employer_id', user.id)
      .maybeSingle(),
    supabase.from('internships').select('id, title').eq('employer_id', user.id).order('created_at', { ascending: false }).limit(200),
  ])

  const settings = (settingsRow ?? null) as EmployerSettingsRow | null
  const internships = (internshipsData ?? []) as Array<{ id: string; title: string | null }>
  const internshipIds = internships.map((row) => row.id)
  const activeInternshipId =
    selectedInternshipId && internshipIds.includes(selectedInternshipId) ? selectedInternshipId : (internshipIds[0] ?? '')
  const defaultMode = normalizeEmployerAtsDefaultMode(settings?.default_ats_stage_mode)
  const defaultUrl = settings?.default_external_apply_url ?? ''
  const defaultType = settings?.default_external_apply_type === 'redirect' ? 'redirect' : 'new_tab'
  const defaultLabel = settings?.default_external_apply_label ?? ''

  async function saveSettings(formData: FormData) {
    'use server'

    const { user: currentUser } = await requireRole('employer', { requestedPath: '/dashboard/employer/settings' })
    const supabaseAction = await supabaseServer()

    const mode = normalizeEmployerAtsDefaultMode(String(formData.get('default_ats_stage_mode') ?? 'none'))
    const urlInput = String(formData.get('default_external_apply_url') ?? '').trim()
    const normalizedUrl = normalizeExternalApplyUrl(urlInput)
    const openType = String(formData.get('default_external_apply_type') ?? '').trim().toLowerCase() === 'redirect'
      ? 'redirect'
      : 'new_tab'
    const label = String(formData.get('default_external_apply_label') ?? '').trim().slice(0, 120)

    if (mode !== 'none' && !normalizedUrl) {
      redirect('/dashboard/employer/settings?error=Provide+a+valid+http(s)+official+application+URL')
    }

    const payload = {
      employer_id: currentUser.id,
      default_ats_stage_mode: mode,
      default_external_apply_url: mode === 'none' ? null : normalizedUrl,
      default_external_apply_type: mode === 'none' ? 'new_tab' : openType,
      default_external_apply_label: mode === 'none' ? null : (label || null),
    }

    const { error } = await supabaseAction.from('employer_settings').upsert(payload, { onConflict: 'employer_id' })
    if (error) {
      redirect(`/dashboard/employer/settings?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath('/dashboard/employer')
    revalidatePath('/dashboard/employer/applicants')
    revalidatePath('/dashboard/employer/settings')
    redirect('/dashboard/employer/settings?success=ATS+defaults+saved')
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <EmployerDashboardHeader
          title="ATS settings"
          description="Set defaults once. Listings can inherit these automatically."
          selectedInternshipId={activeInternshipId || undefined}
          internships={internships.map((row) => ({ id: row.id, title: row.title?.trim() || 'Internship' }))}
        />

        {resolvedSearchParams?.success ? (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {decodeURIComponent(resolvedSearchParams.success)}
          </div>
        ) : null}
        {resolvedSearchParams?.error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(resolvedSearchParams.error)}
          </div>
        ) : null}

        <form action={saveSettings} className="mx-auto max-w-4xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="text-sm font-medium text-slate-700">Default mode</label>
            <select
              name="default_ats_stage_mode"
              defaultValue={defaultMode}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
            >
              <option value="none">Quick Apply only (no ATS)</option>
              <option value="curated">Curated ATS (invite required)</option>
              <option value="immediate">Immediate external redirect</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Official application URL</label>
            <input
              name="default_external_apply_url"
              type="url"
              defaultValue={defaultUrl}
              placeholder="https://jobs.company.com/..."
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">Required for curated and immediate modes.</p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Open behavior</label>
            <select
              name="default_external_apply_type"
              defaultValue={defaultType}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
            >
              <option value="new_tab">Open in new tab</option>
              <option value="redirect">Open in same tab</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Optional label</label>
            <input
              name="default_external_apply_label"
              defaultValue={defaultLabel}
              placeholder="Workday, Greenhouse, Lever..."
              className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
            />
          </div>

          <div className="pt-2">
            <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Save ATS defaults
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
