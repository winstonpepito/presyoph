import { apiUrl } from './api'

/** Full-page redirect to Laravel Google OAuth. `nextPath` must be an in-app path (e.g. `/` or `/admin`). */
export function redirectToGoogleSignIn(nextPath: string): void {
  const path = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/'
  const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(path)}`
  const target = `${apiUrl('/auth/google/redirect')}?return=${encodeURIComponent(callback)}`
  window.location.assign(target)
}
