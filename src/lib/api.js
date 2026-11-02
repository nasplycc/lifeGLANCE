const API_BASE = '/api'

class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `API error ${status}`)
    this.status = status
    this.body = body
  }
}

// Store token globally for all API calls
let _token = null
export function setAuthToken(token) { _token = token }
export function getAuthToken() { return _token }

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`
  const { body, ...fetchOpts } = options

  const headers = { 'Content-Type': 'application/json' }
  if (_token) headers['Authorization'] = `Bearer ${_token}`

  const res = await fetch(url, {
    headers,
    ...fetchOpts,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    let payload
    try { payload = await res.json(); } catch { payload = null; }
    throw new ApiError(res.status, payload)
  }

  return res.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function apiRegister(username, email, code, password) {
  return request('/auth/register', { method: 'POST', body: { username, email, code, password } })
}

export async function apiSendCode(email, purpose) {
  return request('/auth/send-code', { method: 'POST', body: { email, purpose } })
}

export async function apiResetPassword(email, code, newPassword) {
  return request('/auth/reset-password', { method: 'POST', body: { email, code, newPassword } })
}

export async function apiLogin(username, password) {
  return request('/auth/login', { method: 'POST', body: { username, password } })
}

export async function apiMe(token) {
  const url = `${API_BASE}/auth/me`
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    let payload
    try { payload = await res.json(); } catch { payload = null; }
    throw new ApiError(res.status, payload)
  }
  return res.json()
}

// ── Milestones ───────────────────────────────────────────────────────────────

export async function apiGetMilestones() { return request('/milestones') }
export async function apiGetMilestone(id) { return request(`/milestones/${id}`) }
export async function apiCreateMilestone(data) { return request('/milestones', { method: 'POST', body: data }) }
export async function apiUpdateMilestone(id, data) { return request(`/milestones/${id}`, { method: 'PUT', body: data }) }
export async function apiDeleteMilestone(id) { return request(`/milestones/${id}`, { method: 'DELETE' }) }
export async function apiDeleteSeries(recurrenceId) { return request(`/milestones/series/${recurrenceId}`, { method: 'DELETE' }) }
export async function apiRestoreMilestones(items) { return request('/milestones/restore', { method: 'POST', body: items }) }

// ── Chapters ─────────────────────────────────────────────────────────────────

export async function apiGetChapters() { return request('/chapters') }
export async function apiGetChapter(id) { return request(`/chapters/${id}`) }
export async function apiCreateChapter(data) { return request('/chapters', { method: 'POST', body: data }) }
export async function apiUpdateChapter(id, data) { return request(`/chapters/${id}`, { method: 'PUT', body: data }) }
export async function apiDeleteChapter(id) { return request(`/chapters/${id}`, { method: 'DELETE' }) }
export async function apiRestoreChapters(items) { return request('/chapters/restore', { method: 'POST', body: items }) }

// ── Account ─────────────────────────────────────────────────────────────────

export async function apiAccountSendCode(purpose, email) {
  return request('/account/send-code', { method: 'POST', body: { purpose, email } })
}

export async function apiChangeUsername(newUsername, password) {
  return request('/account/change-username', { method: 'POST', body: { newUsername, password } })
}

export async function apiChangePassword(oldPassword, newPassword, code) {
  return request('/account/change-password', { method: 'POST', body: { oldPassword, newPassword, code } })
}

export async function apiChangeEmail(newEmail, code) {
  return request('/account/change-email', { method: 'POST', body: { newEmail, code } })
}

// ── Music Library ────────────────────────────────────────────────────────────

export async function apiGetAllMusic() {
  return request('/music')
}

export async function apiUploadMusic(file, title, artist) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('title', title)
  if (artist) formData.append('artist', artist)
  const headers = {}
  if (_token) headers['Authorization'] = `Bearer ${_token}`
  const res = await fetch(`${API_BASE}/music`, {
    method: 'POST',
    headers,
    body: formData,
  })
  if (!res.ok) {
    let payload
    try { payload = await res.json(); } catch { payload = null; }
    throw new ApiError(res.status, payload)
  }
  return res.json()
}

export async function apiDeleteMusic(id) {
  return request(`/music/${id}`, { method: 'DELETE' })
}

export async function apiUpdateMusic(id, data) {
  return request(`/music/${id}`, { method: 'PUT', body: data })
}

export function apiMusicStreamUrl(id) {
  return `${API_BASE}/music/${id}/stream`
}

// ── Media ────────────────────────────────────────────────────────────────────

export async function apiUploadMedia(milestoneId, kind, file) {
  const formData = new FormData()
  formData.append('file', file)
  const headers = {}
  if (_token) headers['Authorization'] = `Bearer ${_token}`
  const res = await fetch(`${API_BASE}/media/${milestoneId}/${kind}`, {
    method: 'POST',
    headers,
    body: formData,
  })
  if (!res.ok) {
    let payload
    try { payload = await res.json(); } catch { payload = null; }
    throw new ApiError(res.status, payload)
  }
  return res.json()
}

export function apiMediaUrl(milestoneId, kind) {
  const url = `${API_BASE}/media/${milestoneId}/${kind}`
  const params = new URLSearchParams()
  params.set('_', String(Date.now()))
  if (_token) params.set('token', _token)
  return `${url}?${params.toString()}`
}

export async function apiDeleteMedia(milestoneId, kind) { return request(`/media/${milestoneId}/${kind}`, { method: 'DELETE' }) }
export async function apiDeleteAllMedia(milestoneId) { return request(`/media/${milestoneId}`, { method: 'DELETE' }) }

// ── Sync ─────────────────────────────────────────────────────────────────────

export async function apiExportSync() { return request('/sync/export') }
export async function apiImportSync(data) { return request('/sync/import', { method: 'POST', body: data }) }

// ── Storage ──────────────────────────────────────────────────────────────────

export async function apiStorage() { return request('/storage') }
export async function apiClearUserData() { return request('/user/data', { method: 'DELETE' }) }

// ── Health ───────────────────────────────────────────────────────────────────

export async function apiHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`)
    return res.ok
  } catch {
    return false
  }
}
