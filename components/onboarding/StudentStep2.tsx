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
  skillsInput: string
  desiredRoles: string
  onAddCoursework: (course: CourseworkSelection) => void
  onRemoveCoursework: (courseLabel: string) => void
  onSkillsInputChange: (value: string) => void
  onDesiredRolesChange: (value: string) => void
}

export default function StudentStep2({
  fieldClassName,
  schoolName,
  hasSchoolSpecificCoursework,
  courseworkSelections,
  skillsInput,
  desiredRoles,
  onAddCoursework,
  onRemoveCoursework,
  onSkillsInputChange,
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
        <p className="mt-1 text-xs text-slate-500">Add at least one course and pick at least one verified suggestion.</p>
      </div>

      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-slate-700">Top skills (required)</label>
        <textarea
          rows={3}
          className={fieldClassName}
          value={skillsInput}
          onChange={(e) => onSkillsInputChange(e.target.value)}
          placeholder="Examples: Excel, SQL, PowerPoint, Financial modeling"
        />
        <p className="mt-1 text-xs text-slate-500">Use commas or new lines. Add at least one skill to improve matching.</p>
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
