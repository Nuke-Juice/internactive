'use client'

type TemplateOption = {
  key: string
  label: string
}

type Props = {
  options: readonly TemplateOption[]
  selectedTemplateKey: string
}

export default function TemplatePicker({ options, selectedTemplateKey }: Props) {
  return (
    <div className="flex items-center gap-2">
      <label className="shrink-0 text-xs font-medium text-slate-700" htmlFor="template-picker">
        Template
      </label>
      <select
        id="template-picker"
        name="template"
        defaultValue={selectedTemplateKey}
        onChange={(event) => {
          event.currentTarget.form?.requestSubmit()
        }}
        className="h-10 min-w-[12rem] rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
      >
        <option value="">No template</option>
        {options.map((template) => (
          <option key={template.key} value={template.key}>
            {template.label}
          </option>
        ))}
      </select>
    </div>
  )
}
