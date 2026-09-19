export type TechnicalSheetStatus = 'complete' | 'incomplete' | 'missing' | 'no_code'

export type PreviewItem = {
  day: number
  source_column: string
  category: string
  name: string
  portion: string | null
  technical_sheet_code: string | null
  technical_sheet_status?: TechnicalSheetStatus
  raw_value: string
}

export type PreviewDay = { day: number; items: PreviewItem[] }
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
  technical_sheet_coverage?: Record<TechnicalSheetStatus, number>
  requires_period_confirmation: boolean
}
export type PublicationStatus = {unit_id:string;meal_type:string;start:string;end:string;published_days:Array<{date:string;file_name:string;published_at:string|null}>}
export type PublishResult = { status: 'published'; menu_import_id: string; period_start: string; period_end: string; item_count: number; enriched_items?: number }
export type FeedbackSummary = { unit_id: string; restaurant_id: string | null; period_start: string; period_end: string; responses: number; minimum_group: number; suppressed: boolean; message: string | null; ratings: null | { overall: number; food: number; service: number }; tags: Array<{ tag: string; count: number }>; trend: Array<{ date: string; responses: number; rating: number }>; comments: Array<{ date: string; comment: string }> }
export type AdminOverview = { units:number; restaurants:number; published_menus:number; technical_sheets:number; complete_sheets:number; menu_items:number; enriched_menu_items:number; technical_coverage_percent:number; feedback_period_start:string; feedback_period_end:string; feedback_responses:number; satisfaction_overall:number|null; top_feedback_tag:null|{tag:string;count:number}; unit_comparison:Array<{unit_id:string;unit_name:string;company_name:string;published_menus:number;menu_days:number;menu_items:number;enriched_items:number;technical_coverage_percent:number;feedback_responses:number;satisfaction:number|null}>; latest_menu:null|{unit_name:string;period_start:string|null;period_end:string|null;published_at:string|null} }

export type TechnicalSheetSummary = {
  code: string
  name: string
  category: string | null
  portion_quantity: number | null
  portion_unit: string | null
  kcal: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  updated_at: string
}

export type TechnicalSheet = TechnicalSheetSummary & {
  ingredients: string[]
  allergens: Array<{ allergen: string; status: 'contains' | 'may_contain' | 'free_from' }>
}

export type TechnicalSheetImportItem = Omit<TechnicalSheet, 'updated_at'>
export type TechnicalSheetImportPreview = {
  preview_id: string
  file_name: string
  count: number
  complete_count: number
  incomplete_count: number
  warnings: string[]
  items: TechnicalSheetImportItem[]
}
export type TechnicalSheetImportResult = { status: 'published'; created: number; updated: number; count: number }

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
export const isPresentationMode = import.meta.env.VITE_PRESENTATION_MODE === 'true'
export const presentationAdminKey = isPresentationMode ? 'presentation' : ''

function readError(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
  }
  return fallback
}

async function read<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(readError(payload, fallback))
  return payload as T
}

export async function previewMenu(params: { unitId: string; mealType: string; adminKey: string; file: File }): Promise<MenuPreview> {
  const body = new FormData(); body.set('unit_id', params.unitId); body.set('meal_type', params.mealType); body.set('file', params.file)
  return read(await fetch(`${API_URL}/api/admin/menu-imports/preview`, { method: 'POST', headers: { 'X-Apetit-Admin-Key': params.adminKey }, body }), 'Não foi possível validar o cardápio.')
}

export async function publishMenu(params: { previewId: string; month: number; year: number; adminKey: string; replaceExisting?:boolean }): Promise<PublishResult> {
  return read(await fetch(`${API_URL}/api/admin/menu-imports/${params.previewId}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Apetit-Admin-Key': params.adminKey }, body: JSON.stringify({ month: params.month, year: params.year, confirm_period: true, replace_existing: params.replaceExisting ?? false }) }), 'Não foi possível publicar o cardápio.')
}

export async function getFeedbackSummary(params: { unitId: string; restaurantId?: string; start: string; end: string; adminKey: string }): Promise<FeedbackSummary> {
  const query = new URLSearchParams({ unit_id: params.unitId, start: params.start, end: params.end }); if (params.restaurantId?.trim()) query.set('restaurant_id', params.restaurantId.trim())
  return read(await fetch(`${API_URL}/api/admin/feedback/summary?${query.toString()}`, { headers: { 'X-Apetit-Admin-Key': params.adminKey } }), 'Não foi possível carregar os feedbacks.')
}

export async function listTechnicalSheets(adminKey: string, search = ''): Promise<{ items: TechnicalSheetSummary[]; count: number }> {
  const query = new URLSearchParams({ search })
  return read(await fetch(`${API_URL}/api/admin/technical-sheets?${query.toString()}`, { headers: { 'X-Apetit-Admin-Key': adminKey } }), 'Não foi possível carregar as fichas técnicas.')
}

export async function getTechnicalSheet(adminKey: string, code: string): Promise<TechnicalSheet> {
  return read(await fetch(`${API_URL}/api/admin/technical-sheets/${encodeURIComponent(code)}`, { headers: { 'X-Apetit-Admin-Key': adminKey } }), 'Não foi possível carregar a ficha técnica.')
}

export async function saveTechnicalSheet(adminKey: string, code: string, payload: Omit<TechnicalSheet, 'code' | 'updated_at'>): Promise<TechnicalSheet> {
  return read(await fetch(`${API_URL}/api/admin/technical-sheets/${encodeURIComponent(code)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Apetit-Admin-Key': adminKey }, body: JSON.stringify(payload) }), 'Não foi possível salvar a ficha técnica.')
}

export async function deleteTechnicalSheet(adminKey: string, code: string): Promise<void> {
  await read(await fetch(`${API_URL}/api/admin/technical-sheets/${encodeURIComponent(code)}`, { method: 'DELETE', headers: { 'X-Apetit-Admin-Key': adminKey } }), 'Não foi possível excluir a ficha técnica.')
}

export async function previewTechnicalSheetImport(adminKey: string, file: File): Promise<TechnicalSheetImportPreview> {
  const body = new FormData(); body.set('file', file)
  return read(await fetch(`${API_URL}/api/admin/technical-sheets/imports/preview`, { method: 'POST', headers: { 'X-Apetit-Admin-Key': adminKey }, body }), 'Não foi possível validar o arquivo de fichas técnicas.')
}

export async function publishTechnicalSheetImport(adminKey: string, previewId: string): Promise<TechnicalSheetImportResult> {
  return read(await fetch(`${API_URL}/api/admin/technical-sheets/imports/${previewId}/publish`, { method: 'POST', headers: { 'X-Apetit-Admin-Key': adminKey } }), 'Não foi possível importar as fichas técnicas.')
}

export async function getAdminOverview(adminKey: string): Promise<AdminOverview> {
  return read(await fetch(`${API_URL}/api/admin/overview`, { headers: { 'X-Apetit-Admin-Key': adminKey } }), 'Não foi possível carregar a visão geral.')
}

export async function getExecutiveReportPdf(adminKey: string): Promise<Blob> {
  const response = await fetch(`${API_URL}/api/admin/overview.pdf`, {
    headers: { 'X-Apetit-Admin-Key': adminKey },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(readError(payload, 'Não foi possível gerar o PDF.'))
  }
  return response.blob()
}

export type WeeklyMenuItem = {
  id:string; name:string; category:string; portion:string|null;
  technical_sheet_code:string|null;
  sheet_status:'complete'|'incomplete'|'missing'|'no_code';
  kcal:number|null; protein_g:number|null; carbs_g:number|null; fat_g:number|null
}
export type WeeklyMenu = {
  unit_id:string; week_start:string; week_end:string; meal_type:string;
  days:Array<{date:string;items:WeeklyMenuItem[]}>;
  summary:{total_items:number;days_with_menu:number;complete:number;incomplete:number;missing:number}
}
export async function getWeeklyMenu(params:{unitId:string;weekStart:string;mealType:string;adminKey:string}):Promise<WeeklyMenu>{
  const query=new URLSearchParams({unit_id:params.unitId,week_start:params.weekStart,meal_type:params.mealType})
  return read(await fetch(`${API_URL}/api/admin/menus/week?${query}`,{
    headers:{'X-Apetit-Admin-Key':params.adminKey}
  }),'Não foi possível consultar o cardápio semanal.')
}

export async function getPublicationStatus(params:{unitId:string;mealType:string;start:string;end:string;adminKey:string}):Promise<PublicationStatus>{
 const query=new URLSearchParams({unit_id:params.unitId,meal_type:params.mealType,start:params.start,end:params.end})
 return read(await fetch(`${API_URL}/api/admin/menus/publication-status?${query}`,{headers:{'X-Apetit-Admin-Key':params.adminKey}}),'Não foi possível verificar publicações.')
}
