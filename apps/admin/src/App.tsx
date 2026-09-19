import { DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import { isPresentationMode, MenuPreview, presentationAdminKey, PublicationStatus, PublishResult, getPublicationStatus, previewMenu, publishMenu } from './api'
import { DEMO_UNITS } from './demoUnits'

type Stage = 'upload' | 'preview' | 'published'

const categoryLabel: Record<string, string> = {
  prato_principal: 'Prato principal',
  opcao_prato_principal: 'Opção ao prato principal',
  guarnicao: 'Guarnição',
  salada: 'Salada',
  sobremesa: 'Sobremesa',
  arroz: 'Arroz',
  feijao: 'Feijão',
  bebida: 'Bebida',
  acompanhamento: 'Acompanhamento',
}

const sheetStatusLabel = {
  complete: 'Ficha completa',
  incomplete: 'Ficha incompleta',
  missing: 'Ficha não cadastrada',
  no_code: 'Sem código',
}

function App() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [unitId, setUnitId] = useState(DEMO_UNITS[0].unitId)
  const [mealType, setMealType] = useState('almoco')
  const [adminKey, setAdminKey] = useState(presentationAdminKey)
  const [preview, setPreview] = useState<MenuPreview | null>(null)
  const [month, setMonth] = useState<number>(new Date().getMonth()+1)
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [publicationStatus,setPublicationStatus]=useState<PublicationStatus|null>(null)
  const [statusError,setStatusError]=useState('')
  const [statusBusy,setStatusBusy]=useState(false)
  const [replaceExisting,setReplaceExisting]=useState(false)
  const [statusRevision,setStatusRevision]=useState(0)
  const [operatorLabel,setOperatorLabel]=useState('')

  const selectedUnit = DEMO_UNITS.find((unit) => unit.unitId === unitId) ?? DEMO_UNITS[0]

  useEffect(() => {
    let cancelled=false
    const start=`${year}-${String(month).padStart(2,'0')}-01`
    const lastDay=new Date(year,month,0).getDate()
    const end=`${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
    setPublicationStatus(null);setStatusError('');setStatusBusy(true);setReplaceExisting(false)
    getPublicationStatus({unitId,mealType,start,end,adminKey})
      .then(result=>{if(!cancelled)setPublicationStatus(result)})
      .catch(e=>{if(!cancelled)setStatusError(e instanceof Error?e.message:'Não foi possível verificar publicações.')})
      .finally(()=>{if(!cancelled)setStatusBusy(false)})
    return()=>{cancelled=true}
  },[unitId,mealType,month,year,adminKey,statusRevision])

  const overlappingDates = useMemo(()=>{
    if(!preview||!publicationStatus)return []
    const published=new Set(publicationStatus.published_days.map(day=>day.date))
    return preview.days.map(day=>`${year}-${String(month).padStart(2,'0')}-${String(day.day).padStart(2,'0')}`).filter(date=>published.has(date))
  },[preview,publicationStatus,month,year])

  const publicationNotice = <div className="publication-notice">
    <strong>{statusBusy?'Verificando publicações...':publicationStatus?.published_days.length
      ?`✓ ${publicationStatus.published_days.length} dia(s) já publicado(s) neste mês`
      :'Nenhum dia publicado neste mês para esta unidade e refeição.'}</strong>
    <p>Unidade: {DEMO_UNITS.find(unit=>unit.unitId===unitId)?.company} · {String(month).padStart(2,'0')}/{year} · {mealType}</p>
    {publicationStatus && publicationStatus.published_days.length>0 && <div className="publication-days">
      {publicationStatus.published_days.map(day=><span key={day.date} title={day.file_name}>{day.date.slice(8,10)}/{day.date.slice(5,7)} · Publicado</span>)}
    </div>}
    {statusError && <p className="publication-error">{statusError} A proteção contra duplicação continua ativa ao publicar.</p>}
  </div>

  const summary = useMemo(() => {
    if (!preview) return null
    const fallbackMissing = preview.days.flatMap((day) => day.items).filter((item) => !item.technical_sheet_code).length
    return preview.technical_sheet_coverage ?? { complete: 0, incomplete: 0, missing: 0, no_code: fallbackMissing }
  }, [preview])

  function chooseFile(selected: File | null) {
    if (!selected) return
    const extension = selected.name.toLowerCase().split('.').pop()
    if (!['xlsx', 'csv'].includes(extension ?? '')) {
      setError('Envie um arquivo .xlsx ou .csv.')
      return
    }
    setFile(selected)
    setError('')
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    chooseFile(event.dataTransfer.files?.[0] ?? null)
  }

  async function handlePreview() {
    if (!file || !unitId.trim() || !adminKey.trim()) {
      setError('Informe a unidade, a chave administrativa e selecione a planilha.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await previewMenu({ unitId: unitId.trim(), mealType, adminKey: adminKey.trim(), file })
      setPreview(result)
      setReplaceExisting(false)
      if (result.suggested_month) setMonth(result.suggested_month)
      setStage('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao validar o arquivo.')
    } finally {
      setBusy(false)
    }
  }

  async function handlePublish() {
    if (!preview) return
    if(operatorLabel.trim().length<2){setError('Informe seu nome para registrar quem declarou a publicação.');return}
    if(overlappingDates.length && !replaceExisting){setError('Este período já possui cardápio publicado. Confira as datas e confirme a substituição somente se for uma correção.');return}
    setBusy(true)
    setError('')
    try {
      const result = await publishMenu({ previewId: preview.preview_id, month, year, adminKey: adminKey.trim(),replaceExisting,operatorLabel:operatorLabel.trim() })
      setPublishResult(result)
      setStage('published')
      setStatusRevision(value=>value+1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao publicar o cardápio.')
    } finally {
      setBusy(false)
    }
  }

  function restart() {
    setStage('upload')
    setFile(null)
    setPreview(null)
    setPublishResult(null)
    setError('')
    setReplaceExisting(false)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">A</span><div><strong>APETIT</strong><small>Admin</small></div></div>
        <nav>
          <button className="nav-item" onClick={() => { window.location.hash = 'visao-geral' }}><span>⌂</span>Visão geral</button>
          <button className="nav-item active"><span>▣</span>Cardápios</button>
          <button className="nav-item" onClick={() => {window.location.hash=`historico-cardapios/${unitId}`}}>◷ Histórico de publicações</button>
          <button className="nav-item" onClick={() => { window.location.hash = `calendario-cardapios/${unitId}` }}>▦ Calendário semanal</button>
          <button className="nav-item" onClick={() => { window.location.hash = 'importar-fichas' }}><span>↥</span>Importações</button>
          <button className="nav-item" onClick={() => { window.location.hash = 'fichas-tecnicas' }}><span>⌘</span>Fichas técnicas</button>
          <div className="nav-label">Experiência</div>
          <button className="nav-item" onClick={() => { window.location.hash = 'feedbacks' }}><span>♡</span>Feedbacks</button>
          <button className="nav-item" onClick={() => { window.location.hash = 'feedbacks' }}><span>⌁</span>Satisfação</button>
          <div className="nav-label">Gestão</div>
          <button className="nav-item" onClick={() => { window.location.hash = 'unidades' }}><span>□</span>Unidades</button>
          <button className="nav-item"><span>◫</span>Empresas</button>
          <button className="nav-item" onClick={() => { window.location.hash = 'usuarios' }}><span>♙</span>Usuários e acessos</button>
          <button className="nav-item"><span>⚙</span>Configurações</button>
        </nav>
        <div className="privacy-note"><strong>Privacidade por padrão</strong><p>Prescrições e histórico alimentar individual não aparecem neste painel.</p></div>
      </aside>

      <main className="main">
        <header className="topbar"><div><span className="eyebrow">OPERAÇÃO · CARDÁPIOS</span><h1>Publicar cardápio semanal</h1><p>Valide a planilha antes de disponibilizar o cardápio para os funcionários.</p></div><div className="status-pill"><span className="status-dot" />API conectada</div></header>

        <div className="weekly-entry"><button className="secondary" onClick={() => { window.location.hash = `calendario-cardapios/${unitId}` }}>Ver cardápio semanal publicado →</button><button className="secondary" onClick={() => { window.location.hash = `historico-cardapios/${unitId}` }}>Histórico de publicações →</button></div>
        <div className="stepper">
          <div className={`step ${stage !== 'upload' ? 'done' : 'current'}`}><span>1</span><div><strong>Enviar arquivo</strong><small>XLSX ou CSV</small></div></div>
          <div className={`step ${stage === 'preview' ? 'current' : stage === 'published' ? 'done' : ''}`}><span>2</span><div><strong>Conferir</strong><small>Itens e período</small></div></div>
          <div className={`step ${stage === 'published' ? 'current done' : ''}`}><span>3</span><div><strong>Publicar</strong><small>Confirmar semana</small></div></div>
        </div>

        {stage === 'upload' && (
          <section className="card content-card">
            <div className="section-heading"><div><h2>Nova importação</h2><p>Use o arquivo de planejamento semanal da operação.</p></div><span className="badge">Demonstração</span></div>
            <div className="form-grid">
              <label><span>Unidade</span><select value={unitId} onChange={(e) => setUnitId(e.target.value)}>{DEMO_UNITS.map((unit) => <option key={unit.unitId} value={unit.unitId}>{unit.company} · {unit.unitName.replace(' — Demonstração', '')}</option>)}</select><small>Base fictícia temporária para apresentação.</small></label>
              <label><span>Refeição</span><select value={mealType} onChange={(e) => setMealType(e.target.value)}><option value="almoco">Almoço</option><option value="jantar">Jantar</option><option value="cafe">Café</option></select></label>
              <label className="full"><span>Refeitório da unidade</span><input value={selectedUnit.restaurantName} readOnly /></label>
              {isPresentationMode ? <div className="full presentation-access"><strong>Modo apresentação</strong><span>Acesso administrativo liberado automaticamente neste ambiente.</span></div> : <label className="full"><span>Chave administrativa</span><input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Chave de acesso da operação" /></label>}
            </div>
            <section className="card period-card"><div><h2>Verificar publicações existentes</h2><p>Selecione mês e ano antes de enviar outro cardápio para esta unidade.</p></div><div className="period-fields"><label><span>Mês</span><select value={month} onChange={e=>setMonth(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option value={i+1} key={i+1}>{String(i+1).padStart(2,'0')}</option>)}</select></label><label><span>Ano</span><input type="number" min="2020" max="2100" value={year} onChange={e=>setYear(Number(e.target.value))}/></label></div></section>
            {publicationNotice}
            <div className={`dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`} onDragOver={(e) => {e.preventDefault(); setDragging(true)}} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => fileInput.current?.click()}>
              <input ref={fileInput} hidden type="file" accept=".xlsx,.csv" onChange={(e) => chooseFile(e.target.files?.[0] ?? null)} />
              <div className="upload-icon">↥</div>
              {file ? <><strong>{file.name}</strong><p>{(file.size / 1024).toFixed(1)} KB · pronto para validar</p><span className="linkish">Trocar arquivo</span></> : <><strong>Arraste a planilha aqui</strong><p>ou clique para escolher um arquivo .xlsx ou .csv</p><span className="file-hint">Formato de planejamento da Apetit</span></>}
            </div>
            {error && <div className="alert error">{error}</div>}
            <div className="action-row"><span className="helper">Nada será publicado nesta etapa.</span><button className="primary" disabled={busy} onClick={handlePreview}>{busy ? 'Validando...' : 'Validar e visualizar'}</button></div>
          </section>
        )}

        {stage === 'preview' && preview && (
          <>
            <section className="metrics-grid">
              <div className="metric"><small>Arquivo</small><strong>{preview.file_name}</strong><span>{preview.day_count} dias reconhecidos</span></div>
              <div className="metric"><small>Ficha completa</small><strong>{summary?.complete ?? 0}</strong><span>prontos para recomendação</span></div>
              <div className="metric"><small>Ficha incompleta</small><strong>{summary?.incomplete ?? 0}</strong><span>revisar macros</span></div>
              <div className="metric"><small>Sem ficha</small><strong>{(summary?.missing ?? 0) + (summary?.no_code ?? 0)}</strong><span>sem base nutricional confiável</span></div>
            </section>

            {publicationNotice}
            {overlappingDates.length>0 && <div className="alert warning"><strong>Já publicado — possível duplicação</strong><p>Esta unidade e refeição já têm cardápio nas datas: {overlappingDates.map(date=>date.split('-').reverse().join('/')).join(', ')}.</p><p>Não publique novamente, a menos que esteja corrigindo o cardápio anterior.</p></div>}
            {preview.warnings.length > 0 && <div className="alert warning"><strong>Revise antes de publicar</strong>{preview.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}

            <section className="card period-card"><div><h2>Confirme o período</h2><p>A planilha informa o dia, mas mês e ano precisam ser confirmados pela operação.</p></div><div className="period-fields"><label><span>Mês</span><select value={month} onChange={(e) => setMonth(Number(e.target.value))}>{Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{String(i+1).padStart(2,'0')}</option>)}</select></label><label><span>Ano</span><input type="number" min="2020" max="2100" value={year} onChange={(e) => setYear(Number(e.target.value))} /></label></div></section>

            <section className="card content-card"><div className="section-heading"><div><h2>Prévia do cardápio</h2><p>Confira o que aparecerá no aplicativo e a cobertura das fichas técnicas.</p></div><span className="badge soft">{preview.meal_type}</span></div>
              <div className="days-list">{preview.days.map((day) => <details key={day.day} open><summary><div><strong>Dia {day.day}</strong><span>{day.items.length} itens</span></div><span className="chevron">⌄</span></summary><div className="items-table"><div className="table-row header"><span>Categoria</span><span>Prato</span><span>Porção</span><span>Ficha técnica</span></div>{day.items.map((item, index) => <div className="table-row" key={`${day.day}-${item.name}-${index}`}><span><i className="category-dot" />{categoryLabel[item.category] ?? item.category}</span><strong>{item.name}</strong><span>{item.portion ?? '—'}</span><span className={item.technical_sheet_status === 'complete' ? '' : 'muted'}>{item.technical_sheet_code ? `${item.technical_sheet_code} · ${sheetStatusLabel[item.technical_sheet_status ?? 'missing']}` : sheetStatusLabel.no_code}</span></div>)}</div></details>)}</div>
            </section>
            {error && <div className="alert error">{error}</div>}
            <label className="operator-field"><span>Funcionário responsável (nome informado pelo operador)</span><input value={operatorLabel} onChange={e=>setOperatorLabel(e.target.value)} maxLength={100} placeholder="Informe seu nome para registrar esta ação"/><small>O modo demonstração não possui login individual: este nome não é identidade verificada.</small></label>
            {overlappingDates.length>0 && <label className="replacement-confirm"><input type="checkbox" checked={replaceExisting} onChange={e=>setReplaceExisting(e.target.checked)}/><span>Estou corrigindo uma publicação existente e autorizo substituir os cardápios das datas indicadas.</span></label>}
            <div className="sticky-actions"><button className="secondary" onClick={() => setStage('upload')}>Voltar e trocar arquivo</button><div><small>Uma publicação já existente só será substituída mediante confirmação explícita.</small><button className="primary" disabled={busy||statusBusy||operatorLabel.trim().length<2||(overlappingDates.length>0&&!replaceExisting)} onClick={handlePublish}>{busy ? 'Publicando...' : 'Confirmar e publicar'}</button></div></div>
          </>
        )}

        {stage === 'published' && publishResult && (
          <section className="card success-card"><div className="success-icon">✓</div><span className="eyebrow">PUBLICAÇÃO CONCLUÍDA</span><h2>Cardápio disponível no aplicativo</h2><p>O período foi publicado e já pode ser consultado pelos funcionários da unidade.</p><div className="publish-summary"><div><small>Unidade</small><strong>{selectedUnit.company}</strong></div><div><small>Período</small><strong>{publishResult.period_start} → {publishResult.period_end}</strong></div><div><small>Itens</small><strong>{publishResult.item_count}</strong></div><div><small>Com ficha</small><strong>{publishResult.enriched_items ?? 0}</strong></div></div><button className="primary" onClick={restart}>Publicar outra semana</button></section>
        )}
      </main>
    </div>
  )
}

export default App
