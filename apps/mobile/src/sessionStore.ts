import * as SecureStore from 'expo-secure-store'

const SESSION_KEY = 'apetit.employee.session'

export type StoredSession = {
  access_token: string
  expires_at: string
}

export async function saveStoredSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  })
}

export async function loadStoredSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY)
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
  await SecureStore.deleteItemAsync(SESSION_KEY)
}
