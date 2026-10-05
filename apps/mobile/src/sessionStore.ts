import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const SESSION_KEY = 'apetit.employee.session'

export type StoredSession = {
  access_token: string
  expires_at: string
}

function getWebStorage(): Storage | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null
  return window.localStorage
}

export async function saveStoredSession(session: StoredSession): Promise<void> {
  const serialized = JSON.stringify(session)
  const webStorage = getWebStorage()
  if (webStorage) {
    webStorage.setItem(SESSION_KEY, serialized)
    return
  }
  await SecureStore.setItemAsync(SESSION_KEY, serialized, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  })
}

export async function loadStoredSession(): Promise<StoredSession | null> {
  const webStorage = getWebStorage()
  const raw = webStorage ? webStorage.getItem(SESSION_KEY) : await SecureStore.getItemAsync(SESSION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoredSession
    if (!parsed.access_token || !parsed.expires_at) return null
    if (new Date(parsed.expires_at).getTime() <= Date.now()) {
      await clearStoredSession()
      return null
    }
    return parsed
  } catch {
    await clearStoredSession()
    return null
  }
}

export async function clearStoredSession(): Promise<void> {
  const webStorage = getWebStorage()
  if (webStorage) {
    webStorage.removeItem(SESSION_KEY)
    return
  }
  await SecureStore.deleteItemAsync(SESSION_KEY)
}
