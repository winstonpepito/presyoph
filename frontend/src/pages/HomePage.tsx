import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { HomeHeroCarousel } from '../components/HomeHeroCarousel'
import { LocationBar } from '../components/LocationBar'
import { PostCard } from '../components/PostCard'
import { apiFetch } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import type { PricePostView } from '../types/post'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type FollowDirectoryUser = { id: string; name: string | null; image: string | null }

/** Merged admin terms for the three home spotlight slots (from /api/v1/meta). */
type SpotlightProductTerms = { gasoline: string[]; diesel: string[]; rice: string[] }

const HOME_FEED_PAGE_SIZE = 24

function buildProductHaystack(p: PricePostView): string {
  return [p.product.name, p.product.brand ?? '', p.product.category?.name ?? ''].join(' ').toLowerCase()
}

function matchesNeedles(haystack: string, needles: string[]): boolean {
  for (const n of needles) {
    if (n.length > 0 && haystack.includes(n)) {
      return true
    }
  }
  return false
}

/** Latest matching post by createdAt (home “All” feed spotlight, first page only). */
function pickLatestMatching(posts: PricePostView[], needles: string[]): PricePostView | null {
  if (needles.length === 0) {
    return null
  }
  const candidates = posts.filter((p) => matchesNeedles(buildProductHaystack(p), needles))
  if (candidates.length === 0) {
    return null
  }
  let best = candidates[0]
  let bestTs = Date.parse(best.createdAt)
  for (let i = 1; i < candidates.length; i++) {
    const p = candidates[i]
    const ts = Date.parse(p.createdAt)
    if (ts > bestTs) {
      best = p
      bestTs = ts
    }
  }
  return best
}

function useHomeFeedDisplayPosts(
  posts: PricePostView[],
  spotlightChunk: PricePostView[] | null,
  spotlightTerms: SpotlightProductTerms | null,
  view: string,
  eligibleForSpotlight: boolean,
): { displayPosts: PricePostView[]; spotlightIds: Set<string> } {
  return useMemo(() => {
    if (
      view === 'following' ||
      !eligibleForSpotlight ||
      !spotlightChunk?.length ||
      !spotlightTerms ||
      (!spotlightTerms.gasoline.length && !spotlightTerms.diesel.length && !spotlightTerms.rice.length)
    ) {
      return { displayPosts: posts, spotlightIds: new Set<string>() }
    }
    const gas = pickLatestMatching(spotlightChunk, spotlightTerms.gasoline)
    const diesel = pickLatestMatching(spotlightChunk, spotlightTerms.diesel)
    const rice = pickLatestMatching(spotlightChunk, spotlightTerms.rice)
    const featured = [gas, diesel, rice].filter((x): x is PricePostView => x != null)
    if (featured.length === 0) {
      return { displayPosts: posts, spotlightIds: new Set<string>() }
    }
    const spotlightIds = new Set(featured.map((p) => p.id))
    const rest = posts.filter((p) => !spotlightIds.has(p.id))
    return { displayPosts: [...featured, ...rest], spotlightIds }
  }, [posts, spotlightChunk, spotlightTerms, view, eligibleForSpotlight])
}

type PostsIndexMeta = {
  offset: number
  limit: number
  total: number
  hasMore: boolean
}

function HomeFeedLoadSentinel({
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
      { root: null, rootMargin: '160px', threshold: 0 },
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
      className="col-span-full flex min-h-12 items-center justify-center py-4 text-sm text-slate-500"
      aria-live="polite"
    >
      {loading ? 'Loading more…' : '\u00a0'}
    </div>
  )
}

export function HomePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, status } = useAuth()
  const [posts, setPosts] = useState<PricePostView[]>([])
  const [postsMeta, setPostsMeta] = useState<PostsIndexMeta | null>(null)
  const [postsInitialLoading, setPostsInitialLoading] = useState(false)
  const [postsLoadingMore, setPostsLoadingMore] = useState(false)
  const [postsVersion, setPostsVersion] = useState(0)
  const [followingDirectory, setFollowingDirectory] = useState<FollowDirectoryUser[] | null>(null)
  const [spotlightChunk, setSpotlightChunk] = useState<PricePostView[] | null>(null)
  const [spotlightTerms, setSpotlightTerms] = useState<SpotlightProductTerms | null>(null)

  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  const radiusKm = searchParams.get('radiusKm') ?? '50'
  const view = searchParams.get('view') ?? 'all'
  const productQ = searchParams.get('q') ?? ''
  const areaLabelParam = searchParams.get('label') ?? ''

  /** Spotlight cards only before product or area-label filters; uses first API page only (see spotlightChunk). */
  const eligibleForSpotlight = view === 'all' && productQ.trim() === '' && areaLabelParam.trim() === ''

  const postsLoadLock = useRef(false)
  const postsRef = useRef(posts)
  useEffect(() => {
    postsRef.current = posts
  }, [posts])

  const { displayPosts, spotlightIds } = useHomeFeedDisplayPosts(
    posts,
    spotlightChunk,
    spotlightTerms,
    view,
    eligibleForSpotlight,
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const r = await apiFetch('/api/v1/meta', { skipAuth: true })
      if (!r.ok || cancelled) {
        return
      }
      const j = (await r.json()) as { spotlightProductTerms?: SpotlightProductTerms }
      const s = j.spotlightProductTerms
      if (
        s &&
        Array.isArray(s.gasoline) &&
        Array.isArray(s.diesel) &&
        Array.isArray(s.rice)
      ) {
        setSpotlightTerms(s)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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

  const buildPostsParams = useCallback(
    (offset: number) => {
      const p = new URLSearchParams()
      if (lat) p.set('lat', lat)
      if (lng) p.set('lng', lng)
      p.set('radiusKm', radiusKm)
      p.set('limit', String(HOME_FEED_PAGE_SIZE))
      p.set('offset', String(offset))
      if (view === 'following') p.set('following', '1')
      const qTrim = productQ.trim()
      if (qTrim) p.set('q', qTrim)
      const areaLabel = areaLabelParam.trim()
      if (areaLabel) p.set('label', areaLabel)
      return p
    },
    [lat, lng, radiusKm, view, productQ, areaLabelParam],
  )

  useEffect(() => {
    let cancelled = false
    setPosts([])
    setPostsMeta(null)
    setSpotlightChunk(null)
    setPostsInitialLoading(true)
    void (async () => {
      const r = await apiFetch(`/api/v1/posts?${buildPostsParams(0).toString()}`)
      const j = (await r.json()) as { posts: PricePostView[]; meta: PostsIndexMeta }
      if (cancelled) {
        return
      }
      const chunk = j.posts ?? []
      setPosts(chunk)
      setPostsMeta(j.meta ?? { offset: 0, limit: HOME_FEED_PAGE_SIZE, total: 0, hasMore: false })
      if (eligibleForSpotlight) {
        setSpotlightChunk(chunk)
      }
      setPostsInitialLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [buildPostsParams, user?.id, postsVersion, eligibleForSpotlight])

  const loadMorePosts = useCallback(async () => {
    if (!postsMeta?.hasMore || postsLoadLock.current || postsInitialLoading) {
      return
    }
    postsLoadLock.current = true
    setPostsLoadingMore(true)
    try {
      const offset = postsRef.current.length
      const r = await apiFetch(`/api/v1/posts?${buildPostsParams(offset).toString()}`)
      const j = (await r.json()) as { posts: PricePostView[]; meta: PostsIndexMeta }
      if (j.posts?.length) {
        setPosts((prev) => [...prev, ...j.posts])
      }
      if (j.meta) {
        setPostsMeta(j.meta)
      }
    } finally {
      postsLoadLock.current = false
      setPostsLoadingMore(false)
    }
  }, [postsMeta?.hasMore, postsInitialLoading, buildPostsParams])

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
                {productQ.trim() ? `, matching “${productQ.trim()}”` : ''}. Not limited to your map radius. Scroll down to
                load more when available.
              </>
            ) : (
              <>
                Sorted by <strong className="font-medium text-slate-800">lowest price first</strong>
                {lat != null && lng != null ? ' in your selected radius' : ''}
                {productQ.trim() ? `, matching “${productQ.trim()}”` : ''}. Scroll down to load more when available.
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
        {postsInitialLoading ? (
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
          <>
            {displayPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                spotlightBg={spotlightIds.has(post.id)}
                onMutate={() => setPostsVersion((v) => v + 1)}
              />
            ))}
            <HomeFeedLoadSentinel
              hasMore={Boolean(postsMeta?.hasMore)}
              loading={postsLoadingMore}
              onLoadMore={() => void loadMorePosts()}
            />
          </>
        )}
      </section>
    </div>
  )
}
