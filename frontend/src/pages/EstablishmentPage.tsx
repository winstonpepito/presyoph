import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PostCard } from '../components/PostCard'
import { apiFetch } from '../lib/api'
import { formatEstablishmentAddress } from '../lib/formatEstablishmentAddress'
import type { PricePostView } from '../types/post'
import { useEffect, useState } from 'react'

type EstPayload = {
  establishment: {
    id: string
    name: string
    slug: string
    addressLine: string | null
    barangay: string | null
    city: string | null
  }
  posts: PricePostView[]
}

export function EstablishmentPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState<EstPayload | null>(null)
  const [postsVersion, setPostsVersion] = useState(0)
  const [notFound, setNotFound] = useState(false)

  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  const radiusKm = searchParams.get('radiusKm') ?? '100'

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    void (async () => {
      const p = new URLSearchParams()
      if (lat) p.set('lat', lat)
      if (lng) p.set('lng', lng)
      p.set('radiusKm', radiusKm)
      const r = await apiFetch(`/api/v1/establishments/${encodeURIComponent(slug)}?${p.toString()}`)
      if (r.status === 404) {
        if (!cancelled) setNotFound(true)
        return
      }
      const j = (await r.json()) as EstPayload
      if (!cancelled) {
        setData(j)
        setNotFound(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, lat, lng, radiusKm, postsVersion])

  if (!slug) return null
  if (notFound) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-600">Establishment not found.</div>
    )
  }
  if (!data) {
    return <div className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-500">Loading…</div>
  }

  const establishmentAddressText = formatEstablishmentAddress(data.establishment)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900">{data.establishment.name}</h1>
      {establishmentAddressText ? (
        <p className="mt-1 text-slate-600">{establishmentAddressText}</p>
      ) : null}
      <p className="mt-4 text-sm text-slate-500">Recent prices reported at this establishment.</p>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.posts.length === 0 ? (
          <p className="col-span-full text-slate-500">No posts for this store yet.</p>
        ) : (
          data.posts.map((post) => (
            <PostCard key={post.id} post={post} onMutate={() => setPostsVersion((v) => v + 1)} />
          ))
        )}
      </section>
      <p className="mt-8">
        <Link to="/post" className="text-sm font-medium text-emerald-600 hover:underline">
          Post another price →
        </Link>
      </p>
    </div>
  )
}
