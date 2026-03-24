import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const links = [
  { href: '/', label: 'Home' },
  { href: '/search', label: 'Search' },
  { href: '/post', label: 'Post price' },
]

export function Nav() {
  const location = useLocation()
  const { user, status, logout } = useAuth()

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="text-lg font-semibold tracking-tight text-slate-900">
          PriceMonitor<span className="text-emerald-600">PH</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              to={href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                location.pathname === href
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </Link>
          ))}
          {user?.id && (
            <Link
              to={`/profile/${user.id}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                location.pathname.startsWith('/profile')
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Profile
            </Link>
          )}
          {user?.role === 'ADMIN' && (
            <Link
              to="/admin"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                location.pathname.startsWith('/admin')
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Admin
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          {status === 'loading' ? (
            <span className="text-sm text-slate-400">…</span>
          ) : user ? (
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          ) : (
            <Link
              to="/auth/signin"
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
