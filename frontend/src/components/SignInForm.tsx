import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import type { SessionUser } from '../context/AuthContext'

export function SignInForm({ hasGoogle, hasOidc }: { hasGoogle: boolean; hasOidc: boolean }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const registerHref =
    callbackUrl && callbackUrl !== '/'
      ? `/auth/register?${new URLSearchParams({ callbackUrl }).toString()}`
      : '/auth/register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [pending, setPending] = useState(false)

  async function onCredentials(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setPending(true)
    try {
      const r = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      })
      const data = (await r.json()) as { token?: string; user?: SessionUser; message?: string; errors?: Record<string, string[]> }
      if (!r.ok) {
        setErr(data.message || data.errors?.email?.[0] || 'Invalid email or password.')
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
      <form onSubmit={(e) => void onCredentials(e)} className="space-y-4">
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
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
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            autoComplete="current-password"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? 'Signing in…' : 'Sign in with email'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-600">
        No account?{' '}
        <Link to={registerHref} className="font-semibold text-emerald-700 hover:underline">
          Register
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
            onClick={() =>
              alert('Wire Google OAuth in Laravel (Socialite) and point this button to your authorize URL.')
            }
          >
            Google
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
          Add AUTH_GOOGLE_* or AUTH_OIDC_* in the Laravel <code className="rounded bg-slate-100 px-1">.env</code> to
          surface SSO buttons (Laravel Socialite / OIDC still needs routes).
        </p>
      )}
    </div>
  )
}
