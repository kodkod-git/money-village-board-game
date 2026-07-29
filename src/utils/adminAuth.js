const TOKEN_KEY = 'admin_token'
const PROFILE_KEY = 'admin_profile'

export function getAdminToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function getAdminProfile() {
  const raw = sessionStorage.getItem(PROFILE_KEY)
  return raw ? JSON.parse(raw) : null
}

export function setAdminSession(token, profile) {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export function clearAdminSession() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(PROFILE_KEY)
}

export function adminFetch(url, options = {}) {
  const token = getAdminToken()
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  })
}
