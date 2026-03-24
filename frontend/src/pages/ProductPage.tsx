import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PostCard } from '../components/PostCard'
import { apiFetch } from '../lib/api'
import type { PricePostView } from '../types/post'
import { formatPerUnit } from '../lib/formatUnit'
import { useEffect, useState } from 'react'

type ProductPayload = {
  product: {
    name: string
    brand: string | null
    slug: string
    unit: string | null
    unitQuantity: string | null
    category: { slug: string; name: string } | null
  }
  posts: PricePostView[]
}

export function ProductPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState<ProductPayload | null>(null)
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
      const r = await apiFetch(`/api/v1/products/${encodeURIComponent(slug)}?${p.toString()}`)
      if (r.status === 404) {
        if (!cancelled) setNotFound(true)
        return
      }
      const j = (await r.json()) as ProductPayload
      if (!cancelled) {
        setData(j)
        setNotFound(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, lat, lng, radiusKm])

  if (!slug) return null
  if (notFound) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-600">Product not found.</div>
    )
  }
  if (!data) {
    return <div className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-500">Loading…</div>
  }

  const latN = lat != null && lat !== '' ? Number(lat) : undefined
  const lngN = lng != null && lng !== '' ? Number(lng) : undefined

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {data.product.category ? (
        <p className="text-sm text-slate-500">
          <Link to={`/categories/${data.product.category.slug}`} className="hover:underline">
            {data.product.category.name}
          </Link>
        </p>
      ) : (
        <p className="text-sm text-slate-400">Uncategorized</p>
      )}
      <h1 className="mt-1 text-3xl font-bold text-slate-900">{data.product.name}</h1>
      {data.product.brand ? (
        <p className="mt-1 text-lg font-medium text-slate-700">{data.product.brand}</p>
      ) : null}
      {formatPerUnit(data.product.unit, data.product.unitQuantity) ? (
        <p className="mt-1 text-sm font-medium text-slate-600">
          {formatPerUnit(data.product.unit, data.product.unitQuantity)}
        </p>
      ) : null}
      <p className="mt-2 text-slate-600">
        Best reported prices (lowest first)
        {latN != null && lngN != null && !Number.isNaN(latN) && !Number.isNaN(lngN)
          ? ` within ~${radiusKm} km`
          : ' (all areas)'}
        . Add <code className="rounded bg-slate-200 px-1 text-xs">?lat=&lng=</code> to narrow by location.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          to="/post"
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Post price for this product
        </Link>
        <Link
          to="/search"
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
        >
          Search
        </Link>
      </div>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.posts.length === 0 ? (
          <p className="col-span-full text-slate-500">No prices yet.</p>
        ) : (
          data.posts.map((post, i) => <PostCard key={post.id} post={post} showRank={i + 1} />)
        )}
      </section>
    </div>
  )
}
