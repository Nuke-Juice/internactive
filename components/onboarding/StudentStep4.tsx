'use client'

import { useMemo, useState } from 'react'
import { US_CITY_OPTIONS } from '@/lib/locations/usLocationCatalog'

type Props = {
  fieldClassName: string
  hoursPerWeek: string
  preferredLocation: string
  preferredWorkMode: string
  onHoursPerWeekChange: (value: string) => void
  onPreferredLocationChange: (value: string) => void
  onPreferredWorkModeChange: (value: string) => void
}

export default function StudentStep4({
  fieldClassName,
  hoursPerWeek,
  preferredLocation,
  preferredWorkMode,
  onHoursPerWeekChange,
  onPreferredLocationChange,
  onPreferredWorkModeChange,
}: Props) {
  const [locationOpen, setLocationOpen] = useState(false)

  const filteredLocationOptions = useMemo(() => {
    const query = preferredLocation.trim().toLowerCase()
    if (!query) return US_CITY_OPTIONS.slice(0, 12).map((option) => `${option.city}, ${option.state}`)
    return US_CITY_OPTIONS
      .map((option) => `${option.city}, ${option.state}`)
      .filter((option) => option.toLowerCase().includes(query))
      .slice(0, 12)
  }, [preferredLocation])

  const showLocationDropdown = locationOpen && filteredLocationOptions.length > 0
  const hasExactLocationMatch = useMemo(() => {
    const normalized = preferredLocation.trim().toLowerCase()
    if (!normalized) return true
    return US_CITY_OPTIONS.some((option) => `${option.city}, ${option.state}`.toLowerCase() === normalized)
  }, [preferredLocation])

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <label className="text-sm font-medium text-slate-700">Hours per week (required)</label>
        <input
          type="number"
          min={1}
          className={fieldClassName}
          value={hoursPerWeek}
          onChange={(e) => onHoursPerWeekChange(e.target.value)}
          placeholder="15"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Preferred work mode (optional)</label>
        <select className={fieldClassName} value={preferredWorkMode} onChange={(e) => onPreferredWorkModeChange(e.target.value)}>
          <option value="">No preference</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="in_person">In-person</option>
        </select>
      </div>

      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-700">Location preference (optional)</label>
        <div className="relative">
          <input
            className={fieldClassName}
            value={preferredLocation}
            onFocus={() => setLocationOpen(true)}
            onBlur={() => {
              setTimeout(() => setLocationOpen(false), 120)
            }}
            onChange={(event) => {
              onPreferredLocationChange(event.target.value)
              setLocationOpen(true)
            }}
            placeholder="Type city or state"
          />
          {showLocationDropdown ? (
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                onMouseDown={() => {
                  onPreferredLocationChange('')
                  setLocationOpen(false)
                }}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                No preference
              </button>
              {filteredLocationOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onMouseDown={() => {
                    onPreferredLocationChange(option)
                    setLocationOpen(false)
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {!hasExactLocationMatch && preferredLocation.trim().length > 0 ? (
          <p className="mt-1 text-xs text-amber-700">Select a location from the dropdown list.</p>
        ) : null}
      </div>
    </div>
  )
}
