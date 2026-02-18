'use client'

import type { ListingStep4FieldKey } from './types'

type Props = {
  shortSummary: string
  responsibilities: string[]
  qualifications: string
  screeningQuestion: string
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
        <label className="text-sm font-medium text-slate-700">Optional screening question</label>
        <input
          name="screening_question"
          value={props.screeningQuestion}
          onChange={(event) => props.onChange({ screeningQuestion: event.target.value })}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
          placeholder="What project are you most proud of and why?"
        />
      </div>
    </div>
  )
}
