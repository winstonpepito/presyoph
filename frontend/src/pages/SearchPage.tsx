import { Link, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { formatUnitSummary } from '../lib/formatUnit'
import { useEffect, useState } from 'react'

type SearchData = {
  categories: { id: string; name: string; slug: string }[]
  products: {
    id: string
    name: string
    brand: string | null
    slug: string
    unit: string | null
    unitQuantity: string | null
    category: { name: string } | null
  }[]
  establishments: { id: string; name: string; slug: string }[]
}

export function SearchPage() {
  const [searchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const [data, setData] = useState<SearchData | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const r = await apiFetch(`/api/v1/search?q=${encodeURIComponent(q)}`)
      const j = (await r.json()) as SearchData
      if (!cancelled) setData(j)
    })()
    return () => {
      cancelled = true
    }
  }, [q])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Search</h1>
      <form className="mt-4 flex gap-2" action="/search" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Product, category, or store…"
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
        />
        <button
          type="submit"
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Search
        </button>
      </form>

      {!q.trim() ? (
        <p className="mt-8 text-slate-500">Enter a term to search the catalog.</p>
      ) : !data ? (
        <p className="mt-8 text-slate-500">Loading…</p>
      ) : (
        <div className="mt-8 space-y-8">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Categories</h2>
            <p className="mt-1 text-xs text-slate-500">
              Name matches your search and <strong className="font-medium text-slate-600">admin product synonyms</strong>{' '}
              (same as the home page). Sorted by most recent price activity, then name.
            </p>
            <ul className="mt-2 space-y-1">
              {data.categories.map((c) => (
                <li key={c.id}>
                  <Link to={`/categories/${c.slug}`} className="text-emerald-700 hover:underline">
                    {c.name}
                  </Link>
                </li>
              ))}
              {data.categories.length === 0 && <li className="text-sm text-slate-400">No matches</li>}
            </ul>
          </section>
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Products</h2>
            <p className="mt-1 text-xs text-slate-500">
              Matches product name, brand, or category using the same{' '}
              <strong className="font-medium text-slate-600">synonym groups</strong> as the home feed. Sorted by most
              recent price activity, then lowest reported price, then name.
            </p>
            <ul className="mt-2 space-y-1">
              {data.products.map((p) => (
                <li key={p.id}>
                  <Link to={`/products/${p.slug}`} className="text-emerald-700 hover:underline">
                    {p.name}
                  </Link>
                  {p.brand ? <span className="text-sm text-slate-500"> · {p.brand}</span> : null}
                  {formatUnitSummary(p.unit, p.unitQuantity) ? (
                    <span className="text-sm text-slate-400"> ({formatUnitSummary(p.unit, p.unitQuantity)})</span>
                  ) : null}
                  {p.category ? (
                    <span className="text-sm text-slate-400"> · {p.category.name}</span>
                  ) : (
                    <span className="text-sm text-slate-400"> · Uncategorized</span>
                  )}
                </li>
              ))}
              {data.products.length === 0 && <li className="text-sm text-slate-400">No matches</li>}
            </ul>
          </section>
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Establishments</h2>
            <p className="mt-1 text-xs text-slate-500">Sorted by most recent price post at the store, then name.</p>
            <ul className="mt-2 space-y-1">
              {data.establishments.map((e) => (
                <li key={e.id}>
                  <Link to={`/establishments/${e.slug}`} className="text-emerald-700 hover:underline">
                    {e.name}
                  </Link>
                </li>
              ))}
              {data.establishments.length === 0 && <li className="text-sm text-slate-400">No matches</li>}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}
