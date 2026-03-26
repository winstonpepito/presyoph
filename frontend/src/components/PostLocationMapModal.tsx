import { useEffect } from 'react'
import { openStreetMapEmbedUrl, openStreetMapViewUrl } from '../lib/openStreetMapEmbed'

export function PostLocationMapModal({
  open,
  onClose,
  latitude,
  longitude,
  title,
}: {
  open: boolean
  onClose: () => void
  latitude: number
  longitude: number
  title?: string
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const embedSrc = openStreetMapEmbedUrl(latitude, longitude)
  const externalHref = openStreetMapViewUrl(latitude, longitude)

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-map-modal-title"
        className="flex max-h-[min(90vh,640px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h2 id="post-map-modal-title" className="text-sm font-semibold text-slate-900">
            {title ?? 'Price location'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close map"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="min-h-[280px] flex-1 bg-slate-100">
          <iframe
            title="OpenStreetMap"
            src={embedSrc}
            className="h-[min(55vh,420px)] w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <span className="font-mono">
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </span>
          <a
            href={externalHref}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-emerald-600 hover:underline"
          >
            Open in OpenStreetMap
          </a>
        </div>
      </div>
    </div>
  )
}
