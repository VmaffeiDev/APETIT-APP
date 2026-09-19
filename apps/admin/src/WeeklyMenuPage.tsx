import { useEffect, useState } from 'react'
import { getWeeklyMenu, presentationAdminKey, WeeklyMenu } from './api'
import { DEMO_UNITS } from './demoUnits'

const monday = (value: Date) => {
  const d = new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12)
  d.setDate(d.getDate() - ((d.getDay()+6)%7))
  return d
}
const iso = (d:Date) => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')
const display = (s:string) => new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'}).format(new Date(s+'T12:00:00'))
const statusLabel:Record<string,string>={complete:'Ficha completa',incomplete:'Ficha incompleta',missing:'Ficha não cadastrada',no_code:'Sem código'}
const categoryLabel:Record<string,string>={prato_principal:'Prato principal',opcao_prato_principal:'Opção principal',guarnicao:'Guarnição',arroz:'Arroz',feijao:'Feijão',salada:'Salada',sobremesa:'Sobremesa',bebida:'Bebida'}
export function WeeklyMenuPage({initialUnitId}:{initialUnitId?:string}){
  const [unitId,setUnitId]=useState(DEMO_UNITS.some(u=>u.unitId===initialUnitId)?initialUnitId!:DEMO_UNITS[0].unitId)
  const [week,setWeek]=useState(iso(monday(new Date())))
  const [mealType,setMealType]=useState('almoco')
  const [data,setData]=useState<WeeklyMenu|null>(null)
  const [busy,setBusy]=useState(true)
  const [error,setError]=useState('')
  useEffect(()=>{
    let cancelled=false
    setBusy(true);setError('');setData(null)
    getWeeklyMenu({unitId,weekStart:week,mealType,adminKey:presentationAdminKey})
      .then(result=>{if(!cancelled)setData(result)})
      .catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Erro ao carregar cardápio.')})
      .finally(()=>{if(!cancelled)setBusy(false)})
    return()=>{cancelled=true}
  },[unitId,week,mealType])
  const changeWeek=(delta:number)=>{
    const d=new Date(week+'T12:00:00');d.setDate(d.getDate()+delta*7);setWeek(iso(d))
  }
  const unit=DEMO_UNITS.find(u=>u.unitId===unitId)
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">A</span><div><strong>APETIT</strong><small>Admin</small></div></div>
      <nav>
        <button className="nav-item" onClick={()=>window.location.hash='visao-geral'}>⌂ Visão geral</button>
        <button className="nav-item active" onClick={()=>window.location.hash='cardapios'}>▣ Cardápios</button>
        <button className="nav-item" onClick={()=>window.location.hash='fichas-tecnicas'}>⌘ Fichas técnicas</button>
        <button className="nav-item" onClick={()=>window.location.hash='unidades'}>□ Unidades</button>
      </nav>
    </aside>
    <main className="main">
      <header className="topbar"><div><span className="eyebrow">OPERAÇÃO · CARDÁPIOS</span><h1>Calendário semanal</h1><p>Preparações publicadas por unidade e cobertura de fichas técnicas.</p></div><span className="badge">DEMONSTRAÇÃO</span></header>
      <section className="card content-card weekly-controls">
        <label><span>Unidade</span><select value={unitId} onChange={e=>setUnitId(e.target.value)}>{DEMO_UNITS.map(u=><option value={u.unitId} key={u.unitId}>{u.company}</option>)}</select></label>
        <label><span>Refeição</span><select value={mealType} onChange={e=>setMealType(e.target.value)}><option value="almoco">Almoço</option><option value="jantar">Jantar</option><option value="cafe">Café</option></select></label>
        <div className="weekly-step"><button className="secondary" onClick={()=>changeWeek(-1)}>← Anterior</button><strong>{data?.week_start??week} — {data?.week_end??'·'}</strong><button className="secondary" onClick={()=>changeWeek(1)}>Próxima →</button></div>
        <button className="secondary" onClick={()=>setWeek(iso(monday(new Date())))}>Semana atual</button>
        <button className="primary" onClick={()=>window.location.hash='cardapios'}>Importar cardápio</button>
      </section>
      <p className="helper">A consulta mostra apenas datas efetivamente publicadas. Uma semana vazia não recebe pratos de outra data.</p>
      {error&&<div className="alert error">{error}</div>}
      {busy&&<p>Carregando cardápio semanal...</p>}
      {data&&<><section className="executive-kpis">
        <article className="kpi-card"><small>Dias com cardápio</small><strong>{data.summary.days_with_menu}/7</strong></article>
        <article className="kpi-card"><small>Itens publicados</small><strong>{data.summary.total_items}</strong></article>
        <article className="kpi-card"><small>Ficha completa</small><strong>{data.summary.complete}</strong></article>
        <article className="kpi-card"><small>Requer revisão</small><strong>{data.summary.incomplete+data.summary.missing}</strong></article>
      </section>
      <section className="weekly-grid">{data.days.map(day=><article className="card weekly-day" key={day.date}>
        <div className="weekly-day-head"><strong>{display(day.date)}</strong><span className="badge soft">{day.items.length} itens</span></div>
        {day.items.length===0?<div className="weekly-empty">Sem cardápio publicado para este dia.</div>:<div className="weekly-items">{day.items.map(item=><div className="weekly-item" key={item.id}>
          <div><small>{categoryLabel[item.category]??item.category}</small><strong>{item.name}</strong><span>{item.portion??'Porção não informada'}{item.kcal!=null?` · ${item.kcal} kcal`:''}</span></div>
          <span className={item.sheet_status==='complete'?'weekly-status complete':'weekly-status review'}>{statusLabel[item.sheet_status]}{item.technical_sheet_code?` · ${item.technical_sheet_code}`:''}</span>
        </div>)}</div>}
      </article>)}</section>
      <section className="card content-card"><h2>Próximas ações · {unit?.company}</h2><p>Itens sem ficha cadastrada ou com macros incompletos exigem revisão antes de serem usados como dados nutricionais confiáveis.</p><div className="panel-actions"><button className="secondary" onClick={()=>window.location.hash='fichas-tecnicas'}>Revisar fichas</button><button className="secondary" onClick={()=>window.location.hash=`unidade/${unitId}`}>Abrir unidade</button></div></section></>}
    </main>
  </div>
}
