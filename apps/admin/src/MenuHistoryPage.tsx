import { useEffect, useState } from 'react'
import { getMenuHistory, getMenuVersion, restoreMenuVersion, MenuHistoryEvent, MenuVersion, presentationAdminKey } from './api'
import { DEMO_UNITS } from './demoUnits'

const formatDate=(value:string|null)=>value?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short'}).format(new Date(value+'T12:00:00')):'—'
const formatTime=(value:string|null)=>value?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value)):'Data indisponível'
const mealLabel:Record<string,string>={almoco:'Almoço',jantar:'Jantar',cafe:'Café'}
const title=(event:MenuHistoryEvent)=>event.operation_kind==='backup'?'Backup anterior à substituição':event.operation_kind==='restore'?'Restauração de cardápio':event.operation_kind==='correction'?'Correção de cardápio':event.operation_kind==='legacy_publication'?'Publicação anterior ao histórico':'Publicação de cardápio'

export function MenuHistoryPage({initialUnitId}:{initialUnitId?:string}){
  const [unitId,setUnitId]=useState(DEMO_UNITS.some(u=>u.unitId===initialUnitId)?initialUnitId!:DEMO_UNITS[0].unitId)
  const [events,setEvents]=useState<MenuHistoryEvent[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [selectedVersion,setSelectedVersion]=useState<MenuVersion|null>(null)
  const [detailBusy,setDetailBusy]=useState(false)
  const [detailError,setDetailError]=useState('')
  const [operatorLabel,setOperatorLabel]=useState('')
  const [confirmRestore,setConfirmRestore]=useState(false)
  const [restoring,setRestoring]=useState(false)
  const [revision,setRevision]=useState(0)
  useEffect(()=>{
    let cancelled=false
    setLoading(true);setError('');setEvents([]);setSelectedVersion(null);setDetailError('')
    getMenuHistory({unitId,adminKey:presentationAdminKey}).then(result=>{
      if(!cancelled)setEvents(result.events)
    }).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Falha ao carregar o histórico.')})
      .finally(()=>{if(!cancelled)setLoading(false)})
    return()=>{cancelled=true}
  },[unitId,revision])

  async function showVersion(versionId:string){
    setDetailBusy(true);setDetailError('');setSelectedVersion(null)
    setConfirmRestore(false);setOperatorLabel('')
    try{setSelectedVersion(await getMenuVersion({unitId,versionId,adminKey:presentationAdminKey}))}
    catch(e){setDetailError(e instanceof Error?e.message:'Não foi possível carregar a versão.')}
    finally{setDetailBusy(false)}
  }
  async function restore(){
    if(!selectedVersion||!selectedVersion.restorable||!confirmRestore||operatorLabel.trim().length<2)return
    setRestoring(true);setDetailError('')
    try{
      await restoreMenuVersion({unitId,version:selectedVersion,operatorLabel:operatorLabel.trim(),adminKey:presentationAdminKey})
      setSelectedVersion(null);setRevision(n=>n+1)
    }catch(e){setDetailError(e instanceof Error?e.message:'Não foi possível restaurar esta versão.')}
    finally{setRestoring(false)}
  }

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
          <div className="history-details"><span>Arquivo: {event.file_name}</span><span>Itens: {event.item_count??'Não registrado'}</span><span>Operador: {event.operator_label?event.operator_label+(event.operator_verified?' (usuário verificado)':' (nome declarado)'):'Não registrado'}</span></div>
          {event.replaced_dates.length>0&&<p className="history-correction">Datas substituídas: {event.replaced_dates.map(formatDate).join(', ')}. As versões anteriores à implantação do arquivamento completo podem não ter os pratos antigos disponíveis.</p>}
          {event.operation_kind==='backup'&&<p className="helper">Cópia automática do cardápio vigente antes de uma correção ou restauração; o operador do backup não é identificado separadamente.</p>}
          {event.restored_from&&<p className="helper">Restaurada a partir da versão {event.restored_from.slice(0,8)}.</p>}
          <button className="secondary history-version-button" onClick={()=>showVersion(event.id)} disabled={detailBusy}>Ver versão e comparar pratos</button>
          {event.operation_kind==='legacy_publication'&&<p className="helper">Registro anterior à implantação da auditoria detalhada.</p>}
        </article>)}</div>}
      </section>}
      {detailError&&<div className="alert error">{detailError}</div>}
      {detailBusy&&<p>Carregando versão...</p>}
      {selectedVersion&&<section className="card history-card version-panel">
        <div className="section-heading">
          <div><span className="eyebrow">CONTROLE DE VERSÕES</span><h2>Versão {selectedVersion.id.slice(0,8)}</h2>
          <p>Compare o conteúdo salvo nesta publicação com o cardápio atualmente disponível.</p></div>
          <button className="secondary" onClick={()=>setSelectedVersion(null)}>Fechar</button>
        </div>
        {!selectedVersion.restorable&&<div className="alert warning"><strong>Versão histórica incompleta</strong>Esta publicação é anterior ao arquivamento completo. O conteúdo disponível pode ser parcial e não pode ser restaurado.</div>}
        {selectedVersion.restorable&&<div className="alert warning"><strong>Restauração com confirmação</strong>Restaurar republica TODOS os dias desta versão para esta unidade e refeição, substituindo os cardápios atuais dessas datas. A versão atual será preservada no histórico quando tiver sido arquivada integralmente.</div>}
        <div className="version-days">{selectedVersion.days.map(day=>{
          const diff=selectedVersion.comparison.find(row=>row.date===day.date)
          return <article className="version-day" key={day.date}>
            <div className="history-heading"><strong>{formatDate(day.date)} · {day.items.length} prato(s) na versão</strong><span className={diff?.same?'badge soft':'badge'}>{diff?.same?'Igual ao atual':'Diferenças encontradas'}</span></div>
            <div className="version-dishes">{day.items.map((item,index)=><div key={index}><strong>{item.name}</strong><small>{item.category} · {item.standard_portion??'Porção não informada'} · {item.technical_sheet_code??'Sem ficha'}</small></div>)}</div>
            {diff&&!diff.same&&<div className="version-diff">
              <p><strong>Somente nesta versão:</strong> {diff.only_in_version.map(i=>i.name).join(', ')||'Nenhum'}</p>
              <p><strong>Somente no atual:</strong> {diff.only_in_current.map(i=>i.name).join(', ')||'Nenhum'}</p>
              {!diff.current_published&&<p>Não há cardápio publicado atualmente nesta data.</p>}
              <small>A comparação considera também porção, código, valores nutricionais e alergênicos. Pratos de mesmo nome podem aparecer em ambos os grupos se esses dados mudaram.</small>
            </div>}
          </article>
        })}</div>
        {selectedVersion.restorable&&<>
          <label className="operator-field"><span>Seu nome para registrar a restauração (declarado)</span>
            <input value={operatorLabel} maxLength={100} onChange={e=>setOperatorLabel(e.target.value)} placeholder="Nome do operador"/>
            <small>A demo não verifica a identidade do operador por login individual.</small></label>
          <label className="replacement-confirm"><input type="checkbox" checked={confirmRestore} onChange={e=>setConfirmRestore(e.target.checked)}/>
            <span>Confirmo que quero republicar todos os dias desta versão e substituir os cardápios atuais dessas datas.</span></label>
          <button className="primary" disabled={restoring||!confirmRestore||operatorLabel.trim().length<2} onClick={restore}>{restoring?'Restaurando...':'Restaurar esta versão'}</button>
        </>}
      </section>}
    </main>
  </div>
}
