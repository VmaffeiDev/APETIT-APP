export type PreviewItem = {
  day: number
  source_column: string
  category: string
  name: string
  portion: string | null
  technical_sheet_code: string | null
  raw_value: string
}

export type PreviewDay = {
  day: number
  items: PreviewItem[]
}

export type MenuPreview = {
  preview_id: string
  file_name: string
  unit_id: string
  meal_type: string
  suggested_month: number | null
  suggested_year: number | null
  item_count: number
  day_count: number
  days: PreviewDay[]
  warnings: string[]
  requires_period_confirmation: boolean
}

export type PublishResult = {
  status: 'published'
  menu_import_id: string
  period_start: string
  period_end: string
  item_count: number
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function readError(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
  }
  return fallback
}

export async function previewMenu(params: {
  unitId: string
  mealType: string
  adminKey: string
  file: File
}): Promise<MenuPreview> {
  const body = new FormData()
  body.set('unit_id', params.unitId)
  body.set('meal_type', params.mealType)
  body.set('file', params.file)

  const response = await fetch(`${API_URL}/api/admin/menu-imports/preview`, {
    method: 'POST',
    headers: { 'X-Apetit-Admin-Key': params.adminKey },
    body,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(readError(payload, 'Não foi possível validar o cardápio.'))
  return payload as MenuPreview
}

export async function publishMenu(params: {
  previewId: string
  month: number
  year: number
  adminKey: string
}): Promise<PublishResult> {
  const response = await fetch(`${API_URL}/api/admin/menu-imports/${params.previewId}/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Apetit-Admin-Key': params.adminKey,
    },
    body: JSON.stringify({
      month: params.month,
      year: params.year,
      confirm_period: true,
    }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(readError(payload, 'Não foi possível publicar o cardápio.'))
  return payload as PublishResult
}
