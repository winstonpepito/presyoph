import { Link, useParams } from 'react-router-dom'
import { FollowButton } from '../components/FollowButton'
import { ProfileMemberSearch } from '../components/ProfileMemberSearch'
import { ProfileQrModal } from '../components/ProfileQrModal'
import { PostCard } from '../components/PostCard'
import { useAuth, type SessionUser } from '../context/AuthContext'
import { apiFetch } from '../lib/api'
import type { PricePostView } from '../types/post'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const PROFILE_POSTS_PAGE_SIZE = 24

type ProfilePostsMeta = {
  offset: number
  limit: number
  total: number
  hasMore: boolean
}

type ProfilePayload = {
  user: { id: string; name: string | null; image: string | null; externalImageUrl?: string | null }
  followerCount: number
  followingCount: number
  isFollowing: boolean
  isSelf: boolean
  posts: PricePostView[]
  postsMeta?: ProfilePostsMeta
}

function ProfilePostsLoadSentinel({
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

export function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { user: sessionUser, refresh } = useAuth()
  const [data, setData] = useState<ProfilePayload | null>(null)
  const [postsVersion, setPostsVersion] = useState(0)
  const [notFound, setNotFound] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    externalImageUrl: '',
    avatarFile: null as File | null,
    removeAvatar: false,
    current_password: '',
    password: '',
    password_confirmation: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const initialExternalUrlRef = useRef('')
  const [avatarInputKey, setAvatarInputKey] = useState(0)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [qrOpen, setQrOpen] = useState(false)
  const [postsLoadingMore, setPostsLoadingMore] = useState(false)
  const postsLoadLock = useRef(false)
  const postsRef = useRef<PricePostView[]>([])
  useEffect(() => {
    postsRef.current = data?.posts ?? []
  }, [data?.posts])

  const profileQrUrl = useMemo(() => {
    if (!id) return ''
    const base = import.meta.env.BASE_URL
    const prefix = base === '/' ? '' : base.replace(/\/$/, '')
    return `${window.location.origin}${prefix}/profile/${encodeURIComponent(id)}`
  }, [id])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!id) return
      setNotFound(false)
      setData(null)
      const qs = new URLSearchParams({
        postsOffset: '0',
        postsLimit: String(PROFILE_POSTS_PAGE_SIZE),
      })
      const r = await apiFetch(`/api/v1/users/${encodeURIComponent(id)}/profile?${qs.toString()}`)
      if (cancelled) return
      if (r.status === 404) {
        setNotFound(true)
        return
      }
      const j = (await r.json()) as ProfilePayload
      setData(j)
    })()
    return () => {
      cancelled = true
    }
  }, [id, postsVersion])

  const loadMorePosts = useCallback(async () => {
    if (!id || !data?.postsMeta?.hasMore || postsLoadLock.current || postsLoadingMore) {
      return
    }
    postsLoadLock.current = true
    setPostsLoadingMore(true)
    try {
      const offset = postsRef.current.length
      const qs = new URLSearchParams({
        postsOffset: String(offset),
        postsLimit: String(PROFILE_POSTS_PAGE_SIZE),
      })
      const r = await apiFetch(`/api/v1/users/${encodeURIComponent(id)}/profile?${qs.toString()}`)
      if (!r.ok) {
        return
      }
      const j = (await r.json()) as ProfilePayload
      setData((prev) => {
        if (!prev) {
          return prev
        }
        return {
          ...prev,
          posts: [...prev.posts, ...(j.posts ?? [])],
          postsMeta: j.postsMeta ?? prev.postsMeta,
        }
      })
    } finally {
      postsLoadLock.current = false
      setPostsLoadingMore(false)
    }
  }, [id, data?.postsMeta?.hasMore, postsLoadingMore])

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreviewUrl)
      }
    }
  }, [avatarPreviewUrl])

  const openEdit = () => {
    if (!data || !sessionUser) return
    initialExternalUrlRef.current = data.user.externalImageUrl ?? ''
    setAvatarInputKey((k) => k + 1)
    setAvatarPreviewUrl(null)
    setForm({
      name: data.user.name ?? '',
      email: sessionUser.email ?? '',
      externalImageUrl: data.user.externalImageUrl ?? '',
      avatarFile: null,
      removeAvatar: false,
      current_password: '',
      password: '',
      password_confirmation: '',
    })
    setErrors({})
    setEditing(true)
  }

  const closeEdit = () => {
    if (avatarPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreviewUrl)
    }
    setAvatarPreviewUrl(null)
    setEditing(false)
    setErrors({})
  }

  async function submitProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!data?.isSelf) return
    setSaving(true)
    setErrors({})
    const fd = new FormData()
    fd.append('name', form.name.trim())
    fd.append('email', form.email.trim())
    if (form.removeAvatar) {
      fd.append('remove_avatar', '1')
    }
    if (form.avatarFile) {
      fd.append('avatar', form.avatarFile)
    }
    if (form.externalImageUrl.trim() !== initialExternalUrlRef.current.trim()) {
      fd.append('external_image_url', form.externalImageUrl.trim())
    }
    if (form.password) {
      fd.append('current_password', form.current_password)
      fd.append('password', form.password)
      fd.append('password_confirmation', form.password_confirmation)
    }
    const r = await apiFetch('/api/auth/profile', { method: 'PATCH', body: fd })
    setSaving(false)
    if (r.status === 422) {
      const j = (await r.json()) as { errors?: Record<string, string[]> }
      const next: Record<string, string> = {}
      if (j.errors) {
        for (const [k, arr] of Object.entries(j.errors)) {
          next[k] = Array.isArray(arr) ? (arr[0] ?? '') : String(arr)
        }
      }
      setErrors(next)
      return
    }
    if (!r.ok) {
      setErrors({ _form: 'Could not save profile. Try again.' })
      return
    }
    const updated = (await r.json()) as SessionUser
    await refresh()
    if (avatarPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreviewUrl)
    }
    setAvatarPreviewUrl(null)
    setData((prev) =>
      prev
        ? {
            ...prev,
            user: {
              ...prev.user,
              id: updated.id,
              name: updated.name,
              image: updated.image,
              externalImageUrl: updated.externalImageUrl ?? null,
            },
          }
        : null,
    )
    setEditing(false)
  }

  if (!id) return null
  if (notFound) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-600">
        User not found.
      </div>
    )
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-500">
        Loading…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {sessionUser ? (
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <ProfileMemberSearch />
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {data.user.image ? (
            <img
              src={data.user.image}
              alt=""
              className="h-16 w-16 shrink-0 rounded-full border border-slate-200 bg-slate-100 object-cover"
            />
          ) : null}
          <div>
          <h1 className="text-3xl font-bold text-slate-900">{data.user.name ?? 'Member'}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {data.followerCount} followers · {data.followingCount} following
          </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.isSelf ? (
            <button
              type="button"
              onClick={() => (editing ? closeEdit() : openEdit())}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
            >
              {editing ? 'Cancel' : 'Edit profile'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Show QR
          </button>
          <FollowButton
            targetUserId={data.user.id}
            initialFollowing={data.isFollowing}
            isSelf={data.isSelf}
          />
        </div>
      </div>

      {!data.isSelf ? (
        <p className="mt-3 max-w-2xl text-sm text-slate-600">
          {sessionUser ? (
            <>
              Follow them to see new price posts in the{' '}
              <Link to="/?view=following" className="font-medium text-emerald-700 hover:underline">
                Following
              </Link>{' '}
              tab on the home page. Their profile stays public for everyone.
            </>
          ) : (
            <>
              <Link to="/auth/signin" className="font-medium text-emerald-700 hover:underline">
                Sign in
              </Link>{' '}
              or{' '}
              <Link to="/auth/register" className="font-medium text-emerald-700 hover:underline">
                register
              </Link>{' '}
              to follow this member and track their posts on your home feed.
            </>
          )}
        </p>
      ) : null}

      {data.isSelf && editing ? (
        <form
          onSubmit={(e) => void submitProfile(e)}
          className="mt-8 max-w-xl rounded-2xl border border-slate-200 bg-slate-50/80 p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-slate-900">Edit your profile</h2>
          <p className="mt-1 text-sm text-slate-500">Update how you appear on posts and your account email.</p>
          {errors._form ? <p className="mt-3 text-sm text-red-600">{errors._form}</p> : null}
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Display name
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none ring-emerald-500/0 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              autoComplete="name"
              required
            />
            {errors.name ? <span className="mt-1 block text-xs text-red-600">{errors.name}</span> : null}
          </label>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none ring-emerald-500/0 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              autoComplete="email"
              required
            />
            {errors.email ? <span className="mt-1 block text-xs text-red-600">{errors.email}</span> : null}
          </label>
          <div className="mt-4">
            <span className="block text-sm font-medium text-slate-700">Profile photo</span>
            <div className="mt-2 flex flex-wrap items-end gap-4">
              {form.removeAvatar ? (
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white text-xs text-slate-400">
                  No photo
                </div>
              ) : avatarPreviewUrl || data.user.image ? (
                <img
                  src={avatarPreviewUrl || data.user.image || ''}
                  alt=""
                  className="h-20 w-20 rounded-full border border-slate-200 bg-white object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white text-xs text-slate-400">
                  No photo
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <input
                  key={avatarInputKey}
                  type="file"
                  name="avatar"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="block w-full max-w-xs text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-700"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    setForm((f) => ({ ...f, avatarFile: file, removeAvatar: false }))
                    if (avatarPreviewUrl?.startsWith('blob:')) {
                      URL.revokeObjectURL(avatarPreviewUrl)
                    }
                    if (file) {
                      setAvatarPreviewUrl(URL.createObjectURL(file))
                    } else {
                      setAvatarPreviewUrl(null)
                    }
                  }}
                />
                {errors.avatar ? <span className="text-xs text-red-600">{errors.avatar}</span> : null}
                {(data.user.image || data.user.externalImageUrl) && (
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={form.removeAvatar}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setForm((f) => ({
                          ...f,
                          removeAvatar: checked,
                          avatarFile: checked ? null : f.avatarFile,
                        }))
                        if (checked) {
                          if (avatarPreviewUrl?.startsWith('blob:')) {
                            URL.revokeObjectURL(avatarPreviewUrl)
                          }
                          setAvatarPreviewUrl(null)
                          setAvatarInputKey((k) => k + 1)
                        }
                      }}
                    />
                    Remove photo
                  </label>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">JPEG, PNG, GIF, or WebP · max 2 MB</p>
          </div>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Or use an image URL <span className="font-normal text-slate-400">(optional)</span>
            <input
              type="url"
              name="external_image_url"
              value={form.externalImageUrl}
              onChange={(e) => setForm((f) => ({ ...f, externalImageUrl: e.target.value }))}
              placeholder="https://…"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none ring-emerald-500/0 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
            {errors.external_image_url ? (
              <span className="mt-1 block text-xs text-red-600">{errors.external_image_url}</span>
            ) : null}
          </label>
          <div className="mt-6 border-t border-slate-200 pt-6">
            <h3 className="text-sm font-semibold text-slate-800">Change password</h3>
            <p className="mt-0.5 text-xs text-slate-500">Leave blank to keep your current password.</p>
            <label className="mt-3 block text-sm font-medium text-slate-700">
              Current password
              <input
                type="password"
                name="current_password"
                value={form.current_password}
                onChange={(e) => setForm((f) => ({ ...f, current_password: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none ring-emerald-500/0 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                autoComplete="current-password"
              />
              {errors.current_password ? (
                <span className="mt-1 block text-xs text-red-600">{errors.current_password}</span>
              ) : null}
            </label>
            <label className="mt-3 block text-sm font-medium text-slate-700">
              New password
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none ring-emerald-500/0 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                autoComplete="new-password"
                minLength={8}
              />
              {errors.password ? <span className="mt-1 block text-xs text-red-600">{errors.password}</span> : null}
            </label>
            <label className="mt-3 block text-sm font-medium text-slate-700">
              Confirm new password
              <input
                type="password"
                name="password_confirmation"
                value={form.password_confirmation}
                onChange={(e) => setForm((f) => ({ ...f, password_confirmation: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none ring-emerald-500/0 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                autoComplete="new-password"
                minLength={8}
              />
            </label>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={closeEdit}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <h2 className="mt-10 text-lg font-semibold text-slate-900">Price posts</h2>
      <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.posts.length === 0 ? (
          <p className="col-span-full text-slate-500">No public posts.</p>
        ) : (
          data.posts.map((post) => (
            <PostCard key={post.id} post={post} onMutate={() => setPostsVersion((v) => v + 1)} />
          ))
        )}
        <ProfilePostsLoadSentinel
          hasMore={Boolean(data.postsMeta?.hasMore)}
          loading={postsLoadingMore}
          onLoadMore={() => void loadMorePosts()}
        />
      </section>
      <p className="mt-8">
        <Link to="/" className="text-sm text-emerald-600 hover:underline">
          ← Home
        </Link>
      </p>

      <ProfileQrModal
        isOpen={qrOpen}
        onClose={() => setQrOpen(false)}
        profileUrl={profileQrUrl}
        displayName={data.user.name ?? 'Member'}
      />
    </div>
  )
}
