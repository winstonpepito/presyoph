import { Link, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { formatEstablishmentAddress } from '../lib/formatEstablishmentAddress'
import { formatUnitSummary } from '../lib/formatUnit'
import { comparablePrice, formatPricePostLabel } from '../lib/pricing'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

type SearchSortKey = 'brand' | 'primary' | 'unit' | 'price' | 'establishment' | 'address'

type SearchSortState = { key: SearchSortKey; dir: 'asc' | 'desc' }

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

function establishmentCatalogAddress(e: {
  addressLine: string | null
  barangay: string | null
  city: string | null
}): string {
  return formatEstablishmentAddress(e) ?? '—'
}

function categoryComparables(c: SearchData['categories'][number]): Record<SearchSortKey, string | number> {
  const s = c
  return {
    brand: (s.brand ?? '').toLowerCase(),
    primary: c.name.toLowerCase(),
    unit: sampleUnit(s).toLowerCase(),
    price: comparablePrice(s.priceExact, s.priceMin, s.priceMax),
    establishment: (s.establishment?.name ?? '').toLowerCase(),
    address: addressFromSampleEstablishment(s).toLowerCase(),
  }
}

function productComparables(p: SearchData['products'][number]): Record<SearchSortKey, string | number> {
  const s = productAsSample(p)
  return {
    brand: (s.brand ?? '').toLowerCase(),
    primary: p.name.toLowerCase(),
    unit: sampleUnit(s).toLowerCase(),
    price: comparablePrice(s.priceExact, s.priceMin, s.priceMax),
    establishment: (s.establishment?.name ?? '').toLowerCase(),
    address: addressFromSampleEstablishment(s).toLowerCase(),
  }
}

function establishmentComparables(e: SearchData['establishments'][number]): Record<SearchSortKey, string | number> {
  const s = e
  return {
    brand: (s.brand ?? '').toLowerCase(),
    primary: e.name.toLowerCase(),
    unit: sampleUnit(s).toLowerCase(),
    price: comparablePrice(s.priceExact, s.priceMin, s.priceMax),
    establishment: (s.establishment?.name ?? '').toLowerCase(),
    address: establishmentCatalogAddress(e).toLowerCase(),
  }
}

function sortBySearchState<T extends { id: string }>(
  rows: T[],
  sort: SearchSortState | null,
  getComparable: (row: T) => Record<SearchSortKey, string | number>,
): T[] {
  if (sort === null) {
    return rows
  }
  const mult = sort.dir === 'asc' ? 1 : -1
  const key = sort.key
  return [...rows].sort((a, b) => {
    const va = getComparable(a)[key]
    const vb = getComparable(b)[key]
    let cmp: number
    if (key === 'price') {
      const pa = va as number
      const pb = vb as number
      const ma = !Number.isFinite(pa) || pa === Number.POSITIVE_INFINITY
      const mb = !Number.isFinite(pb) || pb === Number.POSITIVE_INFINITY
      if (ma && mb) {
        cmp = 0
      } else if (ma) {
        cmp = 1
      } else if (mb) {
        cmp = -1
      } else {
        cmp = pa - pb
      }
      if (cmp !== 0) {
        return sort.dir === 'desc' ? -cmp : cmp
      }
    } else {
      cmp = String(va).localeCompare(String(vb), undefined, { sensitivity: 'base', numeric: true })
      if (cmp !== 0) {
        return cmp * mult
      }
    }
    return a.id.localeCompare(b.id)
  })
}

function toggleSearchSort(
  prev: SearchSortState | null,
  key: SearchSortKey,
): SearchSortState {
  if (prev?.key === key) {
    return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
  }
  return { key, dir: 'asc' }
}

function SearchMobileSortBar({
  sort,
  onSort,
  ariaLabel,
}: {
  sort: SearchSortState | null
  onSort: (key: SearchSortKey) => void
  ariaLabel: string
}) {
  const keys: { key: SearchSortKey; label: string }[] = [
    { key: 'brand', label: 'Brand' },
    { key: 'primary', label: 'Product' },
    { key: 'unit', label: 'Unit' },
    { key: 'price', label: 'Price' },
    { key: 'establishment', label: 'Store' },
    { key: 'address', label: 'Address' },
  ]
  return (
    <div className="mb-3 md:hidden" role="group" aria-label={ariaLabel}>
      <p className="mb-1.5 text-xs font-medium text-slate-500">Sort by</p>
      <div className="flex flex-wrap gap-1.5">
        {keys.map(({ key, label }) => {
          const active = sort?.key === key
          const dir = sort?.dir
          const arrow = active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSort(key)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                active
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {label}
              <span className="text-slate-400" aria-hidden>
                {arrow}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SearchTableHead({
  sort,
  onSort,
}: {
  sort: SearchSortState | null
  onSort: (key: SearchSortKey) => void
}) {
  const thBtn = (key: SearchSortKey, label: string) => {
    const active = sort?.key === key
    const dir = sort?.dir
    const arrow = active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''
    return (
      <th className="py-2 pr-3" aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          onClick={() => onSort(key)}
          className="-mx-1 -my-0.5 rounded px-1 py-0.5 text-left font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        >
          {label}
          <span className="font-normal text-slate-400" aria-hidden>
            {arrow}
          </span>
        </button>
      </th>
    )
  }

  return (
    <thead>
      <tr className="border-b border-slate-200 text-xs">
        {thBtn('brand', 'Brand')}
        {thBtn('primary', 'Product')}
        {thBtn('unit', 'Unit')}
        {thBtn('price', 'Price')}
        {thBtn('establishment', 'Establishment')}
        {thBtn('address', 'Address')}
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
  const [categorySort, setCategorySort] = useState<SearchSortState | null>(null)
  const [productSort, setProductSort] = useState<SearchSortState | null>(null)
  const [establishmentSort, setEstablishmentSort] = useState<SearchSortState | null>(null)

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

  useEffect(() => {
    setCategorySort(null)
    setProductSort(null)
    setEstablishmentSort(null)
  }, [q])

  const sortedCategories = useMemo(
    () => (data ? sortBySearchState(data.categories, categorySort, categoryComparables) : []),
    [data, categorySort],
  )
  const sortedProducts = useMemo(
    () => (data ? sortBySearchState(data.products, productSort, productComparables) : []),
    [data, productSort],
  )
  const sortedEstablishments = useMemo(
    () => (data ? sortBySearchState(data.establishments, establishmentSort, establishmentComparables) : []),
    [data, establishmentSort],
  )

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
              (same as the home page). Default order is most recent price activity, then name. Sample columns use the
              cheapest price post in that category (newest tie-break). Click column headers in the table or use Sort by
              on small screens; the list order matches your choice.
            </p>

            <SearchMobileSortBar
              sort={categorySort}
              onSort={(key) => setCategorySort((prev) => toggleSearchSort(prev, key))}
              ariaLabel="Sort categories"
            />

            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <SearchTableHead
                  sort={categorySort}
                  onSort={(key) => setCategorySort((prev) => toggleSearchSort(prev, key))}
                />
                <tbody>
                  {sortedCategories.map((c) => (
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
              {sortedCategories.map((c) => (
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
              <strong className="font-medium text-slate-600">synonym groups</strong> as the home feed. Default order is
              most recent activity, then lowest price, then name. Price and store come from the cheapest matching post
              (newest tie-break). Click column headers in the table or use Sort by on small screens; the list order
              matches your choice.
            </p>

            <SearchMobileSortBar
              sort={productSort}
              onSort={(key) => setProductSort((prev) => toggleSearchSort(prev, key))}
              ariaLabel="Sort products"
            />

            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <SearchTableHead
                  sort={productSort}
                  onSort={(key) => setProductSort((prev) => toggleSearchSort(prev, key))}
                />
                <tbody>
                  {sortedProducts.map((p) => {
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
              {sortedProducts.map((p) => {
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
              Name contains your search. Default order is most recent price post at the store, then name. Sample columns
              use the cheapest post at that store (newest tie-break). Address is the store&apos;s catalog location. Click
              column headers in the table or use Sort by on small screens; the list order matches your choice.
            </p>

            <SearchMobileSortBar
              sort={establishmentSort}
              onSort={(key) => setEstablishmentSort((prev) => toggleSearchSort(prev, key))}
              ariaLabel="Sort establishments"
            />

            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <SearchTableHead
                  sort={establishmentSort}
                  onSort={(key) => setEstablishmentSort((prev) => toggleSearchSort(prev, key))}
                />
                <tbody>
                  {sortedEstablishments.map((e) => {
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
              {sortedEstablishments.map((e) => {
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
