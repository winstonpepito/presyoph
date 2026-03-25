import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EditPricePostModal } from './EditPricePostModal'
import { apiFetch } from '../lib/api'
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
  const [delPending, setDelPending] = useState(false)
  const canEdit = post.canEdit ?? false
  const canDelete = post.canDelete ?? false
  const perUnit = formatPerUnit(post.unit, post.unitQuantity)
  const establishmentAddr = formatEstablishmentAddress(post.establishment)

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
        <div className="text-right">
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
