import { useEffect, useState } from 'react'
import { getMenuHistory, MenuHistoryEvent, presentationAdminKey } from './api'
import { DEMO_UNITS } from './demoUnits'

const formatDate=(value:string|null)=>value?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short'}).format(new Date(value+'T12:00:00')):'—'
const formatTime=(value:string|null)=>value?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value)):'Data indisponível'
const mealLabel:Record<string,string>={almoco:'Almoço',jantar:'Jantar',cafe:'Café'}
const title=(event:MenuHistoryEvent)=>event.operation_kind==='correction'?'Correção de cardápio':event.operation_kind==='legacy_publication'?'Publicação anterior ao histórico':'Publicação de cardápio'

export function MenuHistoryPage({initialUnitId}:{initialUnitId?:string}){
  const [unitId,setUnitId]=useState(DEMO_UNITS.some(u=>u.unitId===initialUnitId)?initialUnitId!:DEMO_UNITS[0].unitId)
  const [events,setEvents]=useState<MenuHistoryEvent[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  useEffect(()=>{
    let cancelled=false
    setLoading(true);setError('');setEvents([])
    getMenuHistory({unitId,adminKey:presentationAdminKey}).then(result=>{
      if(!cancelled)setEvents(result.events)
    }).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Falha ao carregar o histórico.')})
      .finally(()=>{if(!cancelled)setLoading(false)})
    return()=>{cancelled=true}
  },[unitId])

  const selected=DEMO_UNITS.find(u=>u.unitId===unitId)
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">A</span><div><strong>APETIT</strong><small>Admin</small></div></div>
      <nav>
        <button className="nav-item" onClick={()=>window.location.hash='visao-geral'}>⌂ Visão geral</button>
        <button className="nav-item" onClick={()=>window.location.hash='cardapios'}>▣ Cardápios</button>
        <button className="nav-item active">◷ Histórico de publicações</button>
        <button className="nav-item" onClick={()=>window.location.hash='unidades'}>□ Unidades</button>
      </nav>
      <div className="privacy-note"><strong>Registro operacional</strong><p>Eventos registrados desde a implantação do histórico. Identificações declaradas não equivalem a login individual.</p></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div><span className="eyebrow">OPERAÇÃO · AUDITORIA</span><h1>Histórico de publicações</h1><p>Veja quando um cardápio foi publicado ou corrigido, para qual unidade e quem declarou a ação.</p></div>
        <span className="badge">DEMONSTRAÇÃO</span>
      </header>
      <section className="card content-card history-controls">
        <label><span>Unidade</span><select value={unitId} onChange={e=>setUnitId(e.target.value)}>{DEMO_UNITS.map(u=><option value={u.unitId} key={u.unitId}>{u.company}</option>)}</select></label>
        <button className="secondary" onClick={()=>window.location.hash=`calendario-cardapios/${unitId}`}>Ver calendário</button>
        <button className="primary" onClick={()=>window.location.hash='cardapios'}>Nova publicação</button>
      </section>
      <div className="alert warning"><strong>Identificação do operador</strong> A demo utiliza acesso administrativo compartilhado. O nome exibido é informado pela própria pessoa, não verificado por uma conta individual. Eventos anteriores a esta implantação podem não ter nome ou refeição registrados.</div>
      {loading&&<p>Carregando histórico de {selected?.company}...</p>}
      {error&&<div className="alert error">{error}</div>}
      {!loading&&!error&&<section className="card history-card">
        <div className="section-heading"><div><span className="eyebrow">REGISTRO CRONOLÓGICO</span><h2>{selected?.company} · {events.length} registro(s)</h2></div></div>
        {events.length===0?<p className="muted">Nenhuma publicação registrada para esta unidade.</p>:
        <div className="history-list">{events.map(event=><article className="history-event" key={event.id}>
          <div className="history-heading"><span className={event.operation_kind==='correction'?'badge':'badge soft'}>{title(event)}</span><time>{formatTime(event.published_at)}</time></div>
          <strong>{mealLabel[event.meal_type??'']??'Refeição não registrada'} · {formatDate(event.period_start)} a {formatDate(event.period_end)}</strong>
          <div className="history-details"><span>Arquivo: {event.file_name}</span><span>Itens: {event.item_count??'Não registrado'}</span><span>Operador: {event.operator_label?event.operator_label+' (nome declarado)':'Não registrado'}</span></div>
          {event.replaced_dates.length>0&&<p className="history-correction">Datas substituídas: {event.replaced_dates.map(formatDate).join(', ')}. O conteúdo antigo das preparações não está arquivado neste histórico.</p>}
          {event.operation_kind==='legacy_publication'&&<p className="helper">Registro anterior à implantação da auditoria detalhada.</p>}
        </article>)}</div>}
      </section>}
    </main>
  </div>
}
