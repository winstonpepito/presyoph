import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { SearchableSelect } from './SearchableSelect'
import type { LocationsPayload } from '../types/locations'

export function PostPriceForm({
  categories,
  productUnits,
  locations,
  anonymousAllowed,
  isSignedIn,
  prefillLat,
  prefillLng,
  geoDetectedCitySlug,
}: {
  categories: { id: string; name: string }[]
  productUnits: { code: string; label: string }[]
  locations: LocationsPayload
  anonymousAllowed: boolean
  isSignedIn: boolean
  prefillLat?: string
  prefillLng?: string
  /** When GPS (or URL coords) resolves to a known city, select it */
  geoDetectedCitySlug?: string | null
}) {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [mode, setMode] = useState<'exact' | 'range'>('exact')
  const [lat, setLat] = useState(prefillLat ?? '')
  const [lng, setLng] = useState(prefillLng ?? '')
  const [citySlug, setCitySlug] = useState(() => {
    const d = locations.defaultCitySlug
    if (d && locations.cities.some((c) => c.slug === d)) return d
    return locations.cities[0]?.slug ?? ''
  })
  const [barangayName, setBarangayName] = useState('')
  const [geoNote, setGeoNote] = useState<string | null>(null)
  const [estName, setEstName] = useState('')
  const [estAddress, setEstAddress] = useState('')
  const [productBlockKey, setProductBlockKey] = useState(0)

  useEffect(() => {
    if (prefillLat) setLat(prefillLat)
    if (prefillLng) setLng(prefillLng)
  }, [prefillLat, prefillLng])

  useEffect(() => {
    if (
      geoDetectedCitySlug &&
      locations.cities.some((c) => c.slug === geoDetectedCitySlug)
    ) {
      setCitySlug(geoDetectedCitySlug)
      setBarangayName('')
    }
  }, [geoDetectedCitySlug, locations.cities])

  useEffect(() => {
    if (!successToast) return
    const t = window.setTimeout(() => setSuccessToast(null), 5000)
    return () => window.clearTimeout(t)
  }, [successToast])

  const selectedCity = locations.cities.find((c) => c.slug === citySlug)

  const cityOptions = useMemo(
    () => locations.cities.map((c) => ({ value: c.slug, label: c.name })),
    [locations.cities],
  )

  const barangayOptions = useMemo(
    () => (selectedCity?.barangays ?? []).map((b) => ({ value: b.name, label: b.name })),
    [selectedCity?.barangays],
  )

  async function submitForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = e.currentTarget
    const native = e.nativeEvent as SubmitEvent
    const submitter = native.submitter instanceof HTMLButtonElement ? native.submitter : undefined
    const fd = new FormData(form, submitter)
    const submitIntent = fd.get('submitIntent')
    const intent = submitIntent === 'addMore' ? 'addMore' : 'home'

    const cityName = selectedCity?.name
    const categoryIdRaw = String(fd.get('categoryId') ?? '').trim()
    const productBrandRaw = String(fd.get('productBrand') ?? '').trim()

    const anonymousRequested = isSignedIn && anonymousAllowed && fd.get('anonymous') === 'on'
    const body: Record<string, unknown> = {
      productName: String(fd.get('productName') ?? ''),
      establishmentName: estName.trim(),
      establishmentAddress: estAddress.trim() ? estAddress.trim() : undefined,
      establishmentBarangay: barangayName.trim() ? barangayName.trim() : undefined,
      establishmentCity: cityName,
      priceMode: mode,
      priceExact: mode === 'exact' ? String(fd.get('priceExact') ?? '') : undefined,
      priceMin: mode === 'range' ? String(fd.get('priceMin') ?? '') : undefined,
      priceMax: mode === 'range' ? String(fd.get('priceMax') ?? '') : undefined,
      unit: String(fd.get('unit') ?? 'pcs'),
      unitQuantity: String(fd.get('unitQuantity') ?? '1'),
      latitude: Number(fd.get('latitude')),
      longitude: Number(fd.get('longitude')),
      locationLabel: fd.get('locationLabel') ? String(fd.get('locationLabel')) : undefined,
      anonymous: anonymousRequested,
    }
    if (categoryIdRaw) {
      body.categoryId = categoryIdRaw
    }
    if (productBrandRaw) {
      body.productBrand = productBrandRaw
    }

    try {
      const r = await apiFetch('/api/v1/posts', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const j = (await r.json()) as { error?: string; ok?: boolean }
      if (!r.ok) {
        setError(j.error ?? 'Could not post')
        return
      }
      if (intent === 'home') {
        navigate('/')
        return
      }
      setSuccessToast('Price added. Enter another item for the same store.')
      setMode('exact')
      setProductBlockKey((k) => k + 1)
    } finally {
      setPending(false)
    }
  }

  const locate = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not available in this browser.')
      return
    }
    setGeoNote(null)
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const la = String(p.coords.latitude)
        const ln = String(p.coords.longitude)
        setLat(la)
        setLng(ln)
        try {
          const r = await apiFetch('/api/v1/geo/resolve-city', {
            method: 'POST',
            body: JSON.stringify({
              latitude: p.coords.latitude,
              longitude: p.coords.longitude,
            }),
            skipAuth: true,
          })
          if (!r.ok) {
            setGeoNote('GPS updated. Could not detect city automatically.')
            return
          }
          const j = (await r.json()) as {
            matched?: boolean
            citySlug?: string
            cityName?: string
            source?: string
          }
          if (j.matched && j.citySlug && locations.cities.some((c) => c.slug === j.citySlug)) {
            setCitySlug(j.citySlug)
            setBarangayName('')
            const src = j.source === 'nominatim' ? 'map data' : 'area map'
            setGeoNote(`City set to ${j.cityName ?? j.citySlug} (${src}).`)
          } else {
            setGeoNote('GPS updated. You are outside the configured metro cities — pick a city manually.')
          }
        } catch {
          setGeoNote('GPS updated. City detection failed — pick a city manually.')
        }
      },
      () => alert('Location permission denied.'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    )
  }

  return (
    <>
      {successToast ? (
        <div
          role="alert"
          aria-live="polite"
          className="fixed left-1/2 top-4 z-[100] max-w-md -translate-x-1/2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-950 shadow-lg"
        >
          {successToast}
        </div>
      ) : null}
      <form onSubmit={(e) => void submitForm(e)} className="mx-auto max-w-xl space-y-5">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div key={`post-top-${productBlockKey}`} className="space-y-5">
        <div>
          <label className="text-sm font-medium text-slate-700">Category (optional)</label>
          <select
            name="categoryId"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            defaultValue=""
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
            name="productName"
            required
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="e.g. Egg"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Brand (optional)</label>
          <input
            name="productBrand"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="e.g. Magnolia"
            maxLength={120}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700">Unit</label>
            <select
              name="unit"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              defaultValue="pcs"
            >
              {productUnits.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Amount (volume / pack size)</label>
            <input
              name="unitQuantity"
              type="number"
              step="any"
              min="0.000001"
              defaultValue={1}
              required
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="e.g. 1.5 for 1.5 L, 500 for 500 mL"
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Price is for this amount and unit (e.g. 500 + mL = 500 mL pack; 1 + dozen = per dozen).
        </p>

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
              name="priceExact"
              type="number"
              step="0.0001"
              min="0"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Min</label>
              <input
                name="priceMin"
                type="number"
                step="0.0001"
                min="0"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Max</label>
              <input
                name="priceMax"
                type="number"
                step="0.0001"
                min="0"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Establishment</label>
        <input
          name="establishmentName"
          required
          value={estName}
          onChange={(e) => setEstName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Store or vendor name"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Street / building (optional)</label>
        <input
          name="establishmentAddress"
          value={estAddress}
          onChange={(e) => setEstAddress(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="House no., street, landmark…"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SearchableSelect
          id="post-city"
          label="City"
          options={cityOptions}
          value={citySlug}
          onChange={(slug) => {
            setCitySlug(slug)
            setBarangayName('')
          }}
          placeholder="Type to search cities…"
        />
        <SearchableSelect
          key={citySlug}
          id="post-barangay"
          label="Barangay (optional)"
          options={barangayOptions}
          value={barangayName}
          onChange={setBarangayName}
          allowEmpty
          emptyLabel="None (optional)"
          placeholder="Search barangay…"
        />
      </div>

      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700">Latitude</label>
            <input
              name="latitude"
              required
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="10.3157"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Longitude</label>
            <input
              name="longitude"
              required
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="123.8854"
            />
          </div>
        </div>
        <div>
          <button
            type="button"
            onClick={() => void locate()}
            className="text-sm font-medium text-emerald-600 hover:underline"
          >
            Use my current location (GPS)
          </button>
          <p className="mt-1 text-xs text-slate-500">
            Fills latitude and longitude from your device. When possible, the city is chosen from your position (Cebu metro
            area).
          </p>
          {geoNote ? <p className="mt-2 text-xs text-emerald-800">{geoNote}</p> : null}
        </div>

        <div key={`post-tail-${productBlockKey}`} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-700">Location note (optional)</label>
            <input
              name="locationLabel"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Aisle 3, corner store…"
            />
          </div>

          {!isSignedIn && anonymousAllowed && (
            <p className="text-sm text-slate-600">
              You&apos;re not signed in — this price will be posted <strong>anonymously</strong>.
            </p>
          )}

          {isSignedIn && anonymousAllowed && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="anonymous" />
              Post anonymously
            </label>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="submit"
          name="submitIntent"
          value="home"
          disabled={pending}
          className="rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:px-8"
        >
          {pending ? 'Posting…' : 'Submit price'}
        </button>
        <button
          type="submit"
          name="submitIntent"
          value="addMore"
          disabled={pending}
          className="rounded-xl border border-emerald-600 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 sm:px-8"
        >
          {pending ? 'Posting…' : 'Submit and add more'}
        </button>
      </div>
    </form>
    </>
  )
}
