'use client'

import Image from 'next/image'
import { US_STATE_OPTIONS } from '@/lib/locations/usLocationCatalog'

type Props = {
  fieldClassName: string
  address: string
  locationCity: string
  locationStateInput: string
  description: string
  logoFile: File | null
  existingLogoUrl: string
  onAddressChange: (value: string) => void
  onLocationCityChange: (value: string) => void
  onLocationStateInputChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onLogoChange: (file: File | null) => void
}

export default function EmployerStep3({
  fieldClassName,
  address,
  locationCity,
  locationStateInput,
  description,
  logoFile,
  existingLogoUrl,
  onAddressChange,
  onLocationCityChange,
  onLocationStateInputChange,
  onDescriptionChange,
  onLogoChange,
}: Props) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-700">Address</label>
        <input className={fieldClassName} value={address} onChange={(e) => onAddressChange(e.target.value)} placeholder="123 Main St" />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">City</label>
        <input
          className={fieldClassName}
          value={locationCity}
          onChange={(e) => onLocationCityChange(e.target.value)}
          placeholder="e.g., Salt Lake City"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">State</label>
        <input
          className={fieldClassName}
          value={locationStateInput}
          onChange={(e) => onLocationStateInputChange(e.target.value)}
          placeholder="UT or Utah"
          list="employer-step-state-options"
        />
        <datalist id="employer-step-state-options">
          {US_STATE_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </datalist>
      </div>

      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-700">Company description</label>
        <textarea
          rows={4}
          className={fieldClassName}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Describe your team, mission, and internship environment."
        />
      </div>

      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-700">Logo upload (optional)</label>
        <div className="mt-2 flex items-center gap-4">
          <label className="group relative inline-flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-slate-50 hover:border-blue-300">
            {existingLogoUrl ? (
              <Image
                src={existingLogoUrl}
                alt="Company logo preview"
                width={80}
                height={80}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <span className="text-xs font-medium text-slate-500">Logo</span>
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => onLogoChange(event.target.files?.[0] ?? null)}
            />
          </label>
          <span className="text-sm text-slate-600">Upload a square logo for profile icons across the site.</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {logoFile ? `${logoFile.name} selected.` : existingLogoUrl ? 'Current company logo on file.' : 'No logo uploaded yet.'}
        </p>
      </div>
    </div>
  )
}
