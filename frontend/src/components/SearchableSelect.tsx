import { useEffect, useId, useMemo, useRef, useState } from 'react'

export type SearchableSelectOption = { value: string; label: string }

type SearchableSelectProps = {
  id?: string
  label: string
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Include a first row with empty value (e.g. optional barangay) */
  allowEmpty?: boolean
  emptyLabel?: string
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

export function SearchableSelect({
  id: idProp,
  label,
  options,
  value,
  onChange,
  placeholder = 'Type to search…',
  allowEmpty = false,
  emptyLabel = '— None —',
}: SearchableSelectProps) {
  const genId = useId()
  const id = idProp ?? genId
  const listId = `${id}-listbox`

  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(0)

  const fullOptions = useMemo(() => {
    if (allowEmpty) {
      return [{ value: '', label: emptyLabel }, ...options]
    }
    return options
  }, [allowEmpty, emptyLabel, options])

  const filtered = useMemo(() => {
    const q = norm(filter)
    if (!q) return fullOptions
    return fullOptions.filter(
      (o) => norm(o.label).includes(q) || norm(o.value).includes(q),
    )
  }, [fullOptions, filter])

  const selectedLabel = fullOptions.find((o) => o.value === value)?.label ?? ''

  useEffect(() => {
    setHighlightIdx(0)
  }, [filter, fullOptions.length, open])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return
      setOpen(false)
      setFilter('')
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const inputDisplay = open ? filter : selectedLabel

  function pick(v: string) {
    onChange(v)
    setOpen(false)
    setFilter('')
    inputRef.current?.blur()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        setOpen(true)
        setFilter('')
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setFilter('')
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[highlightIdx]
      if (opt) pick(opt.value)
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={inputDisplay}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500/0 transition-shadow focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30"
        onChange={(e) => {
          if (!open) setOpen(true)
          setFilter(e.target.value)
        }}
        onFocus={() => {
          setOpen(true)
          setFilter('')
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-slate-400">No matches</li>
          ) : (
            filtered.map((opt, i) => (
              <li key={`${i}-${opt.value || 'empty'}`} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={value === opt.value}
                  className={`flex w-full px-3 py-2 text-left hover:bg-emerald-50 ${
                    i === highlightIdx ? 'bg-emerald-50' : ''
                  } ${value === opt.value ? 'font-medium text-emerald-800' : 'text-slate-800'}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pick(opt.value)
                  }}
                  onMouseEnter={() => setHighlightIdx(i)}
                >
                  {opt.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
