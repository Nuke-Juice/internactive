'use client'

import { useMemo } from 'react'
import CatalogMultiSelect from '@/components/forms/CatalogMultiSelect'
import SkillsMultiSelect from '@/components/forms/SkillsMultiSelect'
import { normalizeCatalogToken } from '@/lib/catalog/normalization'
import { suggestSkillsForListing } from '@/lib/skills/suggestedSkills'
import type { CatalogOption } from './types'

type Props = {
  skillCatalog: CatalogOption[]
  majorCatalog: CatalogOption[]
  courseworkCategoryCatalog: CatalogOption[]
  requiredSkillLabels: string[]
  preferredSkillLabels: string[]
  majorLabels: string[]
  courseworkCategoryLabels: string[]
  title: string
  category: string
  resumeRequired: boolean
  restrictByMajor: boolean
  restrictByYear: boolean
  onRequiredSkillsChange: (labels: string[]) => void
  onPreferredSkillsChange: (labels: string[]) => void
  onMajorLabelsChange: (labels: string[]) => void
  onCourseworkCategoryLabelsChange: (labels: string[]) => void
  onResumeRequiredChange: (value: boolean) => void
  onRestrictByMajorChange: (value: boolean) => void
  onRestrictByYearChange: (value: boolean) => void
}

const CURATED_COURSEWORK_LABELS = [
  'Financial Accounting',
  'Managerial Accounting',
  'Business Statistics',
  'Corporate Finance',
  'Operations Management',
  'Business Law',
  'Statistics',
  'Regression',
  'SQL',
  'Data Visualization',
  'Machine Learning',
  'Python',
  'R',
  'Data Structures',
  'Algorithms',
  'Database Systems',
  'Systems Programming',
  'Software Engineering',
  'Digital Marketing',
  'SEO/SEM',
  'Marketing Analytics',
  'Consumer Behavior',
  'Supply Chain',
  'Logistics',
  'Lean/Six Sigma',
]

export default function ListingStepRequirements(props: Props) {
  const courseworkOptions = useMemo(() => {
    const existing = new Set(props.courseworkCategoryCatalog.map((item) => normalizeCatalogToken(item.name)))
    const suggested = CURATED_COURSEWORK_LABELS.filter((label) => !existing.has(normalizeCatalogToken(label))).map((label) => ({
      id: `custom:${normalizeCatalogToken(label)}`,
      name: label,
    }))
    return [...props.courseworkCategoryCatalog, ...suggested]
  }, [props.courseworkCategoryCatalog])

  const suggestedRequiredSkills = useMemo(
    () =>
      suggestSkillsForListing({
        title: props.title,
        category: props.category,
        courseworkCategoryLabels: props.courseworkCategoryLabels,
        selectedSkillLabels: props.requiredSkillLabels,
        catalogLabels: props.skillCatalog.map((item) => item.name),
      }),
    [props.category, props.courseworkCategoryLabels, props.requiredSkillLabels, props.skillCatalog, props.title]
  )

  return (
    <div className="space-y-4">
      <SkillsMultiSelect
        key={`required-skills:${props.requiredSkillLabels.join('|')}`}
        label="Required skills"
        fieldName="required_skills"
        idsFieldName="required_skill_ids"
        customFieldName="required_skill_custom"
        inputId="employer-required-skills-input"
        options={props.skillCatalog}
        initialLabels={props.requiredSkillLabels}
        suggestedLabels={suggestedRequiredSkills}
        onSelectionChange={props.onRequiredSkillsChange}
      />

      <SkillsMultiSelect
        key={`preferred-skills:${props.preferredSkillLabels.join('|')}`}
        label="Preferred skills"
        fieldName="preferred_skills"
        idsFieldName="preferred_skill_ids"
        customFieldName="preferred_skill_custom"
        inputId="employer-preferred-skills-input"
        options={props.skillCatalog}
        initialLabels={props.preferredSkillLabels}
        onSelectionChange={props.onPreferredSkillsChange}
      />

      <p className="-mt-1 text-xs text-slate-500">Used to improve matching + ranking for students.</p>

      <CatalogMultiSelect
        key={`majors:${props.majorLabels.join('|')}`}
        label="Target majors"
        fieldName="majors"
        idsFieldName="major_ids"
        customFieldName="major_custom"
        inputId="employer-major-input"
        options={props.majorCatalog}
        initialLabels={props.majorLabels}
        allowCustom={false}
        onSelectionChange={props.onMajorLabelsChange}
      />

      <CatalogMultiSelect
        key={`course-categories:${props.courseworkCategoryLabels.join('|')}`}
        label="Coursework categories (optional)"
        fieldName="required_course_categories"
        idsFieldName="required_course_category_ids"
        customFieldName="required_course_category_custom"
        inputId="employer-course-categories-input"
        options={courseworkOptions}
        initialLabels={props.courseworkCategoryLabels}
        allowCustom
        onSelectionChange={props.onCourseworkCategoryLabelsChange}
      />

      <div>
        <label className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={props.resumeRequired}
            onChange={(event) => props.onResumeRequiredChange(event.target.checked)}
          />
          Resume required
        </label>
        <input type="hidden" name="resume_required" value={props.resumeRequired ? '1' : '0'} />
      </div>

      <div className="space-y-2 rounded-md border border-slate-300 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Eligibility restrictions</p>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={props.restrictByMajor}
            onChange={(event) => props.onRestrictByMajorChange(event.target.checked)}
          />
          Enforce major eligibility
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={props.restrictByYear}
            onChange={(event) => props.onRestrictByYearChange(event.target.checked)}
          />
          Enforce graduation year eligibility
        </label>
        <p className="text-xs text-slate-500">Off by default. When off, mismatches affect ranking only and do not block apply.</p>
        <input type="hidden" name="restrict_by_major" value={props.restrictByMajor ? '1' : '0'} />
        <input type="hidden" name="restrict_by_year" value={props.restrictByYear ? '1' : '0'} />
      </div>
    </div>
  )
}
