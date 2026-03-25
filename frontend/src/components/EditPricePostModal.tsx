import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { LocationsPayload } from '../types/locations'
import type { PricePostView } from '../types/post'
import { SearchableSelect } from './SearchableSelect'

type Props = {
  post: PricePostView
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export function EditPricePostModal({ post, isOpen, onClose, onSaved }: Props) {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [locations, setLocations] = useState<LocationsPayload | null>(null)
  const [productUnits, setProductUnits] = useState<{ code: string; label: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const [mode, setMode] = useState<'exact' | 'range'>('exact')
  const [productName, setProductName] = useState('')
  const [productBrand, setProductBrand] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [unit, setUnit] = useState('pcs')
  const [unitQuantity, setUnitQuantity] = useState('1')
  const [priceExact, setPriceExact] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [estName, setEstName] = useState('')
  const [estAddress, setEstAddress] = useState('')
  const [citySlug, setCitySlug] = useState('')
  const [barangayName, setBarangayName] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [locationLabel, setLocationLabel] = useState('')

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    void (async () => {
      const [catR, metaR, locR] = await Promise.all([
        apiFetch('/api/v1/categories'),
        apiFetch('/api/v1/meta'),
        apiFetch('/api/v1/locations', { skipAuth: true }),
      ])
      const catJ = (await catR.json()) as { categories: { id: string; name: string }[] }
      const metaJ = (await metaR.json()) as { productUnits?: { code: string; label: string }[] }
      let locPayload: LocationsPayload = { defaultCitySlug: '', cities: [] }
      if (locR.ok) {
        try {
          const locJ = (await locR.json()) as LocationsPayload
          if (Array.isArray(locJ.cities) && locJ.cities.length > 0) {
            locPayload = {
              defaultCitySlug: locJ.defaultCitySlug || locJ.cities[0].slug,
              cities: locJ.cities,
            }
          }
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) {
        setCategories(catJ.categories ?? [])
        setProductUnits(Array.isArray(metaJ.productUnits) ? metaJ.productUnits : [])
        setLocations(locPayload)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !locations || locations.cities.length === 0) return
    const nm = (s: string) => s.trim().toLowerCase()
    const cityFromPost = post.establishment.city?.trim() ?? ''
    const match = locations.cities.find((c) => nm(c.name) === nm(cityFromPost))
    const slug = match?.slug ?? locations.defaultCitySlug ?? locations.cities[0]?.slug ?? ''

    setProductName(post.product.name)
    setProductBrand(post.product.brand ?? '')
    setCategoryId(post.product.category?.id ?? '')
    setUnit(post.unit ?? post.product.unit ?? 'pcs')
    setUnitQuantity(post.unitQuantity ?? post.product.unitQuantity ?? '1')
    if (post.priceExact != null) {
      setMode('exact')
      setPriceExact(post.priceExact)
      setPriceMin('')
      setPriceMax('')
    } else {
      setMode('range')
      setPriceExact('')
      setPriceMin(post.priceMin ?? '')
      setPriceMax(post.priceMax ?? '')
    }
    setEstName(post.establishment.name)
    setEstAddress(post.establishment.addressLine ?? '')
    setCitySlug(slug)
    setBarangayName(post.establishment.barangay ?? '')
    setLat(String(post.latitude))
    setLng(String(post.longitude))
    setLocationLabel(post.locationLabel ?? '')
    setError(null)
  }, [isOpen, post, locations])

  const selectedCity = locations?.cities.find((c) => c.slug === citySlug)
  const cityOptions = useMemo(
    () => (locations?.cities ?? []).map((c) => ({ value: c.slug, label: c.name })),
    [locations?.cities],
  )
  const barangayOptions = useMemo(
    () => (selectedCity?.barangays ?? []).map((b) => ({ value: b.name, label: b.name })),
    [selectedCity?.barangays],
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const cityName = selectedCity?.name
    if (!cityName) {
      setError('Select a valid city.')
      return
    }
    setPending(true)
    try {
      const body: Record<string, unknown> = {
        productName: productName.trim(),
        establishmentName: estName.trim(),
        establishmentAddress: estAddress.trim() ? estAddress.trim() : undefined,
        establishmentBarangay: barangayName.trim() ? barangayName.trim() : undefined,
        establishmentCity: cityName,
        priceMode: mode,
        priceExact: mode === 'exact' ? priceExact : undefined,
        priceMin: mode === 'range' ? priceMin : undefined,
        priceMax: mode === 'range' ? priceMax : undefined,
        unit,
        unitQuantity,
        latitude: Number(lat),
        longitude: Number(lng),
        locationLabel: locationLabel.trim() ? locationLabel.trim() : undefined,
      }
      if (categoryId) body.categoryId = categoryId
      if (productBrand.trim()) body.productBrand = productBrand.trim()

      const r = await apiFetch(`/api/v1/posts/${post.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      const j = (await r.json()) as { error?: string }
      if (!r.ok) {
        setError(j.error ?? 'Could not update post')
        return
      }
      onSaved()
      onClose()
    } finally {
      setPending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-post-title"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h2 id="edit-post-title" className="text-lg font-semibold text-slate-900">
            Edit price post
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Updating product or store details may affect other posts that share the same product or place.
        </p>

        {!locations || locations.cities.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">Loading form…</p>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
            ) : null}

            <div>
              <label className="text-sm font-medium text-slate-700">Category (optional)</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Product name</label>
              <input
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Brand (optional)</label>
              <input
                value={productBrand}
                onChange={(e) => setProductBrand(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                maxLength={120}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Unit</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {productUnits.map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Amount</label>
                <input
                  type="number"
                  step="any"
                  min="0.000001"
                  required
                  value={unitQuantity}
                  onChange={(e) => setUnitQuantity(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={mode === 'exact'} onChange={() => setMode('exact')} />
                Exact price
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={mode === 'range'} onChange={() => setMode('range')} />
                Price range
              </label>
            </div>

            {mode === 'exact' ? (
              <div>
                <label className="text-sm font-medium text-slate-700">Price</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  required
                  value={priceExact}
                  onChange={(e) => setPriceExact(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">Min</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Max</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-slate-700">Establishment</label>
              <input
                required
                value={estName}
                onChange={(e) => setEstName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Street / building (optional)</label>
              <input
                value={estAddress}
                onChange={(e) => setEstAddress(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SearchableSelect
                id="edit-post-city"
                label="City"
                options={cityOptions}
                value={citySlug}
                onChange={(slug) => {
                  setCitySlug(slug)
                  setBarangayName('')
                }}
                placeholder="Search cities…"
              />
              <SearchableSelect
                key={citySlug}
                id="edit-post-barangay"
                label="Barangay (optional)"
                options={barangayOptions}
                value={barangayName}
                onChange={setBarangayName}
                allowEmpty
                emptyLabel="None"
                placeholder="Search barangay…"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Latitude</label>
                <input
                  required
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Longitude</label>
                <input
                  required
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Location note (optional)</label>
              <input
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {pending ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
