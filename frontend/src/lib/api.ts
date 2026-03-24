const API_BASE = import.meta.env.VITE_API_URL || ''

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${p}`
}

/** Use API origin for uploaded files when the server returns a root-relative /storage/… URL. */
export function mediaUrl(urlOrPath: string): string {
  if (!urlOrPath) return ''
  if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath
  const p = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`
  return `${API_BASE}${p}`
}

export type ApiFetchOptions = RequestInit & { skipAuth?: boolean }

export function getToken(): string | null {
  return localStorage.getItem('pm_token')
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem('pm_token', token)
  else localStorage.removeItem('pm_token')
}

export async function apiFetch(path: string, opts: ApiFetchOptions = {}): Promise<Response> {
  const headers = new Headers(opts.headers)
  headers.set('Accept', 'application/json')
  if (opts.body && !(opts.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (!opts.skipAuth) {
    const t = getToken()
    if (t) headers.set('Authorization', `Bearer ${t}`)
  }
  const { skipAuth: _, ...rest } = opts
  return fetch(apiUrl(path), { ...rest, headers })
}
