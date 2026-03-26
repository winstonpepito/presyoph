import { Link, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { formatEstablishmentAddress } from '../lib/formatEstablishmentAddress'
import { formatUnitSummary } from '../lib/formatUnit'
import { formatPricePostLabel } from '../lib/pricing'
import { useEffect, useState } from 'react'

type SearchProductEstablishment = {
  id: string
  name: string
  slug: string
  addressLine: string | null
  barangay: string | null
  city: string | null
}

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
    priceExact: string | null
    priceMin: string | null
    priceMax: string | null
    establishment: SearchProductEstablishment | null
  }[]
  establishments: { id: string; name: string; slug: string }[]
}

function productUnitLabel(p: SearchData['products'][number]): string {
  return formatUnitSummary(p.unit, p.unitQuantity) ?? '—'
}

function productAddress(p: SearchData['products'][number]): string {
  if (!p.establishment) return '—'
  return formatEstablishmentAddress(p.establishment) ?? '—'
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
    <div className="mx-auto max-w-6xl px-4 py-8">
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
              recent price activity, then lowest reported price, then name. Price and store come from the cheapest
              matching post (newest tie-break).
            </p>

            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Brand</th>
                    <th className="py-2 pr-3">Product</th>
                    <th className="py-2 pr-3">Unit</th>
                    <th className="py-2 pr-3">Price</th>
                    <th className="py-2 pr-3">Establishment</th>
                    <th className="py-2">Address</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 align-top">
                      <td className="py-3 pr-3 text-slate-600">{p.brand ?? '—'}</td>
                      <td className="py-3 pr-3 font-medium text-slate-900">
                        <Link to={`/products/${p.slug}`} className="text-emerald-700 hover:underline">
                          {p.name}
                        </Link>
                        {p.category ? (
                          <span className="mt-0.5 block text-xs font-normal text-slate-400">{p.category.name}</span>
                        ) : (
                          <span className="mt-0.5 block text-xs font-normal text-slate-400">Uncategorized</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-slate-600">{productUnitLabel(p)}</td>
                      <td className="py-3 pr-3 font-semibold text-emerald-700">
                        {formatPricePostLabel(p)}
                      </td>
                      <td className="py-3 pr-3 text-slate-700">
                        {p.establishment ? (
                          <Link
                            to={`/establishments/${p.establishment.slug}`}
                            className="text-emerald-700 hover:underline"
                          >
                            {p.establishment.name}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 text-slate-600">{productAddress(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.products.length === 0 && <p className="mt-2 text-sm text-slate-400">No matches</p>}
            </div>

            <ul className="mt-4 space-y-4 md:hidden">
              {data.products.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Product</p>
                      <Link to={`/products/${p.slug}`} className="font-semibold text-emerald-700 hover:underline">
                        {p.name}
                      </Link>
                    </div>
                    <p className="text-lg font-bold text-emerald-700">{formatPricePostLabel(p)}</p>
                  </div>
                  <dl className="mt-3 grid gap-2 text-sm">
                    <div className="flex gap-2">
                      <dt className="w-28 shrink-0 text-slate-500">Brand</dt>
                      <dd className="text-slate-800">{p.brand ?? '—'}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-28 shrink-0 text-slate-500">Unit</dt>
                      <dd className="text-slate-800">{productUnitLabel(p)}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-28 shrink-0 text-slate-500">Store</dt>
                      <dd className="text-slate-800">
                        {p.establishment ? (
                          <Link
                            to={`/establishments/${p.establishment.slug}`}
                            className="text-emerald-700 hover:underline"
                          >
                            {p.establishment.name}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-28 shrink-0 text-slate-500">Address</dt>
                      <dd className="text-slate-800">{productAddress(p)}</dd>
                    </div>
                  </dl>
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
