'use client'

import CatalogMultiSelect, { type CatalogOption } from '@/components/forms/CatalogMultiSelect'

type Props = {
  label: string
  fieldName: string
  idsFieldName: string
  customFieldName: string
  inputId: string
  options: CatalogOption[]
  initialLabels: string[]
  suggestedLabels?: string[]
  searchEndpoint?: string
  onSelectionChange?: (labels: string[]) => void
}

export default function SkillsMultiSelect(props: Props) {
  return (
    <CatalogMultiSelect
      label={props.label}
      fieldName={props.fieldName}
      idsFieldName={props.idsFieldName}
      customFieldName={props.customFieldName}
      inputId={props.inputId}
      options={props.options}
      initialLabels={props.initialLabels}
      allowCustom
      searchEndpoint={props.searchEndpoint ?? '/api/skills/search'}
      customActionLabel="Add as custom skill"
      suggestedLabels={props.suggestedLabels ?? []}
      suggestedTitle="Suggested skills"
      onSelectionChange={props.onSelectionChange}
    />
  )
}
