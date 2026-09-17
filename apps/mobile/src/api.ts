export type NutritionTarget = {
  kcal: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
}

export type Portion = {
  category: string
  quantity: number | null
  unit: string | null
  notes: string | null
}

export type PrescriptionPreview = {
  preview_id: string
  file_name: string
  extraction_status: string
  requires_ocr: boolean
  requires_confirmation: boolean
  meal: null | {
    meal_type: string
    target: NutritionTarget
    portions: Portion[]
  }
  message: string
}

export type Recommendation = {
  status: 'recommended' | 'insufficient_data'
  message?: string
  service_date?: string
  meal_type?: string
  target: NutritionTarget
  estimated_totals?: NutritionTarget
  items: Array<{
    menu_item_id: string
    name: string
    category: string
    portion: string | null
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }>
  warnings: {
    excluded_for_restriction: string[]
    skipped_missing_nutrition: string[]
    uncertain_allergens: string[]
  }
  disclaimer?: string
}

export type PublishedMenu = {
  unit_id: string
  service_date: string
  meal_type: string
  items: Array<{
    id: string
    name: string
    category: string
    standard_portion: string | null
    kcal: number | null
    protein_g: number | null
    carbs_g: number | null
    fat_g: number | null
    technical_sheet_code: string | null
  }>
}

export type MealSaveResult = {
  status: string
  meal_id: string
  meal_date: string
  meal_type: string
  item_count: number
  estimated_totals: NutritionTarget
}

export type MealHistory = {
  person_id: string
  meals: Array<{
    meal_id: string
    meal_date: string
    meal_type: string
    totals: NutritionTarget
    items: Array<{
      item_name: string
      category: string
      quantity: number
      unit: string | null
      kcal: number | null
      protein_g: number | null
      carbs_g: number | null
      fat_g: number | null
    }>
  }>
}

export type MealProgress = {
  person_id: string
  period_start: string
  period_end: string
  meal_type: string
  target: NutritionTarget
  meal_days: number
  adherent_days: number
  adherence_percent: number | null
  series: Array<{
    date: string
    totals: NutritionTarget
    ratios: NutritionTarget
    within_target: boolean
  }>
}

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'detail' in payload ? String(payload.detail) : 'Erro ao conectar com a Apetit.'
    throw new Error(detail)
  }
  return payload as T
}

export async function uploadPrescription(params: {
  personId: string
  uri: string
  name: string
  mimeType?: string | null
}): Promise<PrescriptionPreview> {
  const body = new FormData()
  body.append('person_id', params.personId)
  body.append('default_meal_type', 'almoco')
  body.append('file', {
    uri: params.uri,
    name: params.name,
    type: params.mimeType ?? 'application/octet-stream',
  } as never)

  return parseResponse<PrescriptionPreview>(
    await fetch(`${API_URL}/api/prescriptions/preview`, { method: 'POST', body }),
  )
}

export async function confirmPrescription(preview: PrescriptionPreview): Promise<{ status: string; prescription_id: string }> {
  if (!preview.meal) throw new Error('A prescrição ainda não possui dados confirmáveis.')
  return parseResponse(
    await fetch(`${API_URL}/api/prescriptions/${preview.preview_id}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meal_type: preview.meal.meal_type,
        target: preview.meal.target,
        portions: preview.meal.portions,
        confirm: true,
      }),
    }),
  )
}

export async function getRecommendation(params: { personId: string; unitId: string; serviceDate: string }): Promise<Recommendation> {
  const query = new URLSearchParams({
    person_id: params.personId,
    unit_id: params.unitId,
    service_date: params.serviceDate,
    meal_type: 'almoco',
  })
  return parseResponse<Recommendation>(await fetch(`${API_URL}/api/nutrition/recommendation?${query.toString()}`))
}

export async function getPublishedMenu(params: { unitId: string; serviceDate: string }): Promise<PublishedMenu> {
  const query = new URLSearchParams({ unit_id: params.unitId, service_date: params.serviceDate, meal_type: 'almoco' })
  return parseResponse<PublishedMenu>(await fetch(`${API_URL}/api/menu?${query.toString()}`))
}

export async function registerMeal(params: { personId: string; serviceDate: string; recommendation: Recommendation }): Promise<MealSaveResult> {
  if (params.recommendation.status !== 'recommended') throw new Error('Não há uma recomendação válida para registrar.')
  return parseResponse<MealSaveResult>(
    await fetch(`${API_URL}/api/meals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        person_id: params.personId,
        meal_date: params.serviceDate,
        meal_type: 'almoco',
        items: params.recommendation.items.map((item) => ({
          menu_item_id: item.menu_item_id,
          quantity: 1,
          unit: item.portion ?? 'porcao',
        })),
      }),
    }),
  )
}

export async function getMealHistory(personId: string): Promise<MealHistory> {
  const query = new URLSearchParams({ person_id: personId, limit: '30' })
  return parseResponse<MealHistory>(await fetch(`${API_URL}/api/meals/history?${query.toString()}`))
}

export async function getMealProgress(personId: string): Promise<MealProgress> {
  const query = new URLSearchParams({ person_id: personId, days: '7', meal_type: 'almoco' })
  return parseResponse<MealProgress>(await fetch(`${API_URL}/api/meals/progress?${query.toString()}`))
}

export async function submitFeedback(params: {
  personId: string
  unitId: string
  restaurantId: string
  mealDate: string
  foodRating: number
  serviceRating: number
  tags: string[]
  comment?: string
}): Promise<{ status: string; feedback_id: string }> {
  return parseResponse(
    await fetch(`${API_URL}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        person_id: params.personId,
        unit_id: params.unitId,
        restaurant_id: params.restaurantId,
        meal_date: params.mealDate,
        food_rating: params.foodRating,
        service_rating: params.serviceRating,
        tags: params.tags,
        comment: params.comment?.trim() || null,
      }),
    }),
  )
}
