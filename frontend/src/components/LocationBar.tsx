import { useCallback, useMemo, useState, useTransition } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export function LocationBar() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [label, setLabel] = useState(searchParams.get('label') ?? '')

  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  const radiusKm = searchParams.get('radiusKm') ?? '50'

  const spString = useMemo(() => searchParams.toString(), [searchParams])

  const applyCoords = useCallback(
    (latitude: number, longitude: number, lbl?: string) => {
      const p = new URLSearchParams(spString)
      p.set('lat', String(latitude))
      p.set('lng', String(longitude))
      if (lbl) p.set('label', lbl)
      startTransition(() => {
        navigate({ search: p.toString() }, { replace: true })
      })
    },
    [navigate, spString],
  )

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not available in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyCoords(pos.coords.latitude, pos.coords.longitude, 'Current location')
        setLabel('Current location')
      },
      () => alert('Could not read your location. Check browser permissions.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  const clearLocation = () => {
    const p = new URLSearchParams(spString)
    p.delete('lat')
    p.delete('lng')
    p.delete('label')
    setLabel('')
    startTransition(() => navigate({ search: p.toString() }, { replace: true }))
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-0 flex-1">
        <label className="text-xs font-medium text-slate-500">Area label</label>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Optional. With a map pin set, narrows the feed to stores/locations whose text matches this label (and admin
          synonyms).
        </p>
        <input
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="e.g. Carbon"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => {
            if (!lat || !lng) return
            const p = new URLSearchParams(spString)
            if (label) p.set('label', label)
            else p.delete('label')
            navigate({ search: p.toString() }, { replace: true })
          }}
        />
      </div>
      <div className="w-full sm:w-28">
        <label className="text-xs font-medium text-slate-500">Radius (km)</label>
        <select
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={radiusKm}
          onChange={(e) => {
            const p = new URLSearchParams(spString)
            p.set('radiusKm', e.target.value)
            startTransition(() => navigate({ search: p.toString() }, { replace: true }))
          }}
        >
          {[10, 25, 50, 100, 200].map((n) => (
            <option key={n} value={n}>
              {n} km
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={pending}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          Use my location
        </button>
        <button
          type="button"
          onClick={clearLocation}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Clear
        </button>
      </div>
      {lat && lng && (
        <p className="w-full text-xs text-slate-500">
          Active: {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
          {searchParams.get('label') ? ` · ${searchParams.get('label')}` : ''}
        </p>
      )}
    </div>
  )
}
