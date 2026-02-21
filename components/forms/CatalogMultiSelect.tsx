'use client'

import { useEffect, useMemo, useState } from 'react'
import { normalizeCatalogLabel, normalizeCatalogToken } from '@/lib/catalog/normalization'

export type CatalogOption = {
  id: string
  name: string
  category?: string | null
}

type SelectedItem = {
  id: string | null
  label: string
}

type Props = {
  label: string
  fieldName: string
  idsFieldName: string
  customFieldName: string
  inputId: string
  options: CatalogOption[]
  initialLabels: string[]
  helperText?: string
  allowCustom?: boolean
  required?: boolean
  searchEndpoint?: string
  searchDebounceMs?: number
  customActionLabel?: string
  suggestedLabels?: string[]
  suggestedTitle?: string
  onSelectionChange?: (labels: string[]) => void
}

function sameToken(left: string, right: string) {
  return normalizeCatalogToken(left) === normalizeCatalogToken(right)
}

function isCustomOptionId(id: string | null | undefined) {
  return typeof id === 'string' && id.startsWith('custom:')
}

export default function CatalogMultiSelect({
  label,
  fieldName,
  idsFieldName,
  customFieldName,
  inputId,
  options,
  initialLabels,
  helperText,
  allowCustom = true,
  required = false,
  searchEndpoint,
  searchDebounceMs = 180,
  customActionLabel = 'Add custom',
  suggestedLabels = [],
  suggestedTitle = 'Suggested skills',
  onSelectionChange,
}: Props) {
  const optionsByToken = useMemo(() => {
    const map = new Map<string, CatalogOption>()
    for (const option of options) {
      map.set(normalizeCatalogToken(option.name), option)
    }
    return map
  }, [options])

  const [selected, setSelected] = useState<SelectedItem[]>(() => {
    const initial: SelectedItem[] = []
    for (const labelValue of initialLabels.map(normalizeCatalogLabel).filter(Boolean)) {
      const maybeOption = optionsByToken.get(normalizeCatalogToken(labelValue))
      if (maybeOption) {
        initial.push({ id: maybeOption.id, label: maybeOption.name })
      } else {
        initial.push({ id: null, label: labelValue })
      }
    }
    return initial
  })
  const [query, setQuery] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [remoteOptions, setRemoteOptions] = useState<CatalogOption[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!searchEndpoint) return
    const controller = new AbortController()
    const q = normalizeCatalogLabel(query)
    const timer = setTimeout(async () => {
      try {
        setSearching(true)
        const response = await fetch(`${searchEndpoint}?q=${encodeURIComponent(q)}&limit=25`, {
          signal: controller.signal,
        })
        if (!response.ok) return
        const payload = (await response.json()) as { options?: Array<{ id?: string; label?: string; category?: string | null }> }
        const optionsFromApi = (payload.options ?? [])
          .map((option) => ({
            id: typeof option.id === 'string' ? option.id : '',
            name: typeof option.label === 'string' ? option.label : '',
            category: typeof option.category === 'string' ? option.category : null,
          }))
          .filter((option) => option.id && option.name)
        setRemoteOptions(optionsFromApi)
      } catch {
        if (!controller.signal.aborted) setRemoteOptions([])
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, searchDebounceMs)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query, searchDebounceMs, searchEndpoint])

  const searchOptions = useMemo(() => {
    if (!searchEndpoint) return options
    const merged: CatalogOption[] = []
    const seenIds = new Set<string>()
    const seenTokens = new Set<string>()
    for (const option of remoteOptions) {
      const token = normalizeCatalogToken(option.name)
      merged.push(option)
      seenIds.add(option.id)
      if (token) seenTokens.add(token)
    }
    for (const option of options) {
      const token = normalizeCatalogToken(option.name)
      if (seenIds.has(option.id)) continue
      if (token && seenTokens.has(token)) continue
      merged.push(option)
    }
    return merged
  }, [options, remoteOptions, searchEndpoint])

  const filteredOptions = useMemo(() => {
    const queryToken = normalizeCatalogToken(query)
    const selectedIds = new Set(selected.map((item) => item.id).filter((value): value is string => Boolean(value)))
    return searchOptions
      .filter((option) => {
        if (selectedIds.has(option.id)) return false
        if (!queryToken) return true
        return normalizeCatalogToken(option.name).includes(queryToken)
      })
      .slice(0, 16)
  }, [searchOptions, query, selected])

  const canonicalIds = selected
    .map((item) => item.id)
    .filter((value): value is string => Boolean(value))
  const customLabels = selected
    .filter((item) => !item.id)
    .map((item) => item.label)
  const hasExactCanonicalMatch = filteredOptions.some(
    (option) => normalizeCatalogToken(option.name) === normalizeCatalogToken(query)
  )
  const shouldShowCustomAdd = allowCustom && normalizeCatalogToken(query).length > 0 && !hasExactCanonicalMatch

  const groupedOptions = useMemo(() => {
    const map = new Map<string, CatalogOption[]>()
    for (const option of filteredOptions) {
      const category = option.category?.trim() || 'Other'
      if (!map.has(category)) map.set(category, [])
      map.get(category)?.push(option)
    }
    return Array.from(map.entries()).sort(([left], [right]) => left.localeCompare(right))
  }, [filteredOptions])

  function addFromText(value: string) {
    const labelValue = normalizeCatalogLabel(value)
    if (!labelValue) return
    if (selected.some((item) => sameToken(item.label, labelValue))) {
      setQuery('')
      return
    }
    const matched = optionsByToken.get(normalizeCatalogToken(labelValue))
    if (matched) {
      setSelected((prev) => [...prev, { id: matched.id, label: matched.name }])
    } else {
      setSelected((prev) => [...prev, { id: null, label: labelValue }])
    }
    setQuery('')
  }

  function addOption(option: CatalogOption) {
    if (selected.some((item) => item.id === option.id || sameToken(item.label, option.name))) return
    setSelected((prev) => [...prev, { id: isCustomOptionId(option.id) ? null : option.id, label: option.name }])
    setQuery('')
    setShowMenu(false)
  }

  function removeItem(labelValue: string) {
    setSelected((prev) => prev.filter((item) => !sameToken(item.label, labelValue)))
  }

  useEffect(() => {
    if (!onSelectionChange) return
    onSelectionChange(selected.map((item) => item.label))
  }, [onSelectionChange, selected])

  return (
    <div>
      <label className="text-sm font-medium text-slate-700" htmlFor={inputId}>
        {label}
      </label>
      {suggestedLabels.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">{suggestedTitle}</span>
          {suggestedLabels.map((suggestion) => (
            <button
              key={`${inputId}:suggested:${suggestion}`}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault()
                addFromText(suggestion)
              }}
              className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      <div className="relative mt-1 rounded-md border border-slate-300 bg-white p-2">
        <div className="flex flex-wrap gap-2">
          {selected.map((item) => (
            <button
              key={`${item.id ?? 'custom'}:${item.label}`}
              type="button"
              onClick={() => removeItem(item.label)}
            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-800 hover:border-blue-300 hover:bg-blue-100"
          >
              {item.label}{item.id ? '' : ' (Custom)'} ×
            </button>
          ))}
          <input
            id={inputId}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setShowMenu(true)
            }}
            onFocus={() => setShowMenu(true)}
            onBlur={() => {
              setTimeout(() => setShowMenu(false), 120)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (filteredOptions.length > 0 && normalizeCatalogToken(query)) {
                  const exact = filteredOptions.find(
                    (option) => normalizeCatalogToken(option.name) === normalizeCatalogToken(query)
                  )
                  if (exact) {
                    addOption(exact)
                    return
                  }
                }
                if (allowCustom) {
                  addFromText(query)
                }
              }
            }}
            className="min-w-[12rem] flex-1 border-0 bg-transparent p-0 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            placeholder={allowCustom ? 'Type to search, Enter to add' : 'Type to search skills'}
          />
        </div>
        {showMenu && (filteredOptions.length > 0 || shouldShowCustomAdd || searching) ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            {searching ? <div className="px-3 py-2 text-xs text-slate-500">Searching skills…</div> : null}
            {groupedOptions.map(([category, categoryOptions]) => (
              <div key={category}>
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{category}</div>
                {categoryOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      addOption(option)
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {option.name}
                  </button>
                ))}
              </div>
            ))}
            {shouldShowCustomAdd ? (
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  addFromText(query)
                }}
                className="mt-1 block w-full border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {customActionLabel}: {normalizeCatalogLabel(query)}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <input type="hidden" name={fieldName} value={selected.map((item) => item.label).join(', ')} />
      <input type="hidden" name={idsFieldName} value={JSON.stringify(canonicalIds)} />
      <input type="hidden" name={customFieldName} value={JSON.stringify(customLabels)} />
      {required ? <input type="hidden" name={`${idsFieldName}_required`} value={canonicalIds.length > 0 ? '1' : ''} /> : null}
      {helperText ? <p className="mt-1 text-xs text-slate-500">{helperText}</p> : null}
    </div>
  )
}
