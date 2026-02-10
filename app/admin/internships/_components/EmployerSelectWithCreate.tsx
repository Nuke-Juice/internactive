'use client'

import { useState } from 'react'

type EmployerOption = {
  user_id: string
  company_name: string | null
}

type Props = {
  employers: EmployerOption[]
  selectedEmployerId: string
  createEmployerAction: (formData: FormData) => void | Promise<void>
  q: string
  page: number
  template: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function EmployerSelectWithCreate({
  employers,
  selectedEmployerId,
  createEmployerAction,
  q,
  page,
  template,
}: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-slate-700">Employer</label>
        <button
          type="button"
          onClick={() => {
            setClientError(null)
            setIsModalOpen(true)
          }}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          + New employer
        </button>
      </div>
      <select
        name="employer_id"
        required
        defaultValue={selectedEmployerId}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900"
      >
        <option value="">Select employer</option>
        {employers.map((employer) => (
          <option key={employer.user_id} value={employer.user_id}>
            {employer.company_name?.trim() || employer.user_id}
          </option>
        ))}
      </select>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-900">New employer</h4>
                <p className="mt-1 text-xs text-slate-600">Create an employer profile and auto-select it for this internship.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <input type="hidden" name="q" value={q} />
              <input type="hidden" name="page" value={String(page)} />
              <input type="hidden" name="template" value={template} />

              <div>
                <label className="text-xs font-medium text-slate-700">Company name</label>
                <input
                  name="company_name"
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                  placeholder="e.g., Canyon Capital"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">Website (optional)</label>
                <input
                  name="website"
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700">Contact email (recommended)</label>
                <input
                  name="contact_email"
                  type="email"
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400"
                  placeholder="team@company.com"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Recommended for claim links and employer summaries. If blank, a placeholder email is used.
                </p>
              </div>

              {clientError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{clientError}</div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  formAction={createEmployerAction}
                  formNoValidate
                  onClick={(event) => {
                    const ownerForm = event.currentTarget.form
                    if (!ownerForm) return

                    const companyNameInput = ownerForm.elements.namedItem('company_name') as HTMLInputElement | null
                    const contactEmailInput = ownerForm.elements.namedItem('contact_email') as HTMLInputElement | null
                    const companyName = companyNameInput?.value.trim() ?? ''
                    const contactEmail = (contactEmailInput?.value ?? '').trim()

                    if (!companyName) {
                      event.preventDefault()
                      setClientError('Company name is required.')
                      return
                    }
                    if (contactEmail && !EMAIL_REGEX.test(contactEmail)) {
                      event.preventDefault()
                      setClientError('Contact email must be a valid email address.')
                      return
                    }
                    setClientError(null)
                  }}
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Save employer
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
