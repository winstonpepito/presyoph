import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCodeLib from 'qrcode'

type Props = {
  isOpen: boolean
  onClose: () => void
  profileUrl: string
  displayName: string
}

export function ProfileQrModal({ isOpen, onClose, profileUrl, displayName }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) {
      setQrDataUrl(null)
      return
    }
    const url = profileUrl.trim()
    if (!url) {
      setQrDataUrl(null)
      return
    }
    let cancelled = false
    void QRCodeLib.toDataURL(url, {
      width: 200,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, profileUrl])

  if (!isOpen) return null

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-qr-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="profile-qr-title" className="text-lg font-semibold text-slate-900">
            Scan to open profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-600">{displayName}</p>
        <div className="mt-6 flex min-h-[200px] items-center justify-center rounded-xl bg-white p-4 ring-1 ring-slate-200">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt=""
              width={200}
              height={200}
              className="h-[200px] w-[200px] max-w-full"
            />
          ) : (
            <p className="text-sm text-slate-500">{profileUrl.trim() ? 'Generating QR…' : 'No profile link'}</p>
          )}
        </div>
        <p className="mt-4 break-all text-center text-xs text-slate-500">{profileUrl}</p>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
