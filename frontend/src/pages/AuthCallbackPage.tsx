import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { setToken } from '../lib/api'

function safeNext(raw: string | null): string {
  if (!raw) return '/'
  try {
    const decoded = decodeURIComponent(raw)
    if (decoded.startsWith('/') && !decoded.startsWith('//')) {
      return decoded
    }
  } catch {
    /* ignore */
  }
  return '/'
}

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [message, setMessage] = useState('Completing sign-in…')

  useEffect(() => {
    let cancelled = false
    const err = searchParams.get('error')
    const token = searchParams.get('token')
    const next = safeNext(searchParams.get('next'))

    void (async () => {
      if (err) {
        if (!cancelled) {
          navigate(`/auth/signin?${new URLSearchParams({ error: err }).toString()}`, { replace: true })
        }
        return
      }
      if (!token) {
        if (!cancelled) {
          navigate(
            `/auth/signin?${new URLSearchParams({ error: 'Missing sign-in token. Try again.' }).toString()}`,
            { replace: true },
          )
        }
        return
      }

      setToken(token)
      await refresh()
      if (cancelled) return
      setMessage('Redirecting…')
      navigate(next, { replace: true })
    })()

    return () => {
      cancelled = true
    }
  }, [searchParams, navigate, refresh])

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center text-slate-600">
      <p className="text-sm">{message}</p>
    </div>
  )
}
