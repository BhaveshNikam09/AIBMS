const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

let installed = false

const PUBLIC_AUTH_PATHS = [
  '/api/v1/auth/login/',
  '/api/v1/auth/register/',
  '/api/v1/auth/verify-email/',
  '/api/v1/auth/forgot-password/',
  '/api/v1/auth/reset-password/',
  '/api/v1/auth/logout/',
  '/api/v1/auth/token/refresh/',
  '/api/v1/users/login/',
  '/api/v1/users/register/',
  '/api/v1/users/verify-email/',
  '/api/v1/users/forgot-password/',
  '/api/v1/users/reset-password/',
  '/api/v1/users/logout/',
  '/api/v1/users/token/refresh/',
]

function getBackendOrigin() {
  try {
    return new URL(API_BASE, window.location.origin).origin
  } catch {
    return window.location.origin
  }
}

function getRequestUrl(input) {
  if (typeof input === 'string' || input instanceof URL) {
    return String(input)
  }
  return input?.url || ''
}

function isProtectedApiRequest(url) {
  try {
    const parsed = new URL(url, window.location.origin)
    if (parsed.origin !== getBackendOrigin()) return false
    if (!parsed.pathname.startsWith('/api/v1/')) return false
    return !PUBLIC_AUTH_PATHS.includes(parsed.pathname)
  } catch {
    return false
  }
}

function getHeaderValue(headers, key) {
  if (!headers) return ''
  try {
    if (headers instanceof Headers) return headers.get(key) || ''
    const found = Object.entries(headers).find(([name]) => name.toLowerCase() === key.toLowerCase())
    return found ? String(found[1] || '') : ''
  } catch {
    return ''
  }
}

function hasAuthHeader(headers) {
  const value = getHeaderValue(headers, 'Authorization').trim()
  if (!value) return false
  return /^Bearer\s+\S+/i.test(value) || !/^Bearer\s*$/i.test(value)
}

function extractAccessToken(raw) {
  return (
    raw?.data?.access_token ||
    raw?.data?.access ||
    raw?.access_token ||
    raw?.access ||
    raw?.token ||
    ''
  )
}

async function readJsonSafely(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}

function setAccessToken(token) {
  if (token) {
    localStorage.setItem('access_token', token)
  } else {
    localStorage.removeItem('access_token')
  }
}

async function refreshAccessToken(originalFetch) {
  const refreshToken = localStorage.getItem('refresh_token') || ''
  if (!refreshToken) return ''

  const endpoints = [
    `${API_BASE}/api/v1/auth/token/refresh/`,
    `${API_BASE}/api/v1/users/token/refresh/`,
  ]

  for (const endpoint of endpoints) {
    try {
      const response = await originalFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      })
      const raw = await readJsonSafely(response)
      if (!response.ok) continue

      const nextToken = extractAccessToken(raw)
      if (nextToken) {
        setAccessToken(nextToken)
        return nextToken
      }
    } catch {
      // Try the next refresh endpoint.
    }
  }

  return ''
}

function buildUnauthorizedResponse() {
  return new Response(
    JSON.stringify({ message: 'Authentication required.' }),
    {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

export function installAuthFetchInterceptor() {
  if (typeof window === 'undefined' || installed) return
  installed = true

  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input, init = {}) => {
    const requestUrl = getRequestUrl(input)
    const protectedRequest = isProtectedApiRequest(requestUrl)

    if (!protectedRequest) {
      return originalFetch(input, init)
    }

    const headers = new Headers(init.headers || input?.headers || {})
    let accessToken = localStorage.getItem('access_token') || ''
    const refreshToken = localStorage.getItem('refresh_token') || ''

    if (!accessToken && refreshToken) {
      accessToken = await refreshAccessToken(originalFetch)
    }

    if (!accessToken) {
      return buildUnauthorizedResponse()
    }

    if (!hasAuthHeader(headers)) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }

    const response = await originalFetch(input, { ...init, headers })
    if (response.status !== 401) {
      return response
    }

    const refreshedToken = await refreshAccessToken(originalFetch)
    if (!refreshedToken) {
      setAccessToken('')
      return response
    }

    const retryHeaders = new Headers(init.headers || input?.headers || {})
    retryHeaders.set('Authorization', `Bearer ${refreshedToken}`)
    return originalFetch(input, { ...init, headers: retryHeaders })
  }
}
