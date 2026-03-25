import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PostCard } from '../components/PostCard'
import { apiFetch } from '../lib/api'
import type { PricePostView } from '../types/post'
import { formatUnitSummary } from '../lib/formatUnit'
import { useEffect, useState } from 'react'

type CategoryPayload = {
  category: { id: string; name: string; slug: string }
  products: {
    id: string
    name: string
    brand: string | null
    slug: string
    unit: string | null
    unitQuantity: string | null
  }[]
  posts: PricePostView[]
}

export function CategoryPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState<CategoryPayload | null>(null)
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
      const r = await apiFetch(`/api/v1/categories/${encodeURIComponent(slug)}?${p.toString()}`)
      if (r.status === 404) {
        if (!cancelled) setNotFound(true)
        return
      }
      const j = (await r.json()) as CategoryPayload
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
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-600">Category not found.</div>
    )
  }
  if (!data) {
    return <div className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-500">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900">{data.category.name}</h1>
      <p className="mt-2 text-slate-600">Best prices across products in this category.</p>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Products</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {data.products.map((p) => (
            <li key={p.id}>
              <Link
                to={`/products/${p.slug}`}
                className="inline-block rounded-lg bg-white px-3 py-1 text-sm text-emerald-700 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                {p.name}
                {p.brand ? <span className="text-slate-500"> · {p.brand}</span> : null}
                {formatUnitSummary(p.unit, p.unitQuantity) ? (
                  <span className="ml-1 text-slate-500">({formatUnitSummary(p.unit, p.unitQuantity)})</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <h2 className="mt-10 text-lg font-semibold text-slate-900">Lowest prices (all products)</h2>
      <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.posts.length === 0 ? (
          <p className="col-span-full text-slate-500">No prices in this category yet.</p>
        ) : (
          data.posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              showRank={i + 1}
              onMutate={() => setPostsVersion((v) => v + 1)}
            />
          ))
        )}
      </section>
    </div>
  )
}
