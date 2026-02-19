'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { US_CITY_OPTIONS } from '@/lib/locations/usLocationCatalog'
import type { ApplyMode, AtsStageMode, ListingStep1FieldKey, WorkMode } from './types'

type Props = {
  title: string
  category: string
  workMode: WorkMode
  locationCity: string
  locationState: string
  applyMode: ApplyMode
  atsStageMode: AtsStageMode
  externalApplyUrl: string
  externalApplyType: string
  categories: string[]
  fieldErrors?: Partial<Record<ListingStep1FieldKey, string>>
  onChange: (patch: Partial<Record<string, string>>) => void
}

function LabelWithError(props: { text: string; hasError: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700">
      {props.text}
      {props.hasError ? <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-hidden="true" /> : null}
    </span>
  )
}

function hostnameFromUrl(value: string) {
  const input = value.trim()
  if (!input) return ''
  try {
    const parsed = new URL(input)
    return parsed.hostname
  } catch {
    return ''
  }
}

export default function ListingStepBasics(props: Props) {
  const titleLength = props.title.trim().length
  const [cityMenuOpen, setCityMenuOpen] = useState(false)
  const [cityActiveIndex, setCityActiveIndex] = useState(0)
  const [cityInputValue, setCityInputValue] = useState(props.locationCity)
  const isCityFocusedRef = useRef(false)

  useEffect(() => {
    if (isCityFocusedRef.current) return
    const timer = setTimeout(() => setCityInputValue(props.locationCity), 0)
    return () => clearTimeout(timer)
  }, [props.locationCity])

  const cityOptions = useMemo(() => {
    const query = cityInputValue.trim().toLowerCase()
    const pool = US_CITY_OPTIONS.filter((option) => {
      if (!query) return true
      return option.city.toLowerCase().includes(query) || `${option.city}, ${option.state}`.toLowerCase().includes(query)
    })
    return pool.slice(0, 8)
  }, [cityInputValue])

  const selectCity = (city: string, state: string) => {
    setCityInputValue(city)
    props.onChange({ locationCity: city, locationState: state })
    setCityMenuOpen(false)
    setCityActiveIndex(0)
  }

  const applicationModeSelection: 'native' | 'curated' | 'immediate' =
    props.applyMode === 'native' ? 'native' : props.atsStageMode === 'curated' ? 'curated' : 'immediate'
  const externalApplyBehavior = props.externalApplyType === 'redirect' ? 'redirect' : 'new_tab'
  const derivedAtsLabel = hostnameFromUrl(props.externalApplyUrl)

  return (
    <div className="space-y-4">
      <div>
        <label><LabelWithError text="Title" hasError={Boolean(props.fieldErrors?.title)} /></label>
        <input
          name="title"
          value={props.title}
          onChange={(event) => props.onChange({ title: event.target.value })}
          className={`mt-1 w-full rounded-md border bg-white p-2 text-sm ${
            props.fieldErrors?.title ? 'border-red-300' : 'border-slate-300'
          }`}
          placeholder="e.g., Finance Intern"
        />
        <p className="mt-1 text-xs text-slate-500">Keep it under 60 characters for better scanability ({titleLength}/60).</p>
      </div>

      <div>
        <label><LabelWithError text="Role category" hasError={Boolean(props.fieldErrors?.category)} /></label>
        <select
          name="category"
          value={props.category}
          onChange={(event) => props.onChange({ category: event.target.value })}
          className={`mt-1 w-full rounded-md border bg-white p-2 text-sm ${
            props.fieldErrors?.category ? 'border-red-300' : 'border-slate-300'
          }`}
        >
          <option value="">Select category</option>
          {props.categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label><LabelWithError text="Location type" hasError={Boolean(props.fieldErrors?.work_mode)} /></label>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {[
            { value: 'remote', label: 'Remote' },
            { value: 'hybrid', label: 'Hybrid' },
            { value: 'in_person', label: 'In-person' },
          ].map((option) => (
            <label
              key={option.value}
              className={`flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm ${
                props.fieldErrors?.work_mode ? 'border-red-300' : 'border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="work_mode"
                value={option.value}
                checked={props.workMode === option.value}
                onChange={(event) => props.onChange({ workMode: event.target.value })}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      {props.workMode !== 'remote' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <label><LabelWithError text="City" hasError={Boolean(props.fieldErrors?.location_city)} /></label>
            <input
              name="location_city"
              value={cityInputValue}
              onChange={(event) => {
                const nextValue = event.target.value
                setCityInputValue(nextValue)
                props.onChange({ locationCity: nextValue })
                setCityMenuOpen(true)
                setCityActiveIndex(0)
              }}
              onFocus={() => {
                isCityFocusedRef.current = true
                setCityMenuOpen(true)
              }}
              onBlur={() => {
                isCityFocusedRef.current = false
                setTimeout(() => setCityMenuOpen(false), 120)
              }}
              onKeyDown={(event) => {
                if (!cityMenuOpen || cityOptions.length === 0) return
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setCityActiveIndex((prev) => (prev + 1) % cityOptions.length)
                  return
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setCityActiveIndex((prev) => (prev - 1 + cityOptions.length) % cityOptions.length)
                  return
                }
                if (event.key === 'Enter') {
                  event.preventDefault()
                  const picked = cityOptions[cityActiveIndex]
                  if (picked) selectCity(picked.city, picked.state)
                  return
                }
                if (event.key === 'Escape') {
                  setCityMenuOpen(false)
                }
              }}
              className={`mt-1 w-full rounded-md border bg-white p-2 text-sm ${
                props.fieldErrors?.location_city ? 'border-red-300' : 'border-slate-300'
              }`}
              placeholder="Type city"
              autoComplete="off"
              aria-controls="listing-city-options"
              aria-autocomplete="list"
            />
            {cityMenuOpen && cityOptions.length > 0 ? (
              <div
                id="listing-city-options"
                role="listbox"
                className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
              >
                {cityOptions.map((option, index) => (
                  <button
                    key={`${option.city}-${option.state}`}
                    type="button"
                    role="option"
                    aria-selected={index === cityActiveIndex}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      selectCity(option.city, option.state)
                    }}
                    className={`block w-full px-3 py-2 text-left text-sm ${
                      index === cityActiveIndex ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {option.city}, {option.state}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div>
            <label><LabelWithError text="State" hasError={Boolean(props.fieldErrors?.location_state)} /></label>
            <input
              name="location_state"
              value={props.locationState}
              onChange={(event) => props.onChange({ locationState: event.target.value.toUpperCase() })}
              className={`mt-1 w-full rounded-md border bg-slate-50 p-2 text-sm ${
                props.fieldErrors?.location_state ? 'border-red-300' : 'border-slate-300'
              }`}
              placeholder="UT"
              maxLength={2}
            />
          </div>
        </div>
      ) : null}

      <div id="application-settings" className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Application settings</h3>
          <p className="mt-1 text-xs text-slate-600">Set how candidates apply and where ATS invites should send them.</p>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Application mode</legend>
          <div className="mt-2 space-y-2">
            <label className="flex items-start gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
              <input
                type="radio"
                name="application_mode_selection"
                value="native"
                checked={applicationModeSelection === 'native'}
                onChange={() => props.onChange({ applyMode: 'native', atsStageMode: 'curated' })}
              />
              <span>Internactive Quick Apply only</span>
            </label>
            <label className="flex items-start gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
              <input
                type="radio"
                name="application_mode_selection"
                value="curated"
                checked={applicationModeSelection === 'curated'}
                onChange={() => props.onChange({ applyMode: 'hybrid', atsStageMode: 'curated' })}
              />
              <span>Curated ATS (invite required)</span>
            </label>
            <label className="flex items-start gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
              <input
                type="radio"
                name="application_mode_selection"
                value="immediate"
                checked={applicationModeSelection === 'immediate'}
                onChange={() => props.onChange({ applyMode: 'ats_link', atsStageMode: 'immediate' })}
              />
              <span>Immediate external redirect</span>
            </label>
          </div>
          <input type="hidden" name="apply_mode" value={props.applyMode} />
          <input type="hidden" name="ats_stage_mode" value={props.atsStageMode} />
        </fieldset>

        {(props.applyMode === 'ats_link' || props.applyMode === 'hybrid') ? (
          <div className="space-y-3">
            <div>
              <label><LabelWithError text="Official application URL" hasError={Boolean(props.fieldErrors?.external_apply_url)} /></label>
              <input
                name="external_apply_url"
                type="url"
                value={props.externalApplyUrl}
                onChange={(event) => props.onChange({ externalApplyUrl: event.target.value })}
                className={`mt-1 w-full rounded-md border bg-white p-2 text-sm ${
                  props.fieldErrors?.external_apply_url ? 'border-red-300' : 'border-slate-300'
                }`}
                placeholder="https://jobs.company.com/..."
                maxLength={2048}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">ATS label (optional)</label>
              <input
                value={derivedAtsLabel}
                readOnly
                className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 p-2 text-sm text-slate-600"
                placeholder="Derived from URL hostname"
              />
              <p className="mt-1 text-xs text-slate-500">Label is derived automatically from your URL hostname.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Open behavior</label>
              <select
                name="external_apply_type"
                value={externalApplyBehavior}
                onChange={(event) => props.onChange({ externalApplyType: event.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
              >
                <option value="new_tab">Open in new tab</option>
                <option value="redirect">Open in same tab (redirect)</option>
              </select>
            </div>
            <p className="text-xs text-slate-600">
              {applicationModeSelection === 'curated'
                ? 'Curated: Students Quick Apply first. You invite top candidates to complete the official application.'
                : 'Immediate: Students are sent directly to your official application.'}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
