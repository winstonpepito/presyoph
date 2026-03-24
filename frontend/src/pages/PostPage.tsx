import { Link, useSearchParams } from 'react-router-dom'
import { PostPriceForm } from '../components/PostPriceForm'
import { apiFetch } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import type { LocationsPayload } from '../types/locations'

export function PostPage() {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [categories, setCategories] = useState<{ id: string; name: string }[] | null>(null)
  const [locations, setLocations] = useState<LocationsPayload | null>(null)
  const [productUnits, setProductUnits] = useState<{ code: string; label: string }[]>([])
  const [anonymousAllowed, setAnonymousAllowed] = useState(true)
  const [prefillLat, setPrefillLat] = useState<string | undefined>()
  const [prefillLng, setPrefillLng] = useState<string | undefined>()
  const [geoCitySlug, setGeoCitySlug] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [catR, metaR, locR] = await Promise.all([
        apiFetch('/api/v1/categories'),
        apiFetch('/api/v1/meta'),
        apiFetch('/api/v1/locations', { skipAuth: true }),
      ])
      const catJ = (await catR.json()) as { categories: { id: string; name: string }[] }
      const metaJ = (await metaR.json()) as {
        anonymousPostingEnabled?: boolean
        productUnits?: { code: string; label: string }[]
      }
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
        if (typeof metaJ.anonymousPostingEnabled === 'boolean') {
          setAnonymousAllowed(metaJ.anonymousPostingEnabled)
        }
        setLocations(locPayload)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const urlLat = searchParams.get('lat')
    const urlLng = searchParams.get('lng')
    if (urlLat && urlLng) {
      setPrefillLat(urlLat)
      setPrefillLng(urlLng)
      void resolveCityFromCoords(Number(urlLat), Number(urlLng))
      return
    }

    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = String(pos.coords.latitude)
        const ln = String(pos.coords.longitude)
        setPrefillLat(la)
        setPrefillLng(ln)
        void resolveCityFromCoords(pos.coords.latitude, pos.coords.longitude)
      },
      () => {
        /* user denied or unavailable — keep manual entry */
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    )
  }, [searchParams])

  async function resolveCityFromCoords(latitude: number, longitude: number) {
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return
    try {
      const r = await apiFetch('/api/v1/geo/resolve-city', {
        method: 'POST',
        body: JSON.stringify({ latitude, longitude }),
        skipAuth: true,
      })
      if (!r.ok) return
      const j = (await r.json()) as { matched?: boolean; citySlug?: string }
      if (j.matched && j.citySlug) setGeoCitySlug(j.citySlug)
    } catch {
      /* ignore */
    }
  }

  if (categories === null || locations === null) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-slate-600">Loading…</p>
      </div>
    )
  }

  if (locations.cities.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-slate-600">No cities configured. Run the Cebu cities seeder (php artisan db:seed --class=CebuCitiesSeeder).</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Post a price</h1>
      <p className="mt-2 text-sm text-slate-600">Share an exact price or a range, and where you saw it.</p>
      {!anonymousAllowed && !user && (
        <p className="mt-4 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700">
          Anonymous posting is off.{' '}
          <Link to="/auth/signin" className="font-semibold text-emerald-700 underline">
            Sign in
          </Link>{' '}
          to post.
        </p>
      )}
      {!anonymousAllowed && user && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Anonymous posting is off — new posts will show your profile.
        </p>
      )}
      <div className="mt-8">
        <PostPriceForm
          categories={categories}
          productUnits={
            productUnits.length > 0
              ? productUnits
              : [{ code: 'pcs', label: 'Piece(s) / each' }]
          }
          locations={locations}
          anonymousAllowed={anonymousAllowed}
          isSignedIn={!!user?.id}
          prefillLat={prefillLat}
          prefillLng={prefillLng}
          geoDetectedCitySlug={geoCitySlug}
        />
      </div>
    </div>
  )
}
