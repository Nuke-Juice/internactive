'use client'

import type { ListingStep4FieldKey } from './types'

type Props = {
  shortSummary: string
  responsibilities: string[]
  minimumQualifications: string
  qualifications: string
  preferredQualifications: string
  descriptionRaw: string
  screeningQuestion: string
  complianceEeoProvided: boolean
  compliancePayTransparencyProvided: boolean
  complianceAtWillProvided: boolean
  complianceAccommodationsProvided: boolean
  complianceAccommodationsEmail: string
  complianceText: string
  sourcePlatform: string
  sourcePostedDate: string
  sourceApplicantCount: string
  sourcePromoted: boolean
  sourceResponsesManagedOffPlatform: boolean
  fieldErrors?: Partial<Record<ListingStep4FieldKey, string>>
  onChange: (patch: Partial<Record<string, string>>) => void
  onResponsibilitiesChange: (items: string[]) => void
}

function splitToResponsibilityLines(value: string) {
  const normalized = value.replace(/\r\n/g, '\n').trim()
  if (!normalized) return ['']
  const lines = normalized
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
  if (lines.length <= 1) {
    return [normalized.replace(/^[-*•\s]+/, '').trim()]
  }
  return lines.map((item) => item.replace(/^[-*•\s]+/, '').trim()).filter(Boolean)
}

function sanitizeSummaryInput(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/^[\s•\-–—]+/, '')
}

export default function ListingStepDescription(props: Props) {
  const summaryLength = props.shortSummary.length

  return (
    <div className="space-y-4">
      <div>
        <label className="inline-flex items-center gap-1 text-sm font-medium text-slate-700">
          Role overview
          {props.fieldErrors?.short_summary ? <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-hidden="true" /> : null}
        </label>
        <textarea
          name="short_summary"
          rows={4}
          maxLength={600}
          value={props.shortSummary}
          onChange={(event) => props.onChange({ shortSummary: event.target.value })}
          onBlur={(event) => props.onChange({ shortSummary: sanitizeSummaryInput(event.target.value).trim() })}
          className={`mt-1 w-full rounded-md border bg-white p-2 text-sm ${
            props.fieldErrors?.short_summary ? 'border-red-300' : 'border-slate-300'
          }`}
          placeholder="Describe the role context and impact (2-4 sentences). This appears first in Role overview."
        />
        <p className="mt-1 text-xs text-slate-500">{summaryLength}/600. Longer overview is encouraged.</p>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Responsibilities</label>
        <textarea
          rows={4}
          value={props.responsibilities.join('\n')}
          onChange={(event) => props.onResponsibilitiesChange(splitToResponsibilityLines(event.target.value))}
          onBlur={(event) => props.onResponsibilitiesChange(splitToResponsibilityLines(event.target.value))}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
          placeholder="Free-form responsibilities. Write naturally; bullets are optional."
        />
        <p className="mt-1 text-xs text-slate-500">Free fill is allowed. We format this for student display.</p>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Minimum qualifications</label>
        <textarea
          name="minimum_qualifications"
          rows={4}
          value={props.minimumQualifications}
          onChange={(event) => props.onChange({ minimumQualifications: event.target.value })}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
          placeholder="Baseline requirements (e.g., pursuing BS or MBA/MS)."
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Qualifications</label>
        <textarea
          name="qualifications"
          rows={5}
          value={props.qualifications}
          onChange={(event) => props.onChange({ qualifications: event.target.value })}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
          placeholder="Free-form qualifications. One block or multiple lines are both okay."
        />
        <p className="mt-1 text-xs text-slate-500">
          Qualifications are shown to students. Matching is driven primarily by required skills + coursework categories.
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Desired qualifications</label>
        <textarea
          name="preferred_qualifications"
          rows={4}
          value={props.preferredQualifications}
          onChange={(event) => props.onChange({ preferredQualifications: event.target.value })}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
          placeholder="Nice-to-have qualifications (e.g., accounting or analytics experience)."
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Optional screening question</label>
        <input
          name="screening_question"
          value={props.screeningQuestion}
          onChange={(event) => props.onChange({ screeningQuestion: event.target.value })}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
          placeholder="What project are you most proud of and why?"
        />
      </div>

      <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-800">Compliance & EEO (optional)</summary>
        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={props.complianceEeoProvided}
              onChange={(event) => props.onChange({ complianceEeoProvided: event.target.checked ? '1' : '0' })}
            />
            EEO statement included
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={props.compliancePayTransparencyProvided}
              onChange={(event) => props.onChange({ compliancePayTransparencyProvided: event.target.checked ? '1' : '0' })}
            />
            Pay transparency language included
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={props.complianceAtWillProvided}
              onChange={(event) => props.onChange({ complianceAtWillProvided: event.target.checked ? '1' : '0' })}
            />
            At-will language included
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={props.complianceAccommodationsProvided}
              onChange={(event) => props.onChange({ complianceAccommodationsProvided: event.target.checked ? '1' : '0' })}
            />
            Reasonable accommodations statement included
          </label>
          <input
            name="compliance_accommodations_email"
            value={props.complianceAccommodationsEmail}
            onChange={(event) => props.onChange({ complianceAccommodationsEmail: event.target.value })}
            className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
            placeholder="Accommodation contact email"
          />
          <textarea
            name="compliance_text"
            rows={3}
            value={props.complianceText}
            onChange={(event) => props.onChange({ complianceText: event.target.value })}
            className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
            placeholder="Optional compliance/EEO legal text block"
          />
          <input type="hidden" name="compliance_eeo_provided" value={props.complianceEeoProvided ? '1' : '0'} />
          <input type="hidden" name="compliance_pay_transparency_provided" value={props.compliancePayTransparencyProvided ? '1' : '0'} />
          <input type="hidden" name="compliance_at_will_provided" value={props.complianceAtWillProvided ? '1' : '0'} />
          <input type="hidden" name="compliance_accommodations_provided" value={props.complianceAccommodationsProvided ? '1' : '0'} />
        </div>
      </details>

      <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-800">External source metadata (optional)</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            name="source_platform"
            value={props.sourcePlatform}
            onChange={(event) => props.onChange({ sourcePlatform: event.target.value })}
            className="rounded-md border border-slate-300 bg-white p-2 text-sm"
            placeholder="Platform (e.g., LinkedIn)"
          />
          <input
            name="source_posted_date"
            type="date"
            value={props.sourcePostedDate}
            onChange={(event) => props.onChange({ sourcePostedDate: event.target.value })}
            className="rounded-md border border-slate-300 bg-white p-2 text-sm"
          />
          <input
            name="source_applicant_count"
            type="number"
            min={0}
            value={props.sourceApplicantCount}
            onChange={(event) => props.onChange({ sourceApplicantCount: event.target.value })}
            className="rounded-md border border-slate-300 bg-white p-2 text-sm"
            placeholder="Applicants (approx.)"
          />
          <label className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={props.sourcePromoted}
              onChange={(event) => props.onChange({ sourcePromoted: event.target.checked ? '1' : '0' })}
            />
            Promoted listing
          </label>
          <label className="sm:col-span-2 flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={props.sourceResponsesManagedOffPlatform}
              onChange={(event) => props.onChange({ sourceResponsesManagedOffPlatform: event.target.checked ? '1' : '0' })}
            />
            Responses managed off platform
          </label>
          <input type="hidden" name="source_promoted" value={props.sourcePromoted ? '1' : '0'} />
          <input type="hidden" name="source_responses_managed_off_platform" value={props.sourceResponsesManagedOffPlatform ? '1' : '0'} />
        </div>
      </details>

      <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-800">Raw source description (optional)</summary>
        <textarea
          name="description_raw"
          rows={5}
          value={props.descriptionRaw}
          onChange={(event) => props.onChange({ descriptionRaw: event.target.value })}
          className="mt-3 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
          placeholder="Paste original posting text for transparency."
        />
      </details>
    </div>
  )
}
