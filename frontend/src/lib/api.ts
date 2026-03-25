/**
 * API origin: VITE_API_URL at build time, or at runtime <meta name="pm-api-base" content="https://api.example.com" />
 * when the static site and API are on different hosts and the env var was not set during build.
 */
function getApiBase(): string {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="pm-api-base"]')?.getAttribute('content')?.trim()
    if (meta) return meta.replace(/\/$/, '')
  }
  return ''
}

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${getApiBase()}${p}`
}

/** Prefix relative paths with API origin; pass through absolute http(s) URLs (e.g. banner asset URLs). */
export function mediaUrl(urlOrPath: string): string {
  if (!urlOrPath) return ''
  if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath
  const p = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`
  return `${getApiBase()}${p}`
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
