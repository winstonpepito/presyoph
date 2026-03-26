import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { redirectToGoogleSignIn } from '../lib/googleSignIn'
import { useAuth } from '../context/AuthContext'
import type { SessionUser } from '../context/AuthContext'

export function RegisterForm({ hasGoogle, hasOidc }: { hasGoogle: boolean; hasOidc: boolean }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const signInHref =
    callbackUrl && callbackUrl !== '/'
      ? `/auth/signin?${new URLSearchParams({ callbackUrl }).toString()}`
      : '/auth/signin'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formErr, setFormErr] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormErr('')
    setErrors({})
    setPending(true)
    try {
      const r = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          password_confirmation: passwordConfirmation,
        }),
        skipAuth: true,
      })
      const data = (await r.json()) as {
        token?: string
        user?: SessionUser
        message?: string
        errors?: Record<string, string[]>
      }
      if (r.status === 422 && data.errors) {
        const next: Record<string, string> = {}
        for (const [k, arr] of Object.entries(data.errors)) {
          next[k] = Array.isArray(arr) ? (arr[0] ?? '') : String(arr)
        }
        setErrors(next)
        return
      }
      if (!r.ok) {
        setFormErr(data.message || 'Could not create account. Try again.')
        return
      }
      if (data.token && data.user) {
        login(data.token, data.user)
        navigate(callbackUrl, { replace: true })
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        {formErr ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formErr}</p> : null}
        <div>
          <label className="text-sm font-medium text-slate-700">Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            autoComplete="name"
          />
          {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name}</p> : null}
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            autoComplete="email"
          />
          {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            autoComplete="new-password"
          />
          {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password}</p> : null}
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Confirm password</label>
          <input
            type="password"
            required
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            autoComplete="new-password"
          />
          {errors.password_confirmation ? (
            <p className="mt-1 text-xs text-red-600">{errors.password_confirmation}</p>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link to={signInHref} className="font-semibold text-emerald-700 hover:underline">
          Sign in
        </Link>
      </p>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-slate-400">Or continue with</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {hasGoogle && (
          <button
            type="button"
            className="rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={() => redirectToGoogleSignIn(callbackUrl)}
          >
            Continue with Google
          </button>
        )}
        {hasOidc && (
          <button
            type="button"
            className="rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={() =>
              alert('Wire OIDC in Laravel and point this button to your SSO authorize URL.')
            }
          >
            SSO
          </button>
        )}
      </div>
      {!hasGoogle && !hasOidc && (
        <p className="text-center text-xs text-slate-500">
          Add <code className="rounded bg-slate-100 px-1">AUTH_GOOGLE_ID</code> and{' '}
          <code className="rounded bg-slate-100 px-1">AUTH_GOOGLE_SECRET</code> in Laravel{' '}
          <code className="rounded bg-slate-100 px-1">.env</code> and set the Google OAuth redirect URI to{' '}
          <code className="rounded bg-slate-100 px-1">{'{APP_URL}'}/auth/google/callback</code>.
        </p>
      )}
    </div>
  )
}
