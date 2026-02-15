'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'

type SelectedCoursework = {
  label: string
  verified: boolean
}

type CourseSearchResult = {
  id: string
  label: string
}

type Props = {
  inputId?: string
  label?: string
  selectedItems: SelectedCoursework[]
  schoolName: string
  hasSchoolSpecificCoursework: boolean
  onAdd: (item: SelectedCoursework) => void
  onRemove: (label: string) => void
}

const MIN_QUERY_LENGTH = 2
const MAX_RESULTS = 10
const SEARCH_DEBOUNCE_MS = 160

function normalizeCourseToken(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

export default function CourseworkCombobox({
  inputId = 'student-signup-coursework',
  label = 'Skills and coursework',
  selectedItems,
  schoolName,
  hasSchoolSpecificCoursework,
  onAdd,
  onRemove,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dropdownId = useId()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [searchAll, setSearchAll] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<CourseSearchResult[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const normalizedSelected = useMemo(
    () => new Set(selectedItems.map((item) => normalizeCourseToken(item.label))),
    [selectedItems]
  )

  const visibleResults = useMemo(
    () => results.filter((result) => !normalizedSelected.has(normalizeCourseToken(result.label))).slice(0, MAX_RESULTS),
    [results, normalizedSelected]
  )

  const trimmedQuery = query.trim()
  const showDropdown = isOpen && trimmedQuery.length >= MIN_QUERY_LENGTH
  const showCustomAddRow = showDropdown && !loading && visibleResults.length === 0
  const optionCount = showCustomAddRow ? 1 : visibleResults.length
  const activeDescendant =
    showDropdown && highlightedIndex >= 0 ? `${dropdownId}-option-${Math.min(highlightedIndex, optionCount - 1)}` : undefined

  useEffect(() => {
    if (!showDropdown) {
      setResults([])
      setLoading(false)
      setHighlightedIndex(-1)
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(
          `/api/coursework/search?query=${encodeURIComponent(trimmedQuery)}&searchAll=${searchAll ? '1' : '0'}&university=${encodeURIComponent(schoolName)}`,
          { signal: controller.signal }
        )
        if (!response.ok) {
          setResults([])
          return
        }
        const payload = (await response.json()) as { results?: Array<{ id?: unknown; label?: unknown }> }
        const nextResults = Array.isArray(payload.results)
          ? payload.results
              .filter((row): row is { id: string; label: string } => typeof row.id === 'string' && typeof row.label === 'string')
              .slice(0, MAX_RESULTS)
          : []
        setResults(nextResults)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [showDropdown, trimmedQuery, searchAll, schoolName])

  useEffect(() => {
    function handleOutsidePointerDown(event: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setHighlightedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleOutsidePointerDown)
    return () => document.removeEventListener('mousedown', handleOutsidePointerDown)
  }, [])

  function selectResult(item: SelectedCoursework) {
    onAdd(item)
    setQuery('')
    setResults([])
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  function handleEnterSelection() {
    if (!showDropdown) return
    if (optionCount === 0) return
    const index = highlightedIndex >= 0 ? highlightedIndex : 0
    if (showCustomAddRow) {
      selectResult({ label: trimmedQuery, verified: false })
      return
    }
    const target = visibleResults[index]
    if (target) selectResult({ label: target.label, verified: true })
  }

  function scopeLabel() {
    if (searchAll) return 'Searching: All universities'
    if (schoolName.trim().length > 0) return `Searching: ${schoolName}`
    return 'Searching: Your university'
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        id={inputId}
        value={query}
        onFocus={() => setIsOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(true)
          setHighlightedIndex(-1)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsOpen(false)
            setHighlightedIndex(-1)
            return
          }

          if (!showDropdown || optionCount === 0) {
            if (event.key === 'Enter' && trimmedQuery.length >= MIN_QUERY_LENGTH && showCustomAddRow) {
              event.preventDefault()
              handleEnterSelection()
            }
            return
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setHighlightedIndex((prev) => (prev + 1) % optionCount)
            return
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setHighlightedIndex((prev) => (prev <= 0 ? optionCount - 1 : prev - 1))
            return
          }

          if (event.key === 'Enter') {
            event.preventDefault()
            handleEnterSelection()
          }
        }}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls={dropdownId}
        aria-activedescendant={activeDescendant}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        placeholder="Search courses (e.g., ACC 2110, Accounting, Finance)"
      />

      <p className="mt-1 text-xs text-slate-500">Start typing to see matches. Can&apos;t find it? Add it.</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
        <span>{scopeLabel()}</span>
        <button
          type="button"
          className="font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
          onClick={() => {
            setSearchAll((prev) => !prev)
            setIsOpen(true)
            setHighlightedIndex(-1)
          }}
        >
          {searchAll ? 'Search your university' : 'Search all'}
        </button>
        {!hasSchoolSpecificCoursework && !searchAll ? (
          <span className="text-slate-400">Suggestions are broad until a listed university is selected.</span>
        ) : null}
      </div>

      {showDropdown ? (
        <div
          id={dropdownId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {loading ? <div className="px-3 py-2 text-sm text-slate-600">Searching...</div> : null}

          {!loading && showCustomAddRow ? (
            <button
              id={`${dropdownId}-option-0`}
              type="button"
              role="option"
              aria-selected={highlightedIndex === 0}
              onMouseDown={() => selectResult({ label: trimmedQuery, verified: false })}
              className={`block w-full px-3 py-2 text-left text-sm ${
                highlightedIndex === 0 ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              Add &quot;{trimmedQuery}&quot;
            </button>
          ) : null}

          {!loading
            ? visibleResults.map((item, index) => (
                <button
                  id={`${dropdownId}-option-${index}`}
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={index === highlightedIndex}
                  onMouseDown={() => selectResult({ label: item.label, verified: true })}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    index === highlightedIndex ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))
            : null}
        </div>
      ) : null}

      {selectedItems.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedItems.map((item) => (
            <button
              key={`${item.label}:${item.verified ? 'verified' : 'custom'}`}
              type="button"
              onClick={() => onRemove(item.label)}
              className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
            >
              {item.label}
              {!item.verified ? ' (custom)' : ''}
              {' ×'}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
