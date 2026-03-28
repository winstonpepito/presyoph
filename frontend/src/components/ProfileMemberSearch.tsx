import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useEffect, useRef, useState } from 'react'

type SearchUser = { id: string; name: string | null; image: string | null }

export function ProfileMemberSearch() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchUser[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    let cancelled = false
    const handle = window.setTimeout(() => {
      void (async () => {
        setOpen(true)
        setLoading(true)
        try {
          const r = await apiFetch(`/api/v1/users/search?${new URLSearchParams({ q: term })}`)
          if (cancelled || !r.ok) {
            if (!cancelled) {
              setResults([])
            }
            return
          }
          const j = (await r.json()) as { users?: SearchUser[] }
          if (!cancelled) {
            setResults(Array.isArray(j.users) ? j.users : [])
          }
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [q])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <label htmlFor="profile-member-search" className="text-xs font-medium text-slate-500">
        Find a member
      </label>
      <input
        id="profile-member-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => {
          if (q.trim().length >= 2) setOpen(true)
        }}
        placeholder="Search by name…"
        autoComplete="off"
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-emerald-500/0 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
      />
      {q.trim().length > 0 && q.trim().length < 2 ? (
        <p className="mt-1 text-xs text-slate-500">Enter at least 2 characters.</p>
      ) : null}
      {open && q.trim().length >= 2 ? (
        <ul
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {loading ? (
            <li className="px-3 py-2 text-sm text-slate-500">Searching…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">No members match that name.</li>
          ) : (
            results.map((u) => (
              <li key={u.id} role="option">
                <Link
                  to={`/profile/${u.id}`}
                  className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50"
                  onClick={() => {
                    setOpen(false)
                    setQ('')
                  }}
                >
                  {u.image ? (
                    <img src={u.image} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-600">
                      {(u.name ?? '?').slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 truncate font-medium text-slate-900">{u.name ?? 'Member'}</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
