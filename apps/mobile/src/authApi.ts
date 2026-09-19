const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'

export type AuthPerson = {
  id: string
  email: string
  name: string | null
  unit_id: string | null
  sector: string | null
  goal: string | null
  restrictions?: string[]
  onboarding_completed: boolean
}

export type AuthSession = {
  access_token: string
  expires_at: string
  person: AuthPerson
}

export type OnboardingOptions = {
  units: Array<{
    company_id: string
    company_name: string
    unit_id: string
    unit_name: string
  }>
  goals: string[]
}

function readableDetail(detail: unknown): string {
  if (typeof detail === 'string' && detail.trim()) return detail

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        if ('msg' in item && typeof item.msg === 'string') return item.msg
        if ('message' in item && typeof item.message === 'string') return item.message
        return null
      })
      .filter((message): message is string => Boolean(message))

    if (messages.length) return messages.join(' ')
  }

  if (detail && typeof detail === 'object') {
    if ('message' in detail && typeof detail.message === 'string') return detail.message
    if ('msg' in detail && typeof detail.msg === 'string') return detail.msg
  }

  return 'Não foi possível concluir a operação.'
}

async function parse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : null
    throw new Error(readableDetail(detail))
  }
  return body as T
}

export async function requestLoginCode(email: string): Promise<{ demo_code?: string; message: string }> {
  return parse(await fetch(`${API_URL}/api/auth/request-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }))
}

export async function verifyLoginCode(email: string, code: string): Promise<AuthSession> {
  return parse(await fetch(`${API_URL}/api/auth/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  }))
}

export async function getOnboardingOptions(): Promise<OnboardingOptions> {
  return parse(await fetch(`${API_URL}/api/auth/options`))
}

export async function getMe(token: string): Promise<AuthPerson> {
  return parse(await fetch(`${API_URL}/api/me`, {
    headers: { Authorization: `Bearer ${token}` },
  }))
}

export async function saveOnboarding(params: {
  token: string
  name: string
  unitId: string
  sector?: string
  goal?: string
  restrictions: string[]
}): Promise<{ status: string; onboarding_completed: boolean; person_id: string }> {
  return parse(await fetch(`${API_URL}/api/me/onboarding`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      name: params.name,
      unit_id: params.unitId,
      sector: params.sector || null,
      goal: params.goal || null,
      restrictions: params.restrictions,
    }),
  }))
}

export async function updateProfile(params: {
  token: string
  name: string
  unitId: string
  sector?: string
  goal?: string
  restrictions: string[]
}): Promise<AuthPerson> {
  return parse(await fetch(`${API_URL}/api/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      name: params.name,
      unit_id: params.unitId,
      sector: params.sector || null,
      goal: params.goal || null,
      restrictions: params.restrictions,
    }),
  }))
}

export async function logout(token: string): Promise<void> {
  await parse(await fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }))
}
