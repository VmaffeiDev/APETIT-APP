import { useEffect, useMemo, useState } from 'react'
import { AdminOverview, getAdminOverview, presentationAdminKey } from './api'
import { DEMO_UNITS } from './demoUnits'

type Props = { unitId: string }

function go(hash:string){ window.location.hash=hash }

export function UnitDetailPage({unitId}:Props){
  const [data,setData]=useState<AdminOverview|null>(null)
  const [error,setError]=useState('')

  useEffect(()=>{
    getAdminOverview(presentationAdminKey)
      .then(setData)
      .catch((e)=>setError(e instanceof Error ? e.message : 'Não foi possível carregar a unidade.'))
  },[unitId])

  const demo=DEMO_UNITS.find((item)=>item.unitId===unitId)
  const unit=useMemo(()=>data?.unit_comparison.find((item)=>item.unit_id===unitId),[data,unitId])

  const alerts=useMemo(()=>{
    if(!unit) return []
    const items:Array<{level:'high'|'medium';title:string;detail:string;hash:string;action:string}>=[]
    if(unit.technical_coverage_percent<80){
      items.push({
        level:unit.technical_coverage_percent<50?'high':'medium',
        title:'Cobertura técnica abaixo do desejado',
        detail:`${unit.technical_coverage_percent}% dos itens possuem ficha técnica associada.`,
        hash:'fichas-tecnicas',
        action:'Revisar fichas',
      })
    }
    if(unit.satisfaction!=null && unit.satisfaction<4){
      items.push({
        level:'high',
        title:'Satisfação requer atenção',
        detail:`Média ${unit.satisfaction.toFixed(1)} nos últimos 5 dias.`,
        hash:'feedbacks',
        action:'Ver feedbacks',
      })
    }
    if(unit.feedback_responses<5){
      items.push({
        level:'medium',
        title:'Baixo volume de feedback',
        detail:`Apenas ${unit.feedback_responses} respostas no período.`,
        hash:'feedbacks',
        action:'Abrir satisfação',
      })
    }
    if(unit.published_menus===0){
      items.push({
        level:'high',
        title:'Sem cardápio publicado',
        detail:'Nenhum cardápio publicado para esta unidade.',
        hash:'cardapios',
        action:'Publicar cardápio',
      })
    }
    return items
  },[unit])

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">A</span><div><strong>APETIT</strong><small>Admin</small></div></div>
      <nav>
        <button className="nav-item" onClick={()=>go('visao-geral')}><span>⌂</span>Visão geral</button>
        <button className="nav-item" onClick={()=>go('cardapios')}><span>▣</span>Cardápios</button>
        <button className="nav-item" onClick={()=>go('importar-fichas')}><span>↥</span>Importações</button>
        <button className="nav-item" onClick={()=>go('fichas-tecnicas')}><span>⌘</span>Fichas técnicas</button>
        <div className="nav-label">Experiência</div>
        <button className="nav-item" onClick={()=>go('feedbacks')}><span>♡</span>Feedbacks</button>
        <div className="nav-label">Gestão</div>
        <button className="nav-item active" onClick={()=>go('unidades')}><span>□</span>Unidades</button>
      </nav>
      <div className="privacy-note"><strong>Privacidade por padrão</strong><p>Esta tela usa somente indicadores agregados da unidade.</p></div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div>
          <span className="eyebrow">GESTÃO · UNIDADE</span>
          <h1>{unit?.company_name ?? demo?.company ?? 'Unidade'}</h1>
          <p>{unit?.unit_name ?? demo?.unitName ?? 'Carregando dados da unidade...'}</p>
        </div>
        <div className="topbar-actions">
          <button className="secondary" onClick={()=>go('unidades')}>← Voltar às unidades</button>
          <div className="status-pill"><span className="status-dot" />Operação ativa</div>
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}

      <section className="unit-detail-hero card">
        <div>
          <span className="badge">DEMO</span>
          <h2>Visão consolidada da unidade</h2>
          <p>Cardápios, qualidade técnica, satisfação e alertas em uma única tela.</p>
        </div>
        <div className="unit-restaurant">
          <small>Refeitório</small>
          <strong>{demo?.restaurantName ?? '—'}</strong>
        </div>
      </section>

      <section className="executive-kpis">
        <article className="kpi-card"><span className="kpi-icon">♡</span><small>Satisfação</small><strong>{unit?.satisfaction==null?'—':unit.satisfaction.toFixed(1)}</strong><p>{unit?.feedback_responses ?? '—'} respostas em 5 dias</p></article>
        <article className="kpi-card"><span className="kpi-icon">▣</span><small>Cardápios</small><strong>{unit?.published_menus ?? '—'}</strong><p>{unit?.menu_days ?? '—'} dias publicados</p></article>
        <article className="kpi-card"><span className="kpi-icon">⌘</span><small>Cobertura técnica</small><strong>{unit?.technical_coverage_percent ?? 0}%</strong><p>{unit?.enriched_items ?? 0} de {unit?.menu_items ?? 0} itens</p></article>
        <article className="kpi-card"><span className="kpi-icon">•</span><small>Itens de cardápio</small><strong>{unit?.menu_items ?? '—'}</strong><p>itens disponíveis na unidade</p></article>
      </section>

      <section className="executive-grid">
        <article className="card executive-panel">
          <div className="panel-head"><div><span className="eyebrow">QUALIDADE DA BASE</span><h2>Cobertura técnica</h2></div><strong className="coverage-number">{unit?.technical_coverage_percent ?? 0}%</strong></div>
          <div className="coverage-track"><div style={{width:`${unit?.technical_coverage_percent ?? 0}%`}} /></div>
          <p>{unit?.enriched_items ?? 0} de {unit?.menu_items ?? 0} itens possuem ficha técnica associada.</p>
          <div className="panel-actions"><button className="secondary" onClick={()=>go('fichas-tecnicas')}>Abrir fichas técnicas</button><button className="secondary" onClick={()=>go('importar-fichas')}>Importar fichas</button></div>
        </article>

        <article className="card executive-panel">
          <div className="panel-head"><div><span className="eyebrow">EXPERIÊNCIA</span><h2>Satisfação da unidade</h2></div><strong className="coverage-number">{unit?.satisfaction==null?'—':unit.satisfaction.toFixed(1)}</strong></div>
          <p>{unit?.feedback_responses ?? 0} respostas agregadas nos últimos 5 dias.</p>
          <div className="insight-box"><small>Status</small><strong>{unit?.satisfaction!=null && unit.satisfaction>=4 ? 'Experiência positiva' : 'Requer acompanhamento'}</strong><span>Indicador agregado, sem exposição individual.</span></div>
          <div className="panel-actions"><button className="secondary" onClick={()=>go('feedbacks')}>Abrir feedbacks</button></div>
        </article>
      </section>

      <section className="card alerts-card">
        <div className="section-heading">
          <div><span className="eyebrow">ALERTAS DA UNIDADE</span><h2>O que precisa de atenção</h2><p>Alertas calculados somente a partir dos indicadores desta unidade.</p></div>
          <span className={alerts.length?'badge':'badge soft'}>{alerts.length?`${alerts.length} alerta(s)`:'Tudo em ordem'}</span>
        </div>
        {alerts.length ? <div className="alerts-list">
          {alerts.map((alert,index)=><article className={`alert-item ${alert.level}`} key={index}>
            <span className="alert-signal">{alert.level==='high'?'!':'•'}</span>
            <div className="alert-copy"><strong>{alert.title}</strong><p>{alert.detail}</p></div>
            <button className="secondary" onClick={()=>go(alert.hash)}>{alert.action}</button>
          </article>)}
        </div> : <div className="alerts-empty"><span>✓</span><div><strong>Nenhum alerta operacional nesta unidade</strong><p>Os indicadores da demonstração estão dentro dos parâmetros configurados.</p></div></div>}
      </section>

      <section className="card unit-action-card">
        <div>
          <span className="eyebrow">AÇÕES RÁPIDAS</span>
          <h2>Gerenciar esta operação</h2>
          <p>Acesse diretamente os módulos relacionados à unidade.</p>
        </div>
        <div className="unit-action-buttons">
          <button className="secondary" onClick={()=>go('cardapios')}>Gerenciar cardápios</button>
          <button className="secondary" onClick={()=>go('feedbacks')}>Analisar satisfação</button>
          <button className="secondary" onClick={()=>go('fichas-tecnicas')}>Revisar fichas</button>
        </div>
      </section>
    </main>
  </div>
}
