'use client'

import MajorCombobox, { type CanonicalMajor } from '@/components/account/MajorCombobox'
import CourseworkCombobox from '@/components/onboarding/CourseworkCombobox'

type CourseworkSelection = {
  label: string
  verified: boolean
}

type Props = {
  fieldClassName: string
  secondMajorQuery: string
  selectedSecondMajor: CanonicalMajor | null
  majorCatalog: CanonicalMajor[]
  majorsLoading: boolean
  majorError: string | null
  schoolName: string
  hasSchoolSpecificCoursework: boolean
  courseworkSelections: CourseworkSelection[]
  desiredRoles: string
  onSecondMajorQueryChange: (value: string) => void
  onSecondMajorSelect: (major: CanonicalMajor) => void
  onMajorErrorClear: () => void
  onAddCoursework: (course: CourseworkSelection) => void
  onRemoveCoursework: (courseLabel: string) => void
  onDesiredRolesChange: (value: string) => void
}

export default function StudentStep2({
  fieldClassName,
  secondMajorQuery,
  selectedSecondMajor,
  majorCatalog,
  majorsLoading,
  majorError,
  schoolName,
  hasSchoolSpecificCoursework,
  courseworkSelections,
  desiredRoles,
  onSecondMajorQueryChange,
  onSecondMajorSelect,
  onMajorErrorClear,
  onAddCoursework,
  onRemoveCoursework,
  onDesiredRolesChange,
}: Props) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <MajorCombobox
          inputId="student-signup-second-major"
          label="Second major (optional)"
          query={secondMajorQuery}
          onQueryChange={onSecondMajorQueryChange}
          options={majorCatalog}
          selectedMajor={selectedSecondMajor}
          onSelect={(major) => {
            onSecondMajorSelect(major)
            onMajorErrorClear()
          }}
          loading={majorsLoading}
          error={majorError}
          placeholder="Add a second major"
        />
      </div>

      <div className="sm:col-span-2">
        <CourseworkCombobox
          schoolName={schoolName}
          hasSchoolSpecificCoursework={hasSchoolSpecificCoursework}
          selectedItems={courseworkSelections}
          onAdd={onAddCoursework}
          onRemove={onRemoveCoursework}
        />
      </div>

      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-700">Desired industries or roles (optional)</label>
        <textarea
          rows={3}
          className={fieldClassName}
          value={desiredRoles}
          onChange={(e) => onDesiredRolesChange(e.target.value)}
          placeholder="Examples: Product, Marketing Analytics, Software Engineering"
        />
      </div>
    </div>
  )
}
