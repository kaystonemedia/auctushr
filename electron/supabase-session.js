/**
 * Supabase session helpers for the Electron main process.
 * Replaces legacy Firebase auth storage and normalizes user payloads.
 */

function migrateLegacyStore(store) {
  const legacyUser = store.get('firebaseUser')
  if (legacyUser && !store.get('authUser')) {
    store.set('authUser', legacyUser)
  }
}

function normalizeUser(userData, token) {
  const uid = userData?.uid || userData?.id || null
  return {
    uid,
    id: uid,
    email: userData?.email || '',
    name: userData?.name || userData?.email || 'User',
    role: userData?.role || 'employee',
    department: userData?.department ?? null,
    managerId: userData?.managerId ?? null,
    token: token || userData?.token || null
  }
}

function applyAuthSession(monitor, token, userData, store) {
  if (!token || !userData) {
    return false
  }

  const normalized = normalizeUser(userData, token)
  monitor.authUser = normalized
  monitor.authToken = token
  monitor.userData = normalized

  store.set('authUser', normalized)
  store.set('authToken', token)
  store.set('userData', normalized)
  store.set('webAppAuthData', { token, user: normalized })
  store.set('webAppAuthTimestamp', Date.now())
  store.set('offlineMode', false)
  store.delete('firebaseUser')

  monitor.safeSendToMainWindow?.('auth-state-changed', {
    authenticated: true,
    user: normalized,
    offline: false
  })

  return true
}

function restoreStoredAuth(monitor, store) {
  migrateLegacyStore(store)

  const webAppAuth = store.get('webAppAuthData')
  const webAppTimestamp = store.get('webAppAuthTimestamp')
  if (webAppAuth?.token && webAppAuth?.user && webAppTimestamp) {
    const age = Date.now() - webAppTimestamp
    if (age < 24 * 60 * 60 * 1000) {
      return applyAuthSession(monitor, webAppAuth.token, webAppAuth.user, store)
    }
    store.delete('webAppAuthData')
    store.delete('webAppAuthTimestamp')
  }

  const token = store.get('authToken')
  const user = store.get('authUser') || store.get('userData')
  if (token && user) {
    return applyAuthSession(monitor, token, user, store)
  }

  return false
}

module.exports = {
  migrateLegacyStore,
  normalizeUser,
  applyAuthSession,
  restoreStoredAuth
}
