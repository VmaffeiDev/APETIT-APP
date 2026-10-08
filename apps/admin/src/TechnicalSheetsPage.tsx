import { useEffect, useMemo, useState } from 'react'
import { AdminUser, getAdminToken, getTechnicalSheet, getTechnicalSheetCoverage, isPresentationMode, listTechnicalSheets, presentationAdminKey, saveTechnicalSheet, TechnicalSheet, TechnicalSheetCoverage, TechnicalSheetSummary } from './api'
import { filterUnitsForUser, hasAdminPermission } from './access'
import { DEMO_UNITS } from './demoUnits'

const emptySheet: Omit<TechnicalSheet, 'code' | 'updated_at'> = {
  name: '', category: '', portion_quantity: null, portion_unit: 'g', kcal: null,
  protein_g: null, carbs_g: null, fat_g: null, ingredients: [], allergens: [],
}

const n = (value: string) => value.trim() === '' ? null : Number(value)

const allergenStatusLabel = (status:string) => {
  if (status === 'may_contain') return 'pode conter'
  if (status === 'free_from') return 'livre de'
  return 'contém'
}

const allergenStatusValue = (status:string): 'contains' | 'may_contain' | 'free_from' => {
  const value=status.trim().toLowerCase()
  if (value === 'pode conter' || value === 'may_contain') return 'may_contain'
  if (value === 'livre de' || value === 'free_from') return 'free_from'
  return 'contains'
}

export function TechnicalSheetsPage({user}:{user:AdminUser|null}) {
  const [adminKey, setAdminKey] = useState(presentationAdminKey)
  const canManage=hasAdminPermission(user,'manage_sheets')
  const canPublishMenus=hasAdminPermission(user,'publish_menu')
  const authenticated=Boolean(getAdminToken())
  const allowedUnits=useMemo(()=>filterUnitsForUser(DEMO_UNITS,user),[user])
  const [unitId,setUnitId]=useState(allowedUnits[0]?.unitId ?? '')
  const [coverage,setCoverage]=useState<TechnicalSheetCoverage|null>(null)
  const [coverageBusy,setCoverageBusy]=useState(false)
  const [coverageMessage,setCoverageMessage]=useState('')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<TechnicalSheetSummary[]>([])
  const [code, setCode] = useState('')
  const [form, setForm] = useState(emptySheet)
  const [ingredientsText, setIngredientsText] = useState('')
  const [allergensText, setAllergensText] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!authenticated && !adminKey.trim()) return
    setBusy(true); setMessage('')
    try { setItems((await listTechnicalSheets(adminKey.trim(), search)).items) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao carregar fichas.') }
    finally { setBusy(false) }
  }

  async function loadCoverage(targetUnitId=unitId) {
    if (!targetUnitId || (!authenticated && !adminKey.trim())) return
    setCoverageBusy(true); setCoverageMessage('')
    try { setCoverage(await getTechnicalSheetCoverage(adminKey.trim(),targetUnitId)) }
    catch (error) { setCoverageMessage(error instanceof Error ? error.message : 'Falha ao carregar cobertura.') }
    finally { setCoverageBusy(false) }
  }

  function csv(value:unknown){
    const text=String(value ?? '')
    return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g,'""')}"` : text
  }

  function downloadPendingCsv(){
    if(!coverage) return
    const rows=coverage.pending.filter(item=>item.status==='missing'&&item.code)
    if(!rows.length){setCoverageMessage('Não há códigos pendentes com ficha ausente para exportar.');return}
    const header=['codigo','preparacao','categoria','porcao','unidade','kcal','proteina_g','carboidratos_g','gordura_g','ingredientes','alergenicos']
    const body=rows.map(item=>[
      item.code,item.name,item.category ?? '','','','','','','',''
    ].map(csv).join(';'))
    const content='\uFEFF'+[header.join(';'),...body].join('\n')
    const blob=new Blob([content],{type:'text/csv;charset=utf-8'})
    const url=URL.createObjectURL(blob)
    const link=document.createElement('a')
    link.href=url
    link.download=`fichas-pendentes-${unitId}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function open(itemCode: string) {
    setBusy(true); setMessage('')
    try {
      const sheet = await getTechnicalSheet(adminKey.trim(), itemCode)
      setCode(sheet.code)
      setForm({ name: sheet.name, category: sheet.category, portion_quantity: sheet.portion_quantity, portion_unit: sheet.portion_unit, kcal: sheet.kcal, protein_g: sheet.protein_g, carbs_g: sheet.carbs_g, fat_g: sheet.fat_g, ingredients: sheet.ingredients, allergens: sheet.allergens })
      setIngredientsText(sheet.ingredients.join('\n'))
      setAllergensText(sheet.allergens.map((a) => `${a.allergen}: ${allergenStatusLabel(a.status)}`).join('\n'))
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao abrir ficha.') }
    finally { setBusy(false) }
  }

  function reset() {
    setCode(''); setForm(emptySheet); setIngredientsText(''); setAllergensText(''); setMessage('')
  }

  async function save() {
    if (!canManage) { setMessage('Seu perfil possui acesso somente para consulta das fichas técnicas.'); return }
    if ((!authenticated && !adminKey.trim()) || !code.trim() || !form.name.trim()) { setMessage('Informe código e nome da preparação.'); return }
    setBusy(true); setMessage('')
    try {
      const payload = {
        ...form,
        ingredients: ingredientsText.split('\n').map((x) => x.trim()).filter(Boolean),
        allergens: allergensText.split('\n').map((line) => {
          const [allergen, status = 'contém'] = line.split(':').map((x) => x.trim())
          return { allergen, status: allergenStatusValue(status) }
        }).filter((x) => x.allergen),
      }
      await saveTechnicalSheet(adminKey.trim(), code.trim(), payload)
      setMessage('Ficha técnica salva. A associação já aparece na cobertura; republique o cardápio para atualizar o snapshot nutricional.')
      await load()
      await loadCoverage()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao salvar ficha.') }
    finally { setBusy(false) }
  }

  useEffect(() => { if (authenticated || adminKey) void load() }, [])
  useEffect(() => {
    if (!allowedUnits.some((unit)=>unit.unitId===unitId)) setUnitId(allowedUnits[0]?.unitId ?? '')
  }, [allowedUnits,unitId])
  useEffect(() => { if ((authenticated || adminKey) && unitId) void loadCoverage(unitId) }, [unitId])

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">A</span><div><strong>APETIT</strong><small>Admin</small></div></div>
      <nav>
        <button className="nav-item" onClick={() => { window.location.hash = 'visao-geral' }}>⌂ Visão geral</button>
        {canPublishMenus&&<button className="nav-item" onClick={() => { window.location.hash = 'cardapios' }}>▣ Cardápios</button>}
        <button className="nav-item active">⌘ Fichas técnicas</button>
        {canManage&&<button className="nav-item" onClick={() => { window.location.hash = 'importar-fichas' }}>↥ Importar fichas</button>}
        <button className="nav-item" onClick={() => { window.location.hash = 'feedbacks' }}>♡ Feedbacks</button>
        <button className="nav-item" onClick={() => { window.location.hash = 'unidades' }}>□ Unidades</button>
      </nav>
      <div className="privacy-note"><strong>Base nutricional</strong><p>Somente dados técnicos validados devem ser usados para alimentar recomendações.</p></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><span className="eyebrow">OPERAÇÃO · NUTRIÇÃO</span><h1>Fichas técnicas</h1><p>{canManage?'Cadastre composição, porção, ingredientes e alergênicos por código técnico.':'Consulte composição, porção, ingredientes e alergênicos cadastrados.'}</p></div><div style={{display:'flex',gap:8}}>{canManage?<><button className="secondary" onClick={() => { window.location.hash = 'importar-fichas' }}>Importar planilha</button><button className="primary" onClick={reset}>Nova ficha</button></>:<span className="badge soft">Somente leitura</span>}</div></header>

      <section className="card content-card">
        <div className="form-grid">
          {isPresentationMode ? <div className="full presentation-access"><strong>Modo apresentação</strong><span>Acesso administrativo liberado automaticamente neste ambiente.</span></div> : !authenticated ? <label className="full"><span>Chave administrativa</span><input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Chave de acesso da operação" /></label> : null}
          <label className="full"><span>Buscar</span><div style={{display:'flex', gap:8}}><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Código ou nome" /><button className="secondary" onClick={load}>Buscar</button></div></label>
        </div>
      </section>

      {allowedUnits.length>0&&<section className="card content-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">COBERTURA REAL DO CARDÁPIO</span>
            <h2>Fichas técnicas da unidade</h2>
            <p>Conta como coberto somente quando o código do item encontra uma ficha técnica cadastrada.</p>
            {coverage?.scope.period_start&&<small style={{display:'block',marginTop:6}}>Período analisado: {coverage.scope.period_start} → {coverage.scope.period_end} · {coverage.scope.file_name}</small>}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <select value={unitId} onChange={(e)=>setUnitId(e.target.value)}>
              {allowedUnits.map((unit)=><option key={unit.unitId} value={unit.unitId}>{unit.company}</option>)}
            </select>
            <button className="secondary" disabled={coverageBusy} onClick={()=>loadCoverage()}>{coverageBusy?'Atualizando...':'Atualizar'}</button>
          </div>
        </div>

        {coverage&&<><section className="metrics-grid">
          <div className="metric"><small>Cobertura real</small><strong>{coverage.summary.coverage_percent}%</strong><span>{coverage.summary.matched} de {coverage.summary.total_items} itens com ficha encontrada</span></div>
          <div className="metric"><small>Completas</small><strong>{coverage.summary.complete}</strong><span>{coverage.summary.complete_coverage_percent}% do cardápio com macros completos</span></div>
          <div className="metric"><small>Códigos sem ficha</small><strong>{coverage.summary.missing}</strong><span>itens cujo código ainda não existe na biblioteca</span></div>
          <div className="metric"><small>Sem código / incompletas</small><strong>{coverage.summary.no_code} / {coverage.summary.incomplete}</strong><span>exigem revisão da origem ou da ficha</span></div>
        </section>

        <div className="action-row">
          <span className="helper">Depois de cadastrar/importar as fichas, republique o período para gravar os valores nutricionais como snapshot do cardápio.</span>
          {canManage&&coverage.summary.missing>0&&<button className="secondary" onClick={downloadPendingCsv}>Baixar CSV dos códigos pendentes</button>}
          {canManage&&<button className="primary" onClick={()=>{window.location.hash='importar-fichas'}}>Importar fichas</button>}
        </div>

        <div className="section-heading"><div><h3>Pendências encontradas</h3><p>{coverage.pending_count} preparação(ões) única(s) precisam de atenção.</p></div></div>
        <div className="days-list">
          {coverage.pending.length?coverage.pending.slice(0,30).map((item,index)=><button
            key={`${item.status}-${item.code ?? 'sem-codigo'}-${item.name}-${index}`}
            className="choice"
            style={{textAlign:'left'}}
            onClick={()=>{if(item.code){setSearch(item.code); if(item.status==='incomplete') void open(item.code); else {setCode(item.code); setForm({...emptySheet,name:item.name,category:item.category}); setIngredientsText(''); setAllergensText('')}}}}
          >
            <strong>{item.name}</strong>
            <small style={{display:'block',marginTop:4}}>{item.code ?? 'SEM CÓDIGO'} · {item.status==='missing'?'ficha ausente':item.status==='no_code'?'código ausente':'ficha incompleta'} · {item.occurrences} ocorrência(s)</small>
          </button>):<p className="muted">Nenhuma pendência técnica nesta unidade.</p>}
        </div></>}

        {!!coverageMessage&&<div className="alert warning">{coverageMessage}</div>}
      </section>}

      <section className="metrics-grid">
        <div className="metric"><small>Fichas encontradas</small><strong>{items.length}</strong><span>cadastros técnicos</span></div>
        <div className="metric"><small>Ficha em edição</small><strong>{code || 'Nova'}</strong><span>{form.name || 'Ainda sem nome'}</span></div>
      </section>

      <div style={{display:'grid', gridTemplateColumns:'minmax(260px,.8fr) minmax(420px,1.4fr)', gap:18}}>
        <section className="card content-card">
          <div className="section-heading"><div><h2>Biblioteca</h2><p>{canManage?'Clique para editar.':'Clique para visualizar.'}</p></div></div>
          <div className="days-list">{items.length ? items.map((item) => <button key={item.code} className="choice" style={{textAlign:'left'}} onClick={() => open(item.code)}><strong>{item.name}</strong><small style={{display:'block', marginTop:4}}>{item.code} · {item.kcal ?? '—'} kcal · {item.protein_g ?? '—'} g proteína</small></button>) : <p className="muted">Informe a chave e carregue as fichas.</p>}</div>
        </section>

        <section className="card content-card">
          <div className="section-heading"><div><h2>Dados da ficha</h2><p>Valores devem vir de uma fonte técnica validada.</p></div><span className="badge">{canManage?(code ? 'Edição' : 'Novo cadastro'):'Consulta'}</span></div>
          <div className="form-grid">
            <label><span>Código técnico</span><input readOnly={!canManage} value={code} onChange={(e) => setCode(e.target.value)} placeholder="06.03.01.258" /></label>
            <label><span>Preparação</span><input readOnly={!canManage} value={form.name} onChange={(e) => setForm({...form, name:e.target.value})} placeholder="Frango grelhado" /></label>
            <label><span>Categoria</span><input readOnly={!canManage} value={form.category ?? ''} onChange={(e) => setForm({...form, category:e.target.value})} placeholder="prato_principal" /></label>
            <label><span>Porção</span><div style={{display:'flex', gap:8}}><input type="number" readOnly={!canManage} value={form.portion_quantity ?? ''} onChange={(e) => setForm({...form, portion_quantity:n(e.target.value)})} /><input readOnly={!canManage} value={form.portion_unit ?? ''} onChange={(e) => setForm({...form, portion_unit:e.target.value})} placeholder="g" /></div></label>
            <label><span>Energia (kcal)</span><input type="number" readOnly={!canManage} value={form.kcal ?? ''} onChange={(e) => setForm({...form, kcal:n(e.target.value)})} /></label>
            <label><span>Proteína (g)</span><input type="number" readOnly={!canManage} value={form.protein_g ?? ''} onChange={(e) => setForm({...form, protein_g:n(e.target.value)})} /></label>
            <label><span>Carboidratos (g)</span><input type="number" readOnly={!canManage} value={form.carbs_g ?? ''} onChange={(e) => setForm({...form, carbs_g:n(e.target.value)})} /></label>
            <label><span>Gorduras (g)</span><input type="number" readOnly={!canManage} value={form.fat_g ?? ''} onChange={(e) => setForm({...form, fat_g:n(e.target.value)})} /></label>
            <label className="full"><span>Ingredientes · um por linha</span><textarea style={{width:'100%',boxSizing:'border-box'}} readOnly={!canManage} value={ingredientsText} onChange={(e) => setIngredientsText(e.target.value)} rows={6} placeholder={'Peito de frango\nAzeite\nErvas'} /></label>
            <label className="full"><span>Alergênicos</span><textarea style={{width:'100%',boxSizing:'border-box'}} readOnly={!canManage} value={allergensText} onChange={(e) => setAllergensText(e.target.value)} rows={5} placeholder={'leite: contém\nsoja: pode conter\nglúten: livre de'} /></label>
          </div>
          {!!message && <div className="alert warning">{message}</div>}
          <div className="action-row"><span className="helper">Ao publicar um cardápio, o código puxa estes valores como snapshot.</span>{canManage&&<button className="primary" disabled={busy} onClick={save}>{busy ? 'Salvando...' : 'Salvar ficha técnica'}</button>}</div>
        </section>
      </div>
    </main>
  </div>
}
