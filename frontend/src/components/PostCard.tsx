import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EditPricePostModal } from './EditPricePostModal'
import { PostLocationMapModal } from './PostLocationMapModal'
import { apiFetch } from '../lib/api'
import { hasUsableMapCoords } from '../lib/openStreetMapEmbed'
import type { PricePostView } from '../types/post'
import { formatEstablishmentAddress } from '../lib/formatEstablishmentAddress'
import { formatPerUnit } from '../lib/formatUnit'
import { formatPrice } from '../lib/pricing'

function priceLabel(p: PricePostView): string {
  if (p.priceExact != null) {
    return formatPrice(Number(p.priceExact))
  }
  if (p.priceMin != null && p.priceMax != null) {
    return `${formatPrice(Number(p.priceMin))} – ${formatPrice(Number(p.priceMax))}`
  }
  return '—'
}

export function PostCard({
  post,
  showRank,
  onMutate,
}: {
  post: PricePostView
  showRank?: number
  onMutate?: () => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [delPending, setDelPending] = useState(false)
  const canEdit = post.canEdit ?? false
  const canDelete = post.canDelete ?? false
  const perUnit = formatPerUnit(post.unit, post.unitQuantity)
  const establishmentAddr = formatEstablishmentAddress(post.establishment)
  const showMapBtn = hasUsableMapCoords(post.latitude, post.longitude)

  async function handleDelete() {
    if (!confirm('Delete this price post permanently?')) return
    setDelPending(true)
    try {
      const r = await apiFetch(`/api/v1/posts/${post.id}`, { method: 'DELETE' })
      if (r.ok) onMutate?.()
      else alert('Could not delete this post.')
    } finally {
      setDelPending(false)
    }
  }

  return (
    <>
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {showRank != null && (
            <span className="text-xs font-semibold text-emerald-600">#{showRank}</span>
          )}
          <h3 className="font-semibold text-slate-900">
            <Link to={`/products/${post.product.slug}`} className="hover:underline">
              {post.product.name}
            </Link>
          </h3>
          {post.product.brand ? (
            <p className="text-sm font-medium text-slate-600">{post.product.brand}</p>
          ) : null}
          <p className="text-sm text-slate-500">
            {post.product.category ? (
              <Link to={`/categories/${post.product.category.slug}`} className="hover:underline">
                {post.product.category.name}
              </Link>
            ) : (
              <span className="text-slate-400">Uncategorized</span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          {showMapBtn ? (
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-emerald-600"
              aria-label="View price location on map"
              title="Map"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path
                  d="M12 21s7-4.35 7-10a7 7 0 1 0-14 0c0 5.65 7 10 7 10z"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="11" r="2.5" />
              </svg>
            </button>
          ) : null}
          <p className="text-lg font-bold text-emerald-700">{priceLabel(post)}</p>
          {perUnit ? <p className="text-xs font-medium text-slate-500">{perUnit}</p> : null}
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        at{' '}
        <Link
          to={`/establishments/${post.establishment.slug}`}
          className="font-medium text-slate-800 hover:underline"
        >
          {post.establishment.name}
        </Link>
      </p>
      {establishmentAddr ? <p className="text-xs text-slate-500">{establishmentAddr}</p> : null}
      {post.locationLabel && <p className="text-xs text-slate-400">{post.locationLabel}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-400">
        <span>{new Date(post.createdAt).toLocaleString()}</span>
        <div className="flex flex-wrap items-center gap-2">
          {post.anonymous ? (
            <span>Anonymous</span>
          ) : post.user ? (
            <Link to={`/profile/${post.user.id}`} className="hover:underline">
              {post.user.name ?? 'User'}
            </Link>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="font-medium text-emerald-600 hover:underline"
            >
              Edit
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              disabled={delPending}
              onClick={() => void handleDelete()}
              className="font-medium text-red-600 hover:underline disabled:opacity-50"
            >
              {delPending ? 'Deleting…' : 'Delete'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
    {mapOpen ? (
      <PostLocationMapModal
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        latitude={post.latitude}
        longitude={post.longitude}
        title={post.establishment.name}
      />
    ) : null}
    {editOpen ? (
      <EditPricePostModal
        post={post}
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => onMutate?.()}
      />
    ) : null}
    </>
  )
}
