import { Link, useSearchParams } from 'react-router-dom'
import { PostLocationMapModal } from '../components/PostLocationMapModal'
import { apiFetch } from '../lib/api'
import { formatEstablishmentAddress } from '../lib/formatEstablishmentAddress'
import { formatUnitSummary } from '../lib/formatUnit'
import { hasUsableMapCoords } from '../lib/openStreetMapEmbed'
import { comparablePrice, formatPricePostLabel } from '../lib/pricing'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

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
  /** Representative price post coordinates (or establishment fallback from API). */
  latitude: number | null
  longitude: number | null
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
    latitude: number | null
    longitude: number | null
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

type SearchMetaSection = {
  total: number
  offset: number
  limit: number
  hasMore: boolean
}

type SearchResponse = SearchData & {
  meta: {
    categories: SearchMetaSection
    products: SearchMetaSection
    establishments: SearchMetaSection
  }
}

const SEARCH_PAGE_CATEGORIES = 15
const SEARCH_PAGE_PRODUCTS = 20
const SEARCH_PAGE_ESTABLISHMENTS = 15

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
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
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
  const [mapOpen, setMapOpen] = useState(false)
  const lat = sample.latitude
  const lng = sample.longitude
  const showMapBtn =
    lat != null && lng != null && hasUsableMapCoords(Number(lat), Number(lng))
  const mapTitle = sample.establishment?.name ?? 'Location'

  return (
    <>
      <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{headlineLabel}</p>
            <div className="font-semibold text-emerald-700">{headlineLink}</div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
            {showMapBtn ? (
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-emerald-600"
                aria-label="View price location on map"
                title="Map"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path
                    d="M12 21s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10z"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="11" r="2.5" />
                </svg>
              </button>
            ) : null}
            <p className="text-lg font-bold text-emerald-700">{price}</p>
          </div>
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
      {mapOpen ? (
        <PostLocationMapModal
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          latitude={Number(lat)}
          longitude={Number(lng)}
          title={mapTitle}
        />
      ) : null}
    </>
  )
}

function LoadMoreSentinel({
  hasMore,
  loading,
  onLoadMore,
}: {
  hasMore: boolean
  loading: boolean
  onLoadMore: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onLoadMoreRef = useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore

  useEffect(() => {
    if (!hasMore || loading) {
      return
    }
    const el = ref.current
    if (!el) {
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMoreRef.current()
        }
      },
      { root: null, rootMargin: '120px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loading])

  if (!hasMore) {
    return null
  }

  return (
    <div
      ref={ref}
      className="flex min-h-10 items-center justify-center py-3 text-xs text-slate-500"
      aria-live="polite"
    >
      {loading ? 'Loading more…' : '\u00a0'}
    </div>
  )
}

export function SearchPage() {
  const [searchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const [categories, setCategories] = useState<SearchData['categories']>([])
  const [products, setProducts] = useState<SearchData['products']>([])
  const [establishments, setEstablishments] = useState<SearchData['establishments']>([])
  const [meta, setMeta] = useState<SearchResponse['meta'] | null>(null)
  const [initialLoading, setInitialLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState<'categories' | 'products' | 'establishments' | null>(null)
  const [categorySort, setCategorySort] = useState<SearchSortState | null>(null)
  const [productSort, setProductSort] = useState<SearchSortState | null>(null)
  const [establishmentSort, setEstablishmentSort] = useState<SearchSortState | null>(null)

  const loadLock = useRef(false)
  const categoriesRef = useRef(categories)
  const productsRef = useRef(products)
  const establishmentsRef = useRef(establishments)
  const metaRef = useRef(meta)

  useEffect(() => {
    categoriesRef.current = categories
    productsRef.current = products
    establishmentsRef.current = establishments
    metaRef.current = meta
  }, [categories, products, establishments, meta])

  useEffect(() => {
    if (!q.trim()) {
      setCategories([])
      setProducts([])
      setEstablishments([])
      setMeta(null)
      setInitialLoading(false)
      return
    }
    let cancelled = false
    setCategories([])
    setProducts([])
    setEstablishments([])
    setMeta(null)
    setInitialLoading(true)
    void (async () => {
      const params = new URLSearchParams({ q: q.trim() })
      params.set('categoriesOffset', '0')
      params.set('categoriesLimit', String(SEARCH_PAGE_CATEGORIES))
      params.set('productsOffset', '0')
      params.set('productsLimit', String(SEARCH_PAGE_PRODUCTS))
      params.set('establishmentsOffset', '0')
      params.set('establishmentsLimit', String(SEARCH_PAGE_ESTABLISHMENTS))
      const r = await apiFetch(`/api/v1/search?${params}`)
      const j = (await r.json()) as SearchResponse
      if (cancelled) {
        return
      }
      setCategories(j.categories)
      setProducts(j.products)
      setEstablishments(j.establishments)
      setMeta(j.meta)
      setInitialLoading(false)
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

  const loadMore = useCallback(async (section: 'categories' | 'products' | 'establishments') => {
    const term = q.trim()
    if (!term || loadLock.current) {
      return
    }
    const m = metaRef.current
    if (!m) {
      return
    }
    if (section === 'categories' && !m.categories.hasMore) {
      return
    }
    if (section === 'products' && !m.products.hasMore) {
      return
    }
    if (section === 'establishments' && !m.establishments.hasMore) {
      return
    }

    loadLock.current = true
    setLoadingMore(section)
    try {
      const c = categoriesRef.current
      const p = productsRef.current
      const e = establishmentsRef.current
      const params = new URLSearchParams({ q: term })
      params.set('categoriesOffset', String(c.length))
      params.set('categoriesLimit', section === 'categories' ? String(SEARCH_PAGE_CATEGORIES) : '0')
      params.set('productsOffset', String(p.length))
      params.set('productsLimit', section === 'products' ? String(SEARCH_PAGE_PRODUCTS) : '0')
      params.set('establishmentsOffset', String(e.length))
      params.set('establishmentsLimit', section === 'establishments' ? String(SEARCH_PAGE_ESTABLISHMENTS) : '0')
      const r = await apiFetch(`/api/v1/search?${params}`)
      const j = (await r.json()) as SearchResponse
      if (j.categories.length) {
        setCategories((prev) => [...prev, ...j.categories])
      }
      if (j.products.length) {
        setProducts((prev) => [...prev, ...j.products])
      }
      if (j.establishments.length) {
        setEstablishments((prev) => [...prev, ...j.establishments])
      }
      setMeta(j.meta)
    } finally {
      loadLock.current = false
      setLoadingMore(null)
    }
  }, [q])

  const sortedCategories = useMemo(
    () => sortBySearchState(categories, categorySort, categoryComparables),
    [categories, categorySort],
  )
  const sortedProducts = useMemo(
    () => sortBySearchState(products, productSort, productComparables),
    [products, productSort],
  )
  const sortedEstablishments = useMemo(
    () => sortBySearchState(establishments, establishmentSort, establishmentComparables),
    [establishments, establishmentSort],
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
      ) : initialLoading ? (
        <p className="mt-8 text-slate-500">Loading…</p>
      ) : (
        <div className="mt-8 space-y-8">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Categories</h2>
            <p className="mt-1 text-xs text-slate-500">
              Name matches your search and <strong className="font-medium text-slate-600">admin product synonyms</strong>{' '}
              (same as the home page). Default order is most recent price activity, then name. Sample columns use the
              cheapest price post in that category (newest tie-break). Click column headers in the table or use Sort by
              on small screens; the list order matches your choice. When there are more rows, scrolling near the bottom of
              a section loads the next page for that section only.
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
              {categories.length === 0 && <p className="mt-2 text-sm text-slate-400">No matches</p>}
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
              {categories.length === 0 && <li className="text-sm text-slate-400">No matches</li>}
            </ul>
            <LoadMoreSentinel
              hasMore={Boolean(meta?.categories.hasMore)}
              loading={loadingMore === 'categories'}
              onLoadMore={() => void loadMore('categories')}
            />
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
              {products.length === 0 && <p className="mt-2 text-sm text-slate-400">No matches</p>}
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
              {products.length === 0 && <li className="text-sm text-slate-400">No matches</li>}
            </ul>
            <LoadMoreSentinel
              hasMore={Boolean(meta?.products.hasMore)}
              loading={loadingMore === 'products'}
              onLoadMore={() => void loadMore('products')}
            />
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
              {establishments.length === 0 && <p className="mt-2 text-sm text-slate-400">No matches</p>}
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
              {establishments.length === 0 && <li className="text-sm text-slate-400">No matches</li>}
            </ul>
            <LoadMoreSentinel
              hasMore={Boolean(meta?.establishments.hasMore)}
              loading={loadingMore === 'establishments'}
              onLoadMore={() => void loadMore('establishments')}
            />
          </section>
        </div>
      )}
    </div>
  )
}
