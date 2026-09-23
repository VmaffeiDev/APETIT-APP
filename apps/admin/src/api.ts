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
const SESSION_KEY='apetit_admin_session'
export const getAdminToken=()=>localStorage.getItem(SESSION_KEY)??''
export const setAdminToken=(token:string)=>token?localStorage.setItem(SESSION_KEY,token):localStorage.removeItem(SESSION_KEY)
function adminHeaders(adminKey:string,extra:Record<string,string>={}):Record<string,string>{const token=getAdminToken();return {...extra,...(token?{Authorization:`Bearer ${token}`}:(adminKey?{'X-Apetit-Admin-Key':adminKey}:{}))}}
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
  if (response.status === 401 && getAdminToken()) {
    setAdminToken('')
    window.dispatchEvent(new Event('apetit-admin-session-expired'))
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(readError(payload, fallback))
  return payload as T
}

export async function previewMenu(params: { unitId: string; mealType: string; adminKey: string; file: File }): Promise<MenuPreview> {
  const body = new FormData(); body.set('unit_id', params.unitId); body.set('meal_type', params.mealType); body.set('file', params.file)
  return read(await fetch(`${API_URL}/api/admin/menu-imports/preview`, { method: 'POST', headers: adminHeaders(params.adminKey), body }), 'Não foi possível validar o cardápio.')
}

export async function publishMenu(params: { previewId: string; month: number; year: number; adminKey: string; replaceExisting?:boolean; operatorLabel:string }): Promise<PublishResult> {
  return read(await fetch(`${API_URL}/api/admin/menu-imports/${params.previewId}/publish`, { method: 'POST', headers: adminHeaders(params.adminKey,{'Content-Type':'application/json'}), body: JSON.stringify({ month: params.month, year: params.year, confirm_period: true, replace_existing: params.replaceExisting ?? false, operator_label:params.operatorLabel }) }), 'Não foi possível publicar o cardápio.')
}

export async function getFeedbackSummary(params: { unitId: string; restaurantId?: string; start: string; end: string; adminKey: string }): Promise<FeedbackSummary> {
  const query = new URLSearchParams({ unit_id: params.unitId, start: params.start, end: params.end }); if (params.restaurantId?.trim()) query.set('restaurant_id', params.restaurantId.trim())
  return read(await fetch(`${API_URL}/api/admin/feedback/summary?${query.toString()}`, { headers: adminHeaders(params.adminKey) }), 'Não foi possível carregar os feedbacks.')
}

export async function listTechnicalSheets(adminKey: string, search = ''): Promise<{ items: TechnicalSheetSummary[]; count: number }> {
  const query = new URLSearchParams({ search })
  return read(await fetch(`${API_URL}/api/admin/technical-sheets?${query.toString()}`, { headers: adminHeaders(adminKey) }), 'Não foi possível carregar as fichas técnicas.')
}

export async function getTechnicalSheet(adminKey: string, code: string): Promise<TechnicalSheet> {
  return read(await fetch(`${API_URL}/api/admin/technical-sheets/${encodeURIComponent(code)}`, { headers: adminHeaders(adminKey) }), 'Não foi possível carregar a ficha técnica.')
}

export async function saveTechnicalSheet(adminKey: string, code: string, payload: Omit<TechnicalSheet, 'code' | 'updated_at'>): Promise<TechnicalSheet> {
  return read(await fetch(`${API_URL}/api/admin/technical-sheets/${encodeURIComponent(code)}`, { method: 'PUT', headers: adminHeaders(adminKey,{'Content-Type':'application/json'}), body: JSON.stringify(payload) }), 'Não foi possível salvar a ficha técnica.')
}

export async function deleteTechnicalSheet(adminKey: string, code: string): Promise<void> {
  await read(await fetch(`${API_URL}/api/admin/technical-sheets/${encodeURIComponent(code)}`, { method: 'DELETE', headers: adminHeaders(adminKey) }), 'Não foi possível excluir a ficha técnica.')
}

export async function previewTechnicalSheetImport(adminKey: string, file: File): Promise<TechnicalSheetImportPreview> {
  const body = new FormData(); body.set('file', file)
  return read(await fetch(`${API_URL}/api/admin/technical-sheets/imports/preview`, { method: 'POST', headers: adminHeaders(adminKey), body }), 'Não foi possível validar o arquivo de fichas técnicas.')
}

export async function publishTechnicalSheetImport(adminKey: string, previewId: string): Promise<TechnicalSheetImportResult> {
  return read(await fetch(`${API_URL}/api/admin/technical-sheets/imports/${previewId}/publish`, { method: 'POST', headers: adminHeaders(adminKey) }), 'Não foi possível importar as fichas técnicas.')
}

export async function getAdminOverview(adminKey: string): Promise<AdminOverview> {
  return read(await fetch(`${API_URL}/api/admin/overview`, { headers: adminHeaders(adminKey) }), 'Não foi possível carregar a visão geral.')
}

export async function getExecutiveReportPdf(adminKey: string): Promise<Blob> {
  const response = await fetch(`${API_URL}/api/admin/overview.pdf`, {
    headers: adminHeaders(adminKey),
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
    headers:adminHeaders(params.adminKey)
  }),'Não foi possível consultar o cardápio semanal.')
}

export async function getPublicationStatus(params:{unitId:string;mealType:string;start:string;end:string;adminKey:string}):Promise<PublicationStatus>{
 const query=new URLSearchParams({unit_id:params.unitId,meal_type:params.mealType,start:params.start,end:params.end})
 return read(await fetch(`${API_URL}/api/admin/menus/publication-status?${query}`,{headers:adminHeaders(params.adminKey)}),'Não foi possível verificar publicações.')
}

export type MenuHistoryEvent={
 id:string;file_name:string;meal_type:string|null;operator_label:string|null;operator_verified:boolean;
 operation_kind:'publication'|'correction'|'legacy_publication'|'restore'|'backup';
 period_start:string|null;period_end:string|null;item_count:number|null;
 replaced_dates:string[];published_at:string|null;restored_from:string|null
}
export async function getMenuHistory(params:{unitId:string;adminKey:string}):Promise<{unit_id:string;events:MenuHistoryEvent[]}>{
 const query=new URLSearchParams({unit_id:params.unitId})
 return read(await fetch(`${API_URL}/api/admin/menus/publication-history?${query}`,{
 headers:adminHeaders(params.adminKey)
 }),'Não foi possível carregar o histórico de publicações.')
}

export type VersionDish={name:string;category:string;standard_portion:string|null;technical_sheet_code:string|null;
 kcal:string|null;protein_g:string|null;carbs_g:string|null;fat_g:string|null;
 allergens:Array<{allergen:string;status:string}>}
export type MenuVersion={
 id:string;unit_id:string;meal_type:string|null;file_name:string;
 published_at:string|null;operation_kind:string|null;operator_label:string|null;
 restorable:boolean;provenance:string|null;
 expected_current:Array<{date:string;menu_import_id:string}>;
 days:Array<{date:string;meal_type:string;items:VersionDish[]}>;
 comparison:Array<{date:string;current_published:boolean;same:boolean;
 only_in_version:VersionDish[];only_in_current:VersionDish[]}>
}
export async function getMenuVersion(params:{unitId:string;versionId:string;adminKey:string}):Promise<MenuVersion>{
 const query=new URLSearchParams({unit_id:params.unitId})
 return read(await fetch(`${API_URL}/api/admin/menus/versions/${encodeURIComponent(params.versionId)}?${query}`,{
 headers:adminHeaders(params.adminKey)
 }),'Não foi possível abrir esta versão.')
}
export async function restoreMenuVersion(params:{unitId:string;version:MenuVersion;operatorLabel:string;adminKey:string}):Promise<{status:string;menu_import_id:string;days:number}>{
 return read(await fetch(`${API_URL}/api/admin/menus/versions/${encodeURIComponent(params.version.id)}/restore`,{
 method:'POST',
 headers:adminHeaders(params.adminKey,{'Content-Type':'application/json'}),
 body:JSON.stringify({unit_id:params.unitId,operator_label:params.operatorLabel,confirm_restore:true,
 expected_current:params.version.expected_current})
 }),'Não foi possível restaurar o cardápio.')
}

export type AdminUser={id:string|null;name:string;email:string|null;role:'admin'|'operacao'|'nutricao'|'visualizacao';presentation?:boolean;active?:boolean;last_login_at?:string|null;unit_ids?:string[]}
export async function adminLogin(email:string,password:string):Promise<{token:string;expires_at:string;user:AdminUser}>{
 return read(await fetch(`${API_URL}/api/admin/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})}),'Não foi possível entrar.')
}
export async function adminMe():Promise<AdminUser>{
 return read(await fetch(`${API_URL}/api/admin/auth/me`,{headers:adminHeaders('')}),'Sessão inválida.')
}
export async function adminLogout():Promise<void>{
 try { await read(await fetch(`${API_URL}/api/admin/auth/logout`,{method:'POST',headers:adminHeaders('')}),'Não foi possível sair.') }
 finally { setAdminToken(''); window.dispatchEvent(new Event('apetit-admin-session-expired')) }
}
export async function listAdminUsers():Promise<{users:AdminUser[]}>{
 return read(await fetch(`${API_URL}/api/admin/users`,{headers:adminHeaders(presentationAdminKey)}),'Não foi possível carregar usuários.')
}
export async function createAdminUser(payload:{name:string;email:string;password:string;role:string;unit_ids:string[]}):Promise<AdminUser>{
 return read(await fetch(`${API_URL}/api/admin/users`,{method:'POST',headers:adminHeaders(presentationAdminKey,{'Content-Type':'application/json'}),body:JSON.stringify(payload)}),'Não foi possível criar o usuário.')
}

export async function updateAdminUserAccess(userId:string,role:string,unit_ids:string[]):Promise<void>{
 await read(await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(userId)}/access`,{method:'PATCH',headers:adminHeaders(presentationAdminKey,{'Content-Type':'application/json'}),body:JSON.stringify({role,unit_ids})}),'Não foi possível atualizar as permissões.')
}

export async function bootstrapDemoAdmin(payload:{name:string;email:string;password:string}):Promise<{token:string;expires_at:string;user:AdminUser}>{
 return read(await fetch(`${API_URL}/api/admin/auth/bootstrap-demo`,{method:'POST',headers:{'Content-Type':'application/json','X-Apetit-Admin-Key':'presentation'},body:JSON.stringify({...payload,role:'admin',unit_ids:[]})}),'Não foi possível criar o primeiro administrador.')
}

export async function setAdminUserActive(userId:string,active:boolean):Promise<AdminUser>{
 return read(await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(userId)}/status`,{method:'PATCH',headers:adminHeaders(presentationAdminKey,{'Content-Type':'application/json'}),body:JSON.stringify({active})}),'Não foi possível alterar o acesso.')
}
export async function resetAdminUserPassword(userId:string,password:string):Promise<void>{
 await read(await fetch(`${API_URL}/api/admin/users/${encodeURIComponent(userId)}/reset-password`,{method:'POST',headers:adminHeaders(presentationAdminKey,{'Content-Type':'application/json'}),body:JSON.stringify({password})}),'Não foi possível redefinir a senha.')
}
export type AdminAuditEvent={id:string;action:string;resource_type:string;resource_id:string|null;metadata:Record<string,unknown>;created_at:string;actor_name:string|null;actor_email:string|null}
export async function getAdminAudit():Promise<{events:AdminAuditEvent[]}>{
 return read(await fetch(`${API_URL}/api/admin/audit`,{headers:adminHeaders(presentationAdminKey)}),'Não foi possível consultar auditoria.')
}

export async function requestAdminPasswordRecovery(email:string):Promise<{status:string;message:string}>{
 return read(await fetch(`${API_URL}/api/admin/auth/recovery/request`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})}), "Não foi possível solicitar a recuperação.")
}
export async function confirmAdminPasswordRecovery(email:string,code:string,newPassword:string):Promise<{status:string;message:string}>{
 return read(await fetch(`${API_URL}/api/admin/auth/recovery/confirm`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,code,new_password:newPassword})}), "Não foi possível redefinir a senha.")
}