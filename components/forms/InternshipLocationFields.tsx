'use client'

import { useMemo, useState } from 'react'
import { US_CITY_OPTIONS, US_STATE_OPTIONS, normalizeStateCode } from '@/lib/locations/usLocationCatalog'

type Props = {
  cityName?: string
  stateName?: string
  defaultCity?: string | null
  defaultState?: string | null
  labelClassName?: string
  selectClassName?: string
  errorMessage?: string | null
}

export default function InternshipLocationFields({
  cityName = 'location_city',
  stateName = 'location_state',
  defaultCity,
  defaultState,
  labelClassName = 'text-xs font-medium text-slate-700',
  selectClassName = 'mt-1 w-full rounded-md border border-slate-300 p-2 text-sm',
  errorMessage,
}: Props) {
  const initialState = normalizeStateCode(defaultState)
  const initialCity = (defaultCity ?? '').trim()
  const [selectedState, setSelectedState] = useState(initialState)
  const [selectedCity, setSelectedCity] = useState(initialCity)

  const cityOptions = useMemo(
    () => US_CITY_OPTIONS.filter((option) => option.state === selectedState).map((option) => option.city),
    [selectedState]
  )
  const hasKnownCityForState = cityOptions.includes(selectedCity)
  const isCityDisabled = !selectedState

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className={labelClassName}>Location state</label>
        <select
          name={stateName}
          value={selectedState}
          onChange={(event) => {
            const nextState = normalizeStateCode(event.target.value)
            setSelectedState(nextState)
            if (!nextState) {
              setSelectedCity('')
              return
            }
            if (!US_CITY_OPTIONS.some((option) => option.state === nextState && option.city === selectedCity)) {
              setSelectedCity('')
            }
          }}
          className={selectClassName}
        >
          <option value="">Select state</option>
          {US_STATE_OPTIONS.map((state) => (
            <option key={state.code} value={state.code}>
              {state.name} ({state.code})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClassName}>Location city</label>
        <select
          name={cityName}
          value={selectedCity}
          onChange={(event) => setSelectedCity(event.target.value)}
          className={selectClassName}
          disabled={isCityDisabled}
        >
          <option value="">
            {isCityDisabled ? 'Select state first' : 'Select city'}
          </option>
          {!hasKnownCityForState && selectedCity ? (
            <option value={selectedCity}>{selectedCity} (select verified city)</option>
          ) : null}
          {cityOptions.map((city) => (
            <option key={`${selectedState}-${city}`} value={city}>
              {city}
            </option>
          ))}
        </select>
        {errorMessage ? <p className="mt-1 text-xs text-red-600">{errorMessage}</p> : null}
      </div>
    </div>
  )
}
