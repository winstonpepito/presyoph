import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export function FollowButton({
  targetUserId,
  initialFollowing,
  isSelf,
}: {
  targetUserId: string
  initialFollowing: boolean
  isSelf: boolean
}) {
  const [following, setFollowing] = useState(initialFollowing)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setFollowing(initialFollowing)
  }, [initialFollowing])

  if (isSelf) return null

  async function toggle() {
    setPending(true)
    try {
      if (following) {
        const r = await apiFetch(`/api/v1/follow/${targetUserId}`, { method: 'DELETE' })
        if (r.ok) setFollowing(false)
      } else {
        const r = await apiFetch(`/api/v1/follow/${targetUserId}`, { method: 'POST' })
        const j = (await r.json()) as { error?: string }
        if (!r.ok) {
          alert(j.error ?? 'Could not follow')
        } else {
          setFollowing(true)
        }
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void toggle()}
      className={`rounded-xl px-4 py-2 text-sm font-semibold ${
        following
          ? 'border border-slate-300 text-slate-700 hover:bg-slate-50'
          : 'bg-emerald-600 text-white hover:bg-emerald-700'
      } disabled:opacity-60`}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
