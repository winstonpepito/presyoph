import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { apiFetch, getToken, setToken } from '../lib/api'

export type SessionUser = {
  id: string
  name: string | null
  email: string | null
  image: string | null
  externalImageUrl?: string | null
  role: 'USER' | 'ADMIN'
}

type AuthContextValue = {
  user: SessionUser | null
  status: 'loading' | 'authenticated' | 'unauthenticated'
  refresh: () => Promise<void>
  login: (token: string, user: SessionUser) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [status, setStatus] = useState<AuthContextValue['status']>('loading')

  const refresh = useCallback(async () => {
    const t = getToken()
    if (!t) {
      setUser(null)
      setStatus('unauthenticated')
      return
    }
    const r = await apiFetch('/api/auth/user')
    if (!r.ok) {
      setToken(null)
      setUser(null)
      setStatus('unauthenticated')
      return
    }
    const data = (await r.json()) as SessionUser
    if (data && data.id) {
      setUser(data)
      setStatus('authenticated')
    } else {
      setUser(null)
      setStatus('unauthenticated')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback((token: string, u: SessionUser) => {
    setToken(token)
    setUser({ ...u, role: u.role === 'ADMIN' ? 'ADMIN' : 'USER' })
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' })
    setToken(null)
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  const value = useMemo(
    () => ({ user, status, refresh, login, logout }),
    [user, status, refresh, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
