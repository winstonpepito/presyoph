import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { HomeHeroCarousel } from '../components/HomeHeroCarousel'
import { LocationBar } from '../components/LocationBar'
import { PostCard } from '../components/PostCard'
import { apiFetch } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import type { PricePostView } from '../types/post'
import { useEffect, useState } from 'react'

type FollowDirectoryUser = { id: string; name: string | null; image: string | null }

export function HomePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, status } = useAuth()
  const [posts, setPosts] = useState<PricePostView[] | null>(null)
  const [postsVersion, setPostsVersion] = useState(0)
  const [followingDirectory, setFollowingDirectory] = useState<FollowDirectoryUser[] | null>(null)

  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  const radiusKm = searchParams.get('radiusKm') ?? '50'
  const view = searchParams.get('view') ?? 'all'
  const productQ = searchParams.get('q') ?? ''

  const locParams = new URLSearchParams()
  if (lat) locParams.set('lat', lat)
  if (lng) locParams.set('lng', lng)
  if (searchParams.get('radiusKm')) locParams.set('radiusKm', searchParams.get('radiusKm')!)
  if (searchParams.get('label')) locParams.set('label', searchParams.get('label')!)
  if (productQ.trim()) locParams.set('q', productQ.trim())
  const locQs = locParams.toString()
  const allHref = locQs ? `/?${locQs}` : '/'
  const followParams = new URLSearchParams(locParams)
  followParams.set('view', 'following')
  const followingHref = `/?${followParams.toString()}`

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const p = new URLSearchParams()
      if (lat) p.set('lat', lat)
      if (lng) p.set('lng', lng)
      p.set('radiusKm', radiusKm)
      p.set('limit', '24')
      if (view === 'following') p.set('following', '1')
      const qTrim = productQ.trim()
      if (qTrim) p.set('q', qTrim)
      const r = await apiFetch(`/api/v1/posts?${p.toString()}`)
      const j = (await r.json()) as { posts: PricePostView[] }
      if (!cancelled) setPosts(j.posts ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [lat, lng, radiusKm, view, user?.id, productQ, postsVersion])

  useEffect(() => {
    if (view !== 'following' || !user?.id) {
      setFollowingDirectory(null)
      return
    }
    let cancelled = false
    void (async () => {
      const r = await apiFetch('/api/v1/following')
      if (cancelled) return
      if (!r.ok) {
        setFollowingDirectory([])
        return
      }
      const j = (await r.json()) as { users?: FollowDirectoryUser[] }
      setFollowingDirectory(j.users ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [view, user?.id])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <HomeHeroCarousel slot="home_top" />
      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {view === 'following' ? 'People you follow' : 'Prices near you'}
          </h1>
          <p className="mt-1 text-slate-600">
            {view === 'following' ? (
              <>
                Recent price posts from accounts you follow, <strong className="font-medium text-slate-800">newest first</strong>
                {productQ.trim() ? `, matching “${productQ.trim()}”` : ''}. Not limited to your map radius.
              </>
            ) : (
              <>
                Sorted by <strong className="font-medium text-slate-800">lowest price first</strong>
                {lat != null && lng != null ? ' in your selected radius' : ''}
                {productQ.trim() ? `, matching “${productQ.trim()}”` : ''}.
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={allHref}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              view !== 'following' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'
            }`}
          >
            All
          </Link>
          <Link
            to={followingHref}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              view === 'following' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'
            }`}
          >
            Following
          </Link>
        </div>
      </div>

      {view === 'following' && status !== 'loading' && !user?.id && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Link to="/auth/signin" className="font-semibold underline">
            Sign in
          </Link>{' '}
          or{' '}
          <Link to="/auth/register" className="font-semibold underline">
            register
          </Link>{' '}
          to follow people and see their posts here. Open someone’s profile from a price post and tap{' '}
          <strong>Follow</strong>.
        </p>
      )}

      {view === 'following' && user?.id && followingDirectory && followingDirectory.length > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Profiles you follow</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {followingDirectory.map((u) => (
              <Link
                key={u.id}
                to={`/profile/${u.id}`}
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-3 text-sm font-medium text-slate-800 hover:border-emerald-300 hover:bg-emerald-50"
              >
                {u.image ? (
                  <img src={u.image} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-600">
                    {(u.name ?? '?').slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="truncate">{u.name ?? 'Member'}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <form
        className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          const raw = String(fd.get('productQ') ?? '').trim()
          const p = new URLSearchParams(searchParams)
          if (raw) p.set('q', raw)
          else p.delete('q')
          navigate({ search: p.toString() }, { replace: true })
        }}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="home-product-q" className="text-xs font-medium text-slate-500">
            Filter by product, brand, or category
          </label>
          <input
            id="home-product-q"
            name="productQ"
            key={productQ}
            defaultValue={productQ}
            placeholder="Product, brand, or category…"
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            autoComplete="off"
          />
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Apply
          </button>
          {productQ.trim() ? (
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => {
                const p = new URLSearchParams(searchParams)
                p.delete('q')
                navigate({ search: p.toString() }, { replace: true })
              }}
            >
              Clear filter
            </button>
          ) : null}
        </div>
      </form>

      <div className="mt-4">
        <LocationBar />
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts === null ? (
          <p className="col-span-full text-center text-slate-500">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">
            {productQ.trim() ? (
              <>
                No posts match <strong className="text-slate-700">“{productQ.trim()}”</strong> for this view. Try another
                keyword or{' '}
                <button
                  type="button"
                  className="font-medium text-emerald-600 hover:underline"
                  onClick={() => {
                    const p = new URLSearchParams(searchParams)
                    p.delete('q')
                    navigate({ search: p.toString() }, { replace: true })
                  }}
                >
                  clear the filter
                </button>
                .
              </>
            ) : view === 'following' && user?.id && followingDirectory?.length === 0 ? (
              <>
                You are not following anyone yet. Browse <Link to={allHref} className="font-medium text-emerald-600 hover:underline">all posts</Link>, open a
                member’s profile, and tap <strong className="text-slate-700">Follow</strong> to see their updates here.
              </>
            ) : view === 'following' && user?.id && (followingDirectory?.length ?? 0) > 0 ? (
              <>
                No recent posts from people you follow{productQ.trim() ? ' for this filter' : ''}. Check back later or browse{' '}
                <Link to={allHref} className="font-medium text-emerald-600 hover:underline">all posts</Link>.
              </>
            ) : (
              <>
                No posts yet for this view.{' '}
                <Link to="/post" className="font-medium text-emerald-600 hover:underline">
                  Post a price
                </Link>
                .
              </>
            )}
          </p>
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} post={post} onMutate={() => setPostsVersion((v) => v + 1)} />
          ))
        )}
      </section>
    </div>
  )
}
