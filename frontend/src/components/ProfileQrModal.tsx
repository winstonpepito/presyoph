import { useEffect } from 'react'
import QRCode from 'react-qr-code'

type Props = {
  isOpen: boolean
  onClose: () => void
  profileUrl: string
  displayName: string
}

export function ProfileQrModal({ isOpen, onClose, profileUrl, displayName }: Props) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
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
        <div className="mt-6 flex justify-center rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <QRCode
            value={profileUrl}
            size={200}
            level="M"
            className="h-auto max-w-full"
          />
        </div>
        <p className="mt-4 break-all text-center text-xs text-slate-500">{profileUrl}</p>
      </div>
    </div>
  )
}
