import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { LocationsPayload } from '../types/locations'

type SearchSynonymGroupRow = { id: string; type: 'product' | 'area'; terms: string[] }

type AdminState = {
  anonymousEnabled: boolean
  homeTopStrategy: 'STATIC' | 'ROTATE'
  banners: { id: string; isActive: boolean; slotKey: string }[]
  categories: { id: string; name: string; slug: string }[]
  productUnits: { id: string; code: string; label: string; sortOrder: number }[]
  searchSynonymGroups: SearchSynonymGroupRow[]
}

type LocationsSynonymsTab = 'cities' | 'synonyms'

export function AdminPage() {
  const [state, setState] = useState<AdminState | null>(null)
  const [locations, setLocations] = useState<LocationsPayload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [locationsSynonymsTab, setLocationsSynonymsTab] = useState<LocationsSynonymsTab>('cities')

  async function load() {
    const r = await apiFetch('/api/admin/state')
    if (!r.ok) {
      setErr('Could not load admin state')
      return
    }
    const j = (await r.json()) as Partial<AdminState>
    const rawSyn: unknown[] = Array.isArray(j.searchSynonymGroups) ? j.searchSynonymGroups : []
    const searchSynonymGroups: SearchSynonymGroupRow[] = []
    for (const item of rawSyn) {
      if (item === null || typeof item !== 'object') continue
      const g = item as { id?: unknown; type?: unknown; terms?: unknown }
      const id = String(g.id ?? '')
      if (!id) continue
      const type: 'product' | 'area' = g.type === 'area' ? 'area' : 'product'
      const terms = Array.isArray(g.terms) ? g.terms.map((t) => String(t)) : []
      searchSynonymGroups.push({ id, type, terms })
    }

    setState({
      anonymousEnabled: !!j.anonymousEnabled,
      homeTopStrategy: j.homeTopStrategy === 'STATIC' ? 'STATIC' : 'ROTATE',
      banners: Array.isArray(j.banners) ? j.banners : [],
      categories: Array.isArray(j.categories) ? j.categories : [],
      productUnits: Array.isArray(j.productUnits) ? j.productUnits : [],
      searchSynonymGroups,
    })
    setErr(null)
  }

  async function loadLocations() {
    const r = await apiFetch('/api/v1/locations', { skipAuth: true })
    if (!r.ok) return
    const j = (await r.json()) as LocationsPayload
    if (Array.isArray(j.cities)) {
      setLocations({
        defaultCitySlug: j.defaultCitySlug || j.cities[0]?.slug || '',
        cities: j.cities,
      })
    }
  }

  useEffect(() => {
    void load()
    void loadLocations()
  }, [])

  async function flipAnonymous() {
    const r = await apiFetch('/api/admin/anonymous/flip', { method: 'POST', body: '{}' })
    if (r.ok) void load()
  }

  async function setStrategy(s: 'STATIC' | 'ROTATE') {
    const r = await apiFetch('/api/admin/banner-strategy/home-top', {
      method: 'POST',
      body: JSON.stringify({ strategy: s }),
    })
    if (r.ok) void load()
  }

  async function addBanner(fd: FormData) {
    const file = fd.get('image')
    if (!(file instanceof File) || file.size === 0) {
      alert('Choose an image file to upload.')
      return
    }
    const r = await apiFetch('/api/admin/banners', { method: 'POST', body: fd })
    if (!r.ok) {
      if (r.status === 413) {
        alert(
          'This file is larger than your server allows (HTTP 413 Request Entity Too Large). On nginx, add or raise client_max_body_size (e.g. 12M) in the server block for this site, reload nginx, and ensure PHP upload_max_filesize and post_max_size are at least that large. See deploy/nginx-upload-limits.conf in the project repo.',
        )
        return
      }
      const ct = r.headers.get('content-type') ?? ''
      try {
        if (ct.includes('application/json')) {
          const j = (await r.json()) as { message?: string; errors?: Record<string, string[]> }
          const msg =
            j.message ??
            (j.errors ? Object.values(j.errors).flat().join(' ') : null) ??
            `Upload failed (HTTP ${r.status}). Check file type (JPEG, PNG, GIF, WebP) and size (max 5 MB), or server upload limits.`
          alert(msg)
        } else {
          const text = (await r.text()).slice(0, 500)
          alert(
            `Upload failed (HTTP ${r.status}). ${text || 'Non-JSON response — often means the file exceeded PHP post_max_size / upload_max_filesize or the reverse-proxy body limit.'}`,
          )
        }
      } catch {
        alert(`Upload failed (HTTP ${r.status}).`)
      }
      return
    }
    void load()
  }

  async function toggleBanner(id: string, isActive: boolean) {
    const r = await apiFetch(`/api/admin/banners/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    })
    if (r.ok) void load()
  }

  async function deleteBanner(id: string) {
    const r = await apiFetch(`/api/admin/banners/${id}`, { method: 'DELETE' })
    if (r.ok) void load()
  }

  async function addBarangay(cityId: string, name: string) {
    const r = await apiFetch('/api/admin/barangays', {
      method: 'POST',
      body: JSON.stringify({ cityId, name: name.trim() }),
    })
    if (r.ok) void loadLocations()
  }

  async function deleteBarangay(id: string) {
    const r = await apiFetch(`/api/admin/barangays/${id}`, { method: 'DELETE' })
    if (r.ok) void loadLocations()
  }

  async function addCategory(name: string) {
    const r = await apiFetch('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim() }),
    })
    if (r.ok) void load()
  }

  async function saveCategory(id: string, name: string) {
    const r = await apiFetch(`/api/admin/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: name.trim() }),
    })
    if (r.ok) void load()
  }

  async function deleteCategory(id: string) {
    const r = await apiFetch(`/api/admin/categories/${id}`, { method: 'DELETE' })
    if (r.ok) void load()
  }

  async function addProductUnit(code: string, label: string, sortOrder: number | undefined) {
    const r = await apiFetch('/api/admin/product-units', {
      method: 'POST',
      body: JSON.stringify({
        code: code.trim(),
        label: label.trim(),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      }),
    })
    if (r.ok) void load()
  }

  async function saveProductUnit(id: string, label: string, sortOrder: number) {
    const r = await apiFetch(`/api/admin/product-units/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ label: label.trim(), sortOrder }),
    })
    if (r.ok) void load()
  }

  async function deleteProductUnit(id: string) {
    const r = await apiFetch(`/api/admin/product-units/${id}`, { method: 'DELETE' })
    if (r.ok) void load()
  }

  function parseSynonymTerms(raw: string): string[] {
    return raw
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }

  async function addSearchSynonymGroup(type: 'product' | 'area', termsRaw: string) {
    const terms = parseSynonymTerms(termsRaw)
    if (terms.length === 0) {
      alert('Add at least one term (comma or newline separated).')
      return
    }
    const r = await apiFetch('/api/admin/search-synonym-groups', {
      method: 'POST',
      body: JSON.stringify({ type, terms }),
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      alert(j.error ?? 'Could not save synonym group.')
      return
    }
    void load()
  }

  async function saveSearchSynonymGroup(id: string, termsRaw: string) {
    const terms = parseSynonymTerms(termsRaw)
    if (terms.length === 0) {
      alert('Add at least one term.')
      return
    }
    const r = await apiFetch(`/api/admin/search-synonym-groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ terms }),
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      alert(j.error ?? 'Could not update synonym group.')
      return
    }
    void load()
  }

  async function deleteSearchSynonymGroup(id: string) {
    if (!confirm('Delete this synonym group?')) return
    const r = await apiFetch(`/api/admin/search-synonym-groups/${id}`, { method: 'DELETE' })
    if (r.ok) void load()
  }

  if (err || !state) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-slate-600">{err ?? 'Loading…'}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Admin settings</h1>

      <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Categories</h2>
        <p className="mt-1 text-sm text-slate-600">
          Categories appear in search and on posts. Users can leave a post uncategorized. Renaming updates the URL slug
          for category pages. You cannot delete a category that still has products.
        </p>
        <ul className="mt-4 space-y-3">
          {state.categories.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:flex-row sm:items-end sm:justify-between"
            >
              <form
                className="flex flex-1 flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  const n = String(fd.get('name') ?? '').trim()
                  if (n) void saveCategory(c.id, n)
                }}
              >
                <div className="min-w-[10rem] flex-1">
                  <label className="text-xs text-slate-500">Name · {c.slug}</label>
                  <input
                    name="name"
                    defaultValue={c.name}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Save
                </button>
              </form>
              <button
                type="button"
                onClick={() => void deleteCategory(c.id)}
                className="text-sm text-red-600 hover:underline sm:shrink-0"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4"
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const n = String(fd.get('name') ?? '').trim()
            if (n) {
              void addCategory(n)
              e.currentTarget.reset()
            }
          }}
        >
          <div className="min-w-[12rem] flex-1">
            <label className="text-xs text-slate-500">New category name</label>
            <input
              name="name"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="e.g. Snacks"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Add category
          </button>
        </form>
      </section>

      <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Product units</h2>
        <p className="mt-1 text-sm text-slate-600">
          Units appear in the post form and on price cards. The code is stored on posts (immutable after creation). You
          cannot delete a unit that is still in use, and at least one unit must exist.
        </p>
        <ul className="mt-4 space-y-3">
          {state.productUnits.map((u) => (
            <li
              key={u.id}
              className="rounded-xl border border-slate-100 bg-slate-50/80 p-3"
            >
              <form
                className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
                onSubmit={(e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  const label = String(fd.get('label') ?? '').trim()
                  const sortOrder = Number(fd.get('sortOrder') ?? u.sortOrder)
                  if (label && !Number.isNaN(sortOrder)) void saveProductUnit(u.id, label, sortOrder)
                }}
              >
                <div className="font-mono text-xs font-semibold text-slate-600 sm:w-24 sm:pt-2">{u.code}</div>
                <div className="min-w-[8rem] flex-1">
                  <label className="text-xs text-slate-500">Label</label>
                  <input
                    name="label"
                    defaultValue={u.label}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="w-24">
                  <label className="text-xs text-slate-500">Sort</label>
                  <input
                    name="sortOrder"
                    type="number"
                    defaultValue={u.sortOrder}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => void deleteProductUnit(u.id)}
                  className="rounded-lg px-3 py-2 text-sm text-red-600 hover:underline"
                >
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form
          className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const code = String(fd.get('code') ?? '').trim()
            const label = String(fd.get('label') ?? '').trim()
            const so = fd.get('sortOrder')
            const sortOrder = so !== null && String(so) !== '' ? Number(so) : undefined
            if (code && label) {
              void addProductUnit(code, label, sortOrder !== undefined && !Number.isNaN(sortOrder) ? sortOrder : undefined)
              e.currentTarget.reset()
            }
          }}
        >
          <div className="min-w-[6rem]">
            <label className="text-xs text-slate-500">Code</label>
            <input
              name="code"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
              placeholder="sack"
              pattern="[A-Za-z][A-Za-z0-9_-]{0,30}"
              title="Letter, then letters, digits, _ or - (max 32 chars)"
            />
          </div>
          <div className="min-w-[10rem] flex-1">
            <label className="text-xs text-slate-500">Label</label>
            <input
              name="label"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Sack (25 kg)"
            />
          </div>
          <div className="w-24">
            <label className="text-xs text-slate-500">Sort (opt.)</label>
            <input name="sortOrder" type="number" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Add unit
          </button>
        </form>
      </section>

      <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Locations &amp; home search</h2>
        <p className="mt-1 text-sm text-slate-600">
          Switch between city/barangay setup and synonym groups for the home page product and area filters.
        </p>
        <div
          className="mt-4 flex flex-wrap gap-1 border-b border-slate-200"
          role="tablist"
          aria-label="Cities and search synonyms"
        >
          <button
            type="button"
            role="tab"
            id="admin-tab-cities"
            aria-selected={locationsSynonymsTab === 'cities'}
            aria-controls="admin-panel-cities"
            tabIndex={locationsSynonymsTab === 'cities' ? 0 : -1}
            onClick={() => setLocationsSynonymsTab('cities')}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              locationsSynonymsTab === 'cities'
                ? 'border border-b-0 border-slate-200 bg-white text-slate-900'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            Cities &amp; barangays
          </button>
          <button
            type="button"
            role="tab"
            id="admin-tab-synonyms"
            aria-selected={locationsSynonymsTab === 'synonyms'}
            aria-controls="admin-panel-synonyms"
            tabIndex={locationsSynonymsTab === 'synonyms' ? 0 : -1}
            onClick={() => setLocationsSynonymsTab('synonyms')}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              locationsSynonymsTab === 'synonyms'
                ? 'border border-b-0 border-slate-200 bg-white text-slate-900'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            Home search synonyms
          </button>
        </div>

        <div
          id="admin-panel-cities"
          role="tabpanel"
          aria-labelledby="admin-tab-cities"
          hidden={locationsSynonymsTab !== 'cities'}
          className="mt-6"
        >
          <p className="text-sm text-slate-600">
            Barangays are grouped under each city. Users pick a city and barangay when posting a price; the barangay list
            updates when the city changes. Cebu City is the default city for new posts. GPS can auto-select a city when
            the user is in the Cebu metro area.
          </p>
          {!locations ? (
            <p className="mt-4 text-sm text-slate-500">Loading locations…</p>
          ) : (
            <div className="mt-6 space-y-8">
              {locations.cities.map((city) => (
                <div key={city.id} className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                  <h3 className="font-semibold text-slate-900">
                    {city.name}
                    {city.slug === locations.defaultCitySlug ? (
                      <span className="ml-2 text-xs font-normal text-emerald-600">(default for new posts)</span>
                    ) : null}
                  </h3>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {city.barangays.map((b) => (
                      <li
                        key={b.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-2 py-1 text-sm text-slate-700 ring-1 ring-slate-200"
                      >
                        {b.name}
                        <button
                          type="button"
                          onClick={() => void deleteBarangay(b.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                    {city.barangays.length === 0 && (
                      <li className="text-sm text-slate-400">No barangays yet — add one below.</li>
                    )}
                  </ul>
                  <form
                    className="mt-4 flex flex-wrap items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const fd = new FormData(e.currentTarget)
                      const n = String(fd.get('name') ?? '').trim()
                      if (n) void addBarangay(city.id, n)
                      e.currentTarget.reset()
                    }}
                  >
                    <div className="min-w-[12rem] flex-1">
                      <label className="text-xs text-slate-500">New barangay name</label>
                      <input
                        name="name"
                        required
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="e.g. Guadalupe"
                      />
                    </div>
                    <button
                      type="submit"
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      Add to {city.name}
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          id="admin-panel-synonyms"
          role="tabpanel"
          aria-labelledby="admin-tab-synonyms"
          hidden={locationsSynonymsTab !== 'synonyms'}
          className="mt-6"
        >
          <p className="text-sm text-slate-600">
            Group alternate spellings or names for the same product or place. On the home page, the{' '}
            <strong>product filter</strong> matches product name, brand, and category against any term in a{' '}
            <strong>product</strong> group when the visitor’s search matches one of those terms. The{' '}
            <strong>area label</strong> (with location set) filters posts to establishments whose name, city, barangay, or
            address contains any term in an <strong>area</strong> group when the label matches a term. The label &quot;Current
            location&quot; is ignored for text matching. Synonyms are case-insensitive.
          </p>

          <ul className="mt-4 space-y-4">
            {state.searchSynonymGroups.map((g) => (
              <li key={g.id} className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  {g.type === 'product' ? 'Product' : 'Area'}
                </p>
                <form
                  className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const fd = new FormData(e.currentTarget)
                    const raw = String(fd.get('terms') ?? '')
                    void saveSearchSynonymGroup(g.id, raw)
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <label className="text-xs text-slate-500">Terms (comma or newline separated)</label>
                    <textarea
                      name="terms"
                      key={`${g.id}-${g.terms.join('|')}`}
                      defaultValue={g.terms.join(', ')}
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteSearchSynonymGroup(g.id)}
                    className="rounded-lg px-3 py-2 text-sm text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>

          <form
            className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-6"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const type = fd.get('synType') === 'area' ? 'area' : 'product'
              const raw = String(fd.get('synTerms') ?? '')
              void addSearchSynonymGroup(type, raw)
              e.currentTarget.reset()
            }}
          >
            <div>
              <label className="text-xs text-slate-500">New group type</label>
              <select
                name="synType"
                className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:w-auto"
              >
                <option value="product">Product (name / brand / category filter)</option>
                <option value="area">Area (establishment location text)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Terms</label>
              <textarea
                name="synTerms"
                required
                rows={3}
                placeholder="e.g. bangus, bangos, milkfish"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-fit rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Add synonym group
            </button>
          </form>
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Anonymous posting</h2>
        <p className="mt-1 text-sm text-slate-600">
          When disabled, users must be signed in and cannot hide their profile on new posts.
        </p>
        <button
          type="button"
          onClick={() => void flipAnonymous()}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {state.anonymousEnabled ? 'Disable anonymous posting' : 'Enable anonymous posting'}
        </button>
        <p className="mt-2 text-sm text-slate-500">
          Current: <strong>{state.anonymousEnabled ? 'allowed' : 'blocked'}</strong>
        </p>
      </section>

      <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Home hero carousel</h2>
        <p className="mt-1 text-sm text-slate-600">
          Banners appear <strong>above “Prices near you”</strong> on the home page, full width of the main column.
          <strong>Upload</strong> an image (JPEG, PNG, GIF, or WebP, max 5 MB) and set an optional link for each slide.
          If uploads fail with <strong>HTTP 413</strong>, nginx (or your proxy) must allow a large enough body — see{' '}
          <code className="rounded bg-slate-100 px-1 text-xs">deploy/nginx-upload-limits.conf</code>. On the server, run{' '}
          <code className="rounded bg-slate-100 px-1 text-xs">php artisan storage:link</code> once so images are publicly
          reachable. <strong>Static</strong> shows only the first active ad (by sort order).{' '}
          <strong>Rotate</strong> shows all active ads in a carousel with arrows and dots. Optional start/end dates
          apply to each ad.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void setStrategy('STATIC')}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              state.homeTopStrategy === 'STATIC' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-800'
            }`}
          >
            Static
          </button>
          <button
            type="button"
            onClick={() => void setStrategy('ROTATE')}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              state.homeTopStrategy === 'ROTATE' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-800'
            }`}
          >
            Rotate
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Strategy: <strong>{state.homeTopStrategy}</strong>
        </p>

        <h3 className="mt-8 text-sm font-semibold uppercase text-slate-500">Add carousel slide (home_top)</h3>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            void addBanner(new FormData(e.currentTarget))
            e.currentTarget.reset()
          }}
        >
          <input type="hidden" name="slotKey" value="home_top" />
          <div className="sm:col-span-2">
            <label className="text-xs text-slate-500">Image file</label>
            <input
              name="image"
              type="file"
              required
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-emerald-800 hover:file:bg-emerald-100"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Link (href)</label>
            <input name="href" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Alt text</label>
            <input name="alt" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Sort order</label>
            <input
              name="sortOrder"
              type="number"
              defaultValue={0}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Valid from (optional)</label>
            <input
              name="validFrom"
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Valid to (optional)</label>
            <input
              name="validTo"
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Add banner
            </button>
          </div>
        </form>

        <ul className="mt-8 space-y-3">
          {state.banners.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="truncate font-mono text-xs text-slate-600">
                {b.id.slice(0, 8)}… · {b.isActive ? 'on' : 'off'}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void toggleBanner(b.id, !b.isActive)}
                  className="text-xs text-emerald-700 hover:underline"
                >
                  {b.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteBanner(b.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
