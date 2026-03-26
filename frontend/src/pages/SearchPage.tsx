import { Link, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { formatEstablishmentAddress } from '../lib/formatEstablishmentAddress'
import { formatUnitSummary } from '../lib/formatUnit'
import { formatPricePostLabel } from '../lib/pricing'
import { useEffect, useState, type ReactNode } from 'react'

type SearchEstablishmentRef = {
  id: string
  name: string
  slug: string
  addressLine: string | null
  barangay: string | null
  city: string | null
}

/** Sample post fields (categories & establishments use API key names productName / productSlug). */
type SearchSampleFields = {
  brand: string | null
  productName: string | null
  productSlug: string | null
  unit: string | null
  unitQuantity: string | null
  priceExact: string | null
  priceMin: string | null
  priceMax: string | null
  establishment: SearchEstablishmentRef | null
}

type SearchData = {
  categories: ({
    id: string
    name: string
    slug: string
  } & SearchSampleFields)[]
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
    establishment: SearchEstablishmentRef | null
  }[]
  establishments: ({
    id: string
    name: string
    slug: string
    addressLine: string | null
    barangay: string | null
    city: string | null
  } & SearchSampleFields)[]
}

function productAsSample(p: SearchData['products'][number]): SearchSampleFields {
  return {
    brand: p.brand,
    productName: p.name,
    productSlug: p.slug,
    unit: p.unit,
    unitQuantity: p.unitQuantity,
    priceExact: p.priceExact,
    priceMin: p.priceMin,
    priceMax: p.priceMax,
    establishment: p.establishment,
  }
}

function sampleUnit(s: SearchSampleFields): string {
  return formatUnitSummary(s.unit, s.unitQuantity) ?? '—'
}

function samplePrice(s: SearchSampleFields): string {
  return formatPricePostLabel(s)
}

function addressFromSampleEstablishment(s: SearchSampleFields): string {
  if (!s.establishment) return '—'
  return formatEstablishmentAddress(s.establishment) ?? '—'
}

function SearchTableHead() {
  return (
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
  )
}

function SearchTableRow({
  primaryCell,
  sample,
  addressCell,
}: {
  primaryCell: ReactNode
  sample: SearchSampleFields
  addressCell: ReactNode
}) {
  return (
    <tr className="border-b border-slate-100 align-top">
      <td className="py-3 pr-3 text-slate-600">{sample.brand ?? '—'}</td>
      <td className="py-3 pr-3 font-medium text-slate-900">{primaryCell}</td>
      <td className="py-3 pr-3 text-slate-600">{sampleUnit(sample)}</td>
      <td className="py-3 pr-3 font-semibold text-emerald-700">{samplePrice(sample)}</td>
      <td className="py-3 pr-3 text-slate-700">
        {sample.establishment ? (
          <Link
            to={`/establishments/${sample.establishment.slug}`}
            className="text-emerald-700 hover:underline"
          >
            {sample.establishment.name}
          </Link>
        ) : (
          '—'
        )}
      </td>
      <td className="py-3 text-slate-600">{addressCell}</td>
    </tr>
  )
}

function SearchMobileCard({
  headlineLabel,
  headlineLink,
  price,
  sample,
  addressLabel,
  addressValue,
  sampleProduct,
}: {
  headlineLabel: string
  headlineLink: ReactNode
  price: string
  sample: SearchSampleFields
  addressLabel: string
  addressValue: string
  sampleProduct?: { slug: string; name: string } | null
}) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{headlineLabel}</p>
          <div className="font-semibold text-emerald-700">{headlineLink}</div>
        </div>
        <p className="text-lg font-bold text-emerald-700">{price}</p>
      </div>
      <dl className="mt-3 grid gap-2 text-sm">
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-slate-500">Brand</dt>
          <dd className="text-slate-800">{sample.brand ?? '—'}</dd>
        </div>
        {sampleProduct ? (
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-slate-500">Product</dt>
            <dd className="text-slate-800">
              <Link to={`/products/${sampleProduct.slug}`} className="text-emerald-700 hover:underline">
                {sampleProduct.name}
              </Link>
            </dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-slate-500">Unit</dt>
          <dd className="text-slate-800">{sampleUnit(sample)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-slate-500">Store</dt>
          <dd className="text-slate-800">
            {sample.establishment ? (
              <Link
                to={`/establishments/${sample.establishment.slug}`}
                className="text-emerald-700 hover:underline"
              >
                {sample.establishment.name}
              </Link>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-slate-500">{addressLabel}</dt>
          <dd className="text-slate-800">{addressValue}</dd>
        </div>
      </dl>
    </li>
  )
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
              (same as the home page). Sorted by most recent price activity, then name. Sample columns use the cheapest
              price post in that category (newest tie-break), same as product search.
            </p>

            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <SearchTableHead />
                <tbody>
                  {data.categories.map((c) => (
                    <SearchTableRow
                      key={c.id}
                      sample={c}
                      addressCell={addressFromSampleEstablishment(c)}
                      primaryCell={
                        <>
                          <Link to={`/categories/${c.slug}`} className="text-emerald-700 hover:underline">
                            {c.name}
                          </Link>
                          {c.productName ? (
                            <span className="mt-0.5 block text-xs font-normal text-slate-400">{c.productName}</span>
                          ) : null}
                        </>
                      }
                    />
                  ))}
                </tbody>
              </table>
              {data.categories.length === 0 && <p className="mt-2 text-sm text-slate-400">No matches</p>}
            </div>

            <ul className="mt-4 space-y-4 md:hidden">
              {data.categories.map((c) => (
                <SearchMobileCard
                  key={c.id}
                  headlineLabel="Category"
                  headlineLink={
                    <Link to={`/categories/${c.slug}`} className="hover:underline">
                      {c.name}
                    </Link>
                  }
                  price={samplePrice(c)}
                  sample={c}
                  addressLabel="Address"
                  addressValue={addressFromSampleEstablishment(c)}
                  sampleProduct={
                    c.productSlug && c.productName
                      ? { slug: c.productSlug, name: c.productName }
                      : null
                  }
                />
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
                <SearchTableHead />
                <tbody>
                  {data.products.map((p) => {
                    const s = productAsSample(p)
                    return (
                      <SearchTableRow
                        key={p.id}
                        sample={s}
                        addressCell={addressFromSampleEstablishment(s)}
                        primaryCell={
                          <>
                            <Link to={`/products/${p.slug}`} className="text-emerald-700 hover:underline">
                              {p.name}
                            </Link>
                            {p.category ? (
                              <span className="mt-0.5 block text-xs font-normal text-slate-400">{p.category.name}</span>
                            ) : (
                              <span className="mt-0.5 block text-xs font-normal text-slate-400">Uncategorized</span>
                            )}
                          </>
                        }
                      />
                    )
                  })}
                </tbody>
              </table>
              {data.products.length === 0 && <p className="mt-2 text-sm text-slate-400">No matches</p>}
            </div>

            <ul className="mt-4 space-y-4 md:hidden">
              {data.products.map((p) => {
                const s = productAsSample(p)
                return (
                  <SearchMobileCard
                    key={p.id}
                    headlineLabel="Product"
                    headlineLink={
                      <Link to={`/products/${p.slug}`} className="hover:underline">
                        {p.name}
                      </Link>
                    }
                    price={samplePrice(s)}
                    sample={s}
                    addressLabel="Address"
                    addressValue={addressFromSampleEstablishment(s)}
                  />
                )
              })}
              {data.products.length === 0 && <li className="text-sm text-slate-400">No matches</li>}
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Establishments</h2>
            <p className="mt-1 text-xs text-slate-500">
              Name contains your search. Sorted by most recent price post at the store, then name. Sample columns use
              the cheapest post at that store (newest tie-break). Address is the store&apos;s catalog location.
            </p>

            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <SearchTableHead />
                <tbody>
                  {data.establishments.map((e) => {
                    const addr =
                      formatEstablishmentAddress({
                        addressLine: e.addressLine,
                        barangay: e.barangay,
                        city: e.city,
                      }) ?? '—'
                    return (
                      <SearchTableRow
                        key={e.id}
                        sample={e}
                        addressCell={addr}
                        primaryCell={
                          <>
                            <Link to={`/establishments/${e.slug}`} className="text-emerald-700 hover:underline">
                              {e.name}
                            </Link>
                            {e.productName ? (
                              <span className="mt-0.5 block text-xs font-normal text-slate-400">{e.productName}</span>
                            ) : null}
                          </>
                        }
                      />
                    )
                  })}
                </tbody>
              </table>
              {data.establishments.length === 0 && <p className="mt-2 text-sm text-slate-400">No matches</p>}
            </div>

            <ul className="mt-4 space-y-4 md:hidden">
              {data.establishments.map((e) => {
                const addr =
                  formatEstablishmentAddress({
                    addressLine: e.addressLine,
                    barangay: e.barangay,
                    city: e.city,
                  }) ?? '—'
                return (
                  <SearchMobileCard
                    key={e.id}
                    headlineLabel="Establishment"
                    headlineLink={
                      <Link to={`/establishments/${e.slug}`} className="hover:underline">
                        {e.name}
                      </Link>
                    }
                    price={samplePrice(e)}
                    sample={e}
                    addressLabel="Address"
                    addressValue={addr}
                    sampleProduct={
                      e.productSlug && e.productName
                        ? { slug: e.productSlug, name: e.productName }
                        : null
                    }
                  />
                )
              })}
              {data.establishments.length === 0 && <li className="text-sm text-slate-400">No matches</li>}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}
