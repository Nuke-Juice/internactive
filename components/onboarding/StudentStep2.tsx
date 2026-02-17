'use client'

import CourseworkCombobox from '@/components/onboarding/CourseworkCombobox'

type CourseworkSelection = {
  label: string
  verified: boolean
}

type Props = {
  fieldClassName: string
  schoolName: string
  hasSchoolSpecificCoursework: boolean
  courseworkSelections: CourseworkSelection[]
  desiredRoles: string
  onAddCoursework: (course: CourseworkSelection) => void
  onRemoveCoursework: (courseLabel: string) => void
  onDesiredRolesChange: (value: string) => void
}

export default function StudentStep2({
  fieldClassName,
  schoolName,
  hasSchoolSpecificCoursework,
  courseworkSelections,
  desiredRoles,
  onAddCoursework,
  onRemoveCoursework,
  onDesiredRolesChange,
}: Props) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <CourseworkCombobox
          label="Skills and coursework (required)"
          schoolName={schoolName}
          hasSchoolSpecificCoursework={hasSchoolSpecificCoursework}
          selectedItems={courseworkSelections}
          onAdd={onAddCoursework}
          onRemove={onRemoveCoursework}
        />
        <p className="mt-1 text-xs text-slate-500">Add at least one course to continue.</p>
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
