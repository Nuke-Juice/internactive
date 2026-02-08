'use client'

import { useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

type EmployerProfileRow = {
  company_name: string | null
  website: string | null
  contact_email: string | null
  industry: string | null
  location: string | null
}

type InternshipRow = {
  id: string
  title: string | null
  location: string | null
  pay: string | null
  created_at: string | null
}

type CompanyMeta = {
  logoUrl?: string
  about?: string
}

type Props = {
  userId: string
  userEmail: string | null
  initialProfile: EmployerProfileRow | null
  recentInternships: InternshipRow[]
}

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

const categories = ['Finance', 'Accounting', 'Data', 'Marketing', 'Operations', 'Engineering']
const workModes = ['Remote', 'Hybrid', 'On-site'] as const
const seasonOptions = ['Summer 2026', 'Fall 2026', 'Spring 2027']
const durationOptions = ['8-10 weeks', '10-12 weeks', 'Part-time (semester)']

function parseCompanyMeta(value: string | null): CompanyMeta {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as CompanyMeta
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

function buildDescription(details: {
  description: string
  category: string
  season: string
  duration: string
  applyLink: string
  applyEmail: string
}) {
  const applyLine = details.applyLink.trim()
    ? `Apply link: ${details.applyLink.trim()}`
    : `Apply email: ${details.applyEmail.trim()}`

  return [
    details.description.trim(),
    '',
    `Category: ${details.category}`,
    `Season: ${details.season}`,
    `Duration: ${details.duration}`,
    applyLine,
  ].join('\n')
}

export default function EmployerAccount({
  userId,
  userEmail,
  initialProfile,
  recentInternships,
}: Props) {
  const meta = useMemo(() => parseCompanyMeta(initialProfile?.industry ?? null), [initialProfile?.industry])

  const [companyName, setCompanyName] = useState(initialProfile?.company_name ?? '')
  const [website, setWebsite] = useState(initialProfile?.website ?? '')
  const [logoUrl, setLogoUrl] = useState(meta.logoUrl ?? '')
  const [about, setAbout] = useState(meta.about ?? '')
  const [contactEmail, setContactEmail] = useState(initialProfile?.contact_email ?? userEmail ?? '')

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(categories[0])
  const [location, setLocation] = useState('')
  const [workMode, setWorkMode] = useState<(typeof workModes)[number]>('Hybrid')
  const [isPaid, setIsPaid] = useState(true)
  const [payRange, setPayRange] = useState('$20-$28/hr')
  const [season, setSeason] = useState(seasonOptions[0])
  const [duration, setDuration] = useState(durationOptions[1])
  const [applyLink, setApplyLink] = useState('')
  const [applyEmail, setApplyEmail] = useState(initialProfile?.contact_email ?? userEmail ?? '')
  const [description, setDescription] = useState(
    'You will support day-to-day projects, collaborate with the team, and present a final recommendation.'
  )

  const [savingCompany, setSavingCompany] = useState(false)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const titleError = title.trim() ? null : 'Title is required.'
  const categoryError = category.trim() ? null : 'Category is required.'
  const locationError = location.trim() ? null : 'Location is required.'
  const applyError = applyLink.trim() || applyEmail.trim() ? null : 'Add apply link or email.'
  const descriptionError = description.trim() ? null : 'Description is required.'

  async function saveCompanyBasics() {
    setError(null)
    setSuccess(null)

    if (!companyName.trim()) {
      setError('Company name is required.')
      return
    }

    setSavingCompany(true)
    const supabase = supabaseBrowser()

    const companyMeta = logoUrl.trim() || about.trim() ? JSON.stringify({ logoUrl: logoUrl.trim() || undefined, about: about.trim() || undefined }) : null

    const { error: saveError } = await supabase.from('employer_profiles').upsert(
      {
        user_id: userId,
        company_name: companyName.trim(),
        website: website.trim() || null,
        contact_email: contactEmail.trim() || userEmail || null,
        industry: companyMeta,
        location: initialProfile?.location ?? null,
      },
      { onConflict: 'user_id' }
    )

    setSavingCompany(false)

    if (saveError) {
      setError(saveError.message)
      return
    }

    setSuccess('Company basics saved.')
  }

  async function createInternship() {
    setError(null)
    setSuccess(null)

    if (!companyName.trim()) {
      setError('Set company name first in Company Basics.')
      return
    }

    if (titleError || categoryError || locationError || applyError || descriptionError) {
      setError('Please complete the required fields in Create Internship.')
      return
    }

    setPosting(true)
    const supabase = supabaseBrowser()

    const normalizedLocation = `${location.trim()} (${workMode})`
    const combinedDescription = buildDescription({
      description,
      category,
      season,
      duration,
      applyLink,
      applyEmail,
    })

    const { error: insertError } = await supabase.from('internships').insert({
      employer_id: userId,
      title: title.trim(),
      company_name: companyName.trim(),
      location: normalizedLocation,
      description: combinedDescription,
      experience_level: 'entry',
      majors: category,
      pay: isPaid ? payRange.trim() || 'Paid (details on apply)' : 'Unpaid',
    })

    setPosting(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setTitle('')
    setLocation('')
    setApplyLink('')
    setDescription(
      'You will support day-to-day projects, collaborate with the team, and present a final recommendation.'
    )
    setSuccess('Internship created.')
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Employer account</h1>
        <p className="mt-1 text-sm text-slate-600">Save company basics once, then post internships fast.</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Company basics</h2>
        <p className="mt-1 text-sm text-slate-600">One-time setup for your posting profile.</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Company name</label>
            <input
              className={FIELD}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Ventures"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Website (optional)</label>
            <input
              className={FIELD}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://company.com"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Logo URL (optional)</label>
            <input
              className={FIELD}
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://.../logo.png"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">About (optional)</label>
            <textarea
              className={FIELD}
              rows={3}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="What your team works on and who this role is best for."
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Contact email</label>
            <input
              className={FIELD}
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="hiring@company.com"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={saveCompanyBasics}
            disabled={savingCompany}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {savingCompany ? 'Saving...' : 'Save company basics'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Create internship</h2>
          <p className="mt-1 text-sm text-slate-600">Light form with sensible defaults.</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Title</label>
              <input
                className={FIELD}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Business Operations Intern"
              />
              {titleError && <p className="mt-1 text-xs text-red-600">{titleError}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Category</label>
              <select className={FIELD} value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Location</label>
              <input
                className={FIELD}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Salt Lake City, UT"
              />
              {locationError && <p className="mt-1 text-xs text-red-600">{locationError}</p>}
            </div>

            <div className="sm:col-span-2">
              <div className="text-sm font-medium text-slate-700">Work mode</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {workModes.map((mode) => {
                  const active = workMode === mode
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setWorkMode(mode)}
                      className={`rounded-full border px-3 py-1 text-sm ${
                        active
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {mode}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                  checked={isPaid}
                  onChange={(e) => setIsPaid(e.target.checked)}
                />
                Paid
              </label>
              {isPaid && (
                <input
                  className={FIELD}
                  value={payRange}
                  onChange={(e) => setPayRange(e.target.value)}
                  placeholder="$20-$28/hr"
                />
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Season</label>
              <select className={FIELD} value={season} onChange={(e) => setSeason(e.target.value)}>
                {seasonOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Duration</label>
              <select className={FIELD} value={duration} onChange={(e) => setDuration(e.target.value)}>
                {durationOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Apply link</label>
              <input
                className={FIELD}
                value={applyLink}
                onChange={(e) => setApplyLink(e.target.value)}
                placeholder="https://jobs.company.com/role"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Apply email</label>
              <input
                className={FIELD}
                value={applyEmail}
                onChange={(e) => setApplyEmail(e.target.value)}
                placeholder="hiring@company.com"
              />
              {applyError && <p className="mt-1 text-xs text-red-600">{applyError}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Description</label>
              <textarea
                className={FIELD}
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="You will support day-to-day projects, collaborate with the team, and present a final recommendation."
              />
              {descriptionError && <p className="mt-1 text-xs text-red-600">{descriptionError}</p>}
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={createInternship}
              disabled={posting}
              className="inline-flex items-center justify-center rounded-md bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {posting ? 'Creating...' : 'Create internship'}
            </button>
          </div>
        </div>

        <aside className="hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:block">
          <h3 className="text-sm font-semibold text-slate-900">Live preview</h3>
          <div className="mt-4 rounded-xl border border-slate-200 p-4">
            <div className="text-sm font-semibold text-slate-900">{title.trim() || 'Internship title'}</div>
            <div className="mt-1 text-xs text-slate-500">{companyName.trim() || 'Company name'}</div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-slate-300 px-2 py-1 text-slate-700">
                {location.trim() || 'Location'} ({workMode})
              </span>
              <span className="rounded-full border border-slate-300 px-2 py-1 text-slate-700">{category}</span>
              <span className="rounded-full border border-slate-300 px-2 py-1 text-slate-700">
                {isPaid ? payRange || 'Paid' : 'Unpaid'}
              </span>
            </div>
            <p className="mt-3 line-clamp-4 text-xs text-slate-600">{description || 'Description preview'}</p>
          </div>

          <div className="mt-6">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent listings</h4>
            {recentInternships.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">No listings yet.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {recentInternships.map((listing) => (
                  <div key={listing.id} className="rounded-lg border border-slate-200 p-2">
                    <div className="text-xs font-medium text-slate-900">{listing.title || 'Internship'}</div>
                    <div className="text-xs text-slate-500">{listing.location || 'TBD'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}
