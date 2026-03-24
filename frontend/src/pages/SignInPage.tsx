import { Link } from 'react-router-dom'
import { SignInForm } from '../components/SignInForm'
import { apiFetch } from '../lib/api'
import { Suspense, useEffect, useState } from 'react'

export function SignInPage() {
  const [flags, setFlags] = useState<{ google: boolean; oidc: boolean } | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const r = await apiFetch('/api/auth/providers', { skipAuth: true })
      const j = (await r.json()) as { google?: boolean; oidc?: boolean }
      if (!cancelled) setFlags({ google: !!j.google, oidc: !!j.oidc })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
      <p className="mt-2 text-sm text-slate-600">
        Use the seeded admin account or configure OAuth / OIDC SSO.
      </p>
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
          {flags ? (
            <SignInForm hasGoogle={flags.google} hasOidc={flags.oidc} />
          ) : (
            <p className="text-sm text-slate-500">Loading…</p>
          )}
        </Suspense>
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link to="/" className="text-emerald-600 hover:underline">
          ← Back home
        </Link>
      </p>
    </div>
  )
}
