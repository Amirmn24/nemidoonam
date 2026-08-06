const API_BASE = '/api/v1'

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

let csrfReady = false

export async function ensureCsrf() {
  if (csrfReady && getCookie('csrftoken')) return getCookie('csrftoken')
  const res = await fetch(`${API_BASE}/auth/csrf/`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error('نتوانستیم CSRF را بگیریم.')
  const data = await res.json()
  csrfReady = true
  return data.csrfToken || getCookie('csrftoken')
}

export class ApiError extends Error {
  constructor(message, { status, errors, payload } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors || {}
    this.payload = payload
  }
}

async function parseBody(res) {
  if (res.status === 204) return null
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { detail: text }
  }
}

export async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const headers = { ...(options.headers || {}) }
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData

  if (!isFormData && options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = await ensureCsrf()
    if (csrf) headers['X-CSRFToken'] = csrf
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
    body:
      options.body && !isFormData && typeof options.body === 'object'
        ? JSON.stringify(options.body)
        : options.body,
  })

  const data = await parseBody(res)
  if (!res.ok) {
    throw new ApiError(data?.detail || 'خطایی رخ داد.', {
      status: res.status,
      errors: data?.errors || {},
      payload: data,
    })
  }
  return data
}

export const authApi = {
  me: () => api('/auth/me/'),
  login: (body) => api('/auth/login/', { method: 'POST', body }),
  signup: (body) => api('/auth/signup/', { method: 'POST', body }),
  logout: () => api('/auth/logout/', { method: 'POST' }),
  updateProfile: (body) =>
    api('/auth/me/', {
      method: 'PATCH',
      body,
      headers: body instanceof FormData ? {} : undefined,
    }),
}

export const dashboardApi = {
  summary: (params = {}) => {
    const q = new URLSearchParams()
    if (params.weeks) q.set('weeks', String(params.weeks))
    const qs = q.toString()
    return api(`/dashboard/${qs ? `?${qs}` : ''}`)
  },
  refreshVibe: () => api('/dashboard/vibe/refresh/', { method: 'POST' }),
}

export const booksApi = {
  list: (params = {}) => {
    const q = new URLSearchParams()
    if (params.status) q.set('status', params.status)
    const qs = q.toString()
    return api(`/shelf/${qs ? `?${qs}` : ''}`)
  },
  detail: (id, params = {}) => {
    const q = new URLSearchParams()
    if (params.kind) q.set('kind', params.kind)
    if (params.media) q.set('media', params.media)
    const qs = q.toString()
    return api(`/shelf/${id}/${qs ? `?${qs}` : ''}`)
  },
  create: (body) =>
    api('/shelf/', {
      method: 'POST',
      body,
      headers: body instanceof FormData ? {} : undefined,
    }),
  update: (id, body) =>
    api(`/shelf/${id}/`, {
      method: 'PATCH',
      body,
      headers: body instanceof FormData ? {} : undefined,
    }),
  remove: (id) => api(`/shelf/${id}/`, { method: 'DELETE' }),
  progress: (id, body) => api(`/shelf/${id}/progress/`, { method: 'POST', body }),
  finish: (id) => api(`/shelf/${id}/finish/`, { method: 'POST' }),
  getRating: (id) => api(`/shelf/${id}/rating/`),
  saveRating: (id, body) => api(`/shelf/${id}/rating/`, { method: 'PUT', body }),
  suggest: (params) => {
    const q = new URLSearchParams(params)
    return api(`/books/suggest/?${q}`)
  },
  addFromCatalog: (bookId) => api(`/catalog/${bookId}/add/`, { method: 'POST' }),
  createEntry: (bookId, body) =>
    api(`/shelf/${bookId}/entries/`, {
      method: 'POST',
      body,
      headers: body instanceof FormData ? {} : undefined,
    }),
  updateEntry: (bookId, entryId, body) =>
    api(`/shelf/${bookId}/entries/${entryId}/`, {
      method: 'PATCH',
      body,
      headers: body instanceof FormData ? {} : undefined,
    }),
  deleteEntry: (bookId, entryId) =>
    api(`/shelf/${bookId}/entries/${entryId}/`, { method: 'DELETE' }),
  getEntry: (bookId, entryId) => api(`/shelf/${bookId}/entries/${entryId}/`),
  choices: () => api('/meta/choices/'),
}

export const challengesApi = {
  list: (params = {}) => {
    const q = new URLSearchParams()
    if (params.status) q.set('status', params.status)
    const qs = q.toString()
    return api(`/challenges/${qs ? `?${qs}` : ''}`)
  },
  detail: (id) => api(`/challenges/${id}/`),
  create: (body) => api('/challenges/', { method: 'POST', body }),
  update: (id, body) => api(`/challenges/${id}/`, { method: 'PATCH', body }),
  remove: (id) => api(`/challenges/${id}/`, { method: 'DELETE' }),
}

export const vocabularyApi = {
  list: (params = {}) => {
    const q = new URLSearchParams()
    if (params.q) q.set('q', params.q)
    const qs = q.toString()
    return api(`/vocabulary/${qs ? `?${qs}` : ''}`)
  },
  create: (body) =>
    api('/vocabulary/', {
      method: 'POST',
      body,
      headers: body instanceof FormData ? {} : undefined,
    }),
  update: (id, body) =>
    api(`/vocabulary/${id}/`, {
      method: 'PATCH',
      body,
      headers: body instanceof FormData ? {} : undefined,
    }),
  remove: (id) => api(`/vocabulary/${id}/`, { method: 'DELETE' }),
  detail: (id) => api(`/vocabulary/${id}/`),
}
