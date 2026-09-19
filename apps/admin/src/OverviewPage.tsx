import { useEffect, useState } from 'react'
import { AdminOverview, getAdminOverview, presentationAdminKey } from './api'

function go(hash: string) {
  window.location.hash = hash
}

const TAG_LABELS: Record<string,string> = {
  sabor: 'Sabor',
  atendimento: 'Atendimento',
  temperatura: 'Temperatura',
  variedade: 'Variedade',
}

function periodLabel(start?: string | null, end?: string | null) {
  if (!start || !end) return '—'
  const fmt = (value:string) => new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit'}).format(new Date(`${value}T12:00:00`))
  return `${fmt(start)} → ${fmt(end)}`
}

export function OverviewPage() {
  const [data,setData] = useState<AdminOverview|null>(null)
  const [error,setError] = useState('')

  useEffect(() => {
    getAdminOverview(presentationAdminKey)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Não foi possível carregar a visão geral.'))
  }, [])

  const coverage = data?.technical_coverage_percent ?? 0
  const satisfaction = data?.satisfaction_overall
  const alerts = (data?.unit_comparison ?? []).flatMap((unit) => {
    const items: Array<{level:'high'|'medium'|'info'; title:string; detail:string; action:string; hash:string}> = []
    if (unit.technical_coverage_percent < 80) {
      items.push({
        level: unit.technical_coverage_percent < 50 ? 'high' : 'medium',
        title: `${unit.company_name} · cobertura técnica baixa`,
        detail: `${unit.technical_coverage_percent}% dos itens possuem ficha técnica associada.`,
        action: 'Revisar fichas',
        hash: 'fichas-tecnicas',
      })
    }
    if (unit.satisfaction != null && unit.satisfaction < 4) {
      items.push({
        level: 'high',
        title: `${unit.company_name} · satisfação requer atenção`,
        detail: `Média ${unit.satisfaction.toFixed(1)} nos últimos 5 dias.`,
        action: 'Ver feedbacks',
        hash: 'feedbacks',
      })
    }
    if (unit.feedback_responses < 5) {
      items.push({
        level: 'medium',
        title: `${unit.company_name} · baixo volume de feedback`,
        detail: `Apenas ${unit.feedback_responses} respostas no período.`,
        action: 'Abrir satisfação',
        hash: 'feedbacks',
      })
    }
    if (unit.published_menus === 0) {
      items.push({
        level: 'high',
        title: `${unit.company_name} · sem cardápio publicado`,
        detail: 'Nenhum cardápio publicado para esta unidade.',
        action: 'Publicar cardápio',
        hash: 'cardapios',
      })
    }
    return items
  })

  if (data && data.technical_sheets > data.complete_sheets) {
    alerts.push({
      level: 'medium',
      title: 'Fichas técnicas incompletas',
      detail: `${data.technical_sheets - data.complete_sheets} ficha(s) ainda têm macros incompletos.`,
      action: 'Revisar biblioteca',
      hash: 'fichas-tecnicas',
    })
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">A</span><div><strong>APETIT</strong><small>Admin</small></div></div>
        <nav>
          <button className="nav-item active" onClick={() => go('visao-geral')}><span>⌂</span>Visão geral</button>
          <button className="nav-item" onClick={() => go('cardapios')}><span>▣</span>Cardápios</button>
          <button className="nav-item" onClick={() => go('importar-fichas')}><span>↥</span>Importações</button>
          <button className="nav-item" onClick={() => go('fichas-tecnicas')}><span>⌘</span>Fichas técnicas</button>
          <div className="nav-label">Experiência</div>
          <button className="nav-item" onClick={() => go('feedbacks')}><span>♡</span>Feedbacks</button>
          <div className="nav-label">Gestão</div>
          <button className="nav-item" onClick={() => go('unidades')}><span>□</span>Unidades</button>
        </nav>
        <div className="privacy-note"><strong>Privacidade por padrão</strong><p>Prescrições, restrições e histórico alimentar individual não aparecem neste painel.</p></div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">APETIT · VISÃO EXECUTIVA</span>
            <h1>Operação em um só lugar</h1>
            <p>Indicadores agregados da demonstração: operação, nutrição, experiência e qualidade da base.</p>
          </div>
          <div className="topbar-actions"><button className="secondary" onClick={() => go('relatorio-executivo')}>Relatório executivo</button><div className="status-pill"><span className="status-dot" />Ambiente de demonstração</div></div>
        </header>

        {error && <div className="alert error">{error}</div>}

        <section className="overview-hero card">
          <div>
            <span className="badge">DEMO V1</span>
            <h2>Resumo executivo da operação</h2>
            <p>Dados fictícios controlados para demonstrar como a gestão acompanhará o serviço quando a base oficial da Apetit estiver conectada.</p>
          </div>
          <button className="primary" onClick={() => go('cardapios')}>Gerenciar cardápios</button>
        </section>

        <section className="executive-kpis">
          <article className="kpi-card"><span className="kpi-icon">□</span><small>Unidades</small><strong>{data?.units ?? '—'}</strong><p>{data?.restaurants ?? '—'} refeitórios cadastrados</p></article>
          <article className="kpi-card"><span className="kpi-icon">▣</span><small>Cardápios publicados</small><strong>{data?.published_menus ?? '—'}</strong><p>{data?.menu_items ?? '—'} itens disponíveis</p></article>
          <article className="kpi-card"><span className="kpi-icon">⌘</span><small>Fichas técnicas</small><strong>{data?.technical_sheets ?? '—'}</strong><p>{data?.complete_sheets ?? '—'} completas</p></article>
          <article className="kpi-card"><span className="kpi-icon">♡</span><small>Satisfação geral</small><strong>{satisfaction == null ? '—' : satisfaction.toFixed(1)}</strong><p>{data?.feedback_responses ?? '—'} respostas em 5 dias</p></article>
        </section>

        <section className="executive-grid">
          <article className="card executive-panel">
            <div className="panel-head"><div><span className="eyebrow">QUALIDADE DA BASE</span><h2>Cobertura de fichas técnicas</h2></div><strong className="coverage-number">{coverage}%</strong></div>
            <div className="coverage-track"><div style={{width:`${coverage}%`}} /></div>
            <p>{data?.enriched_menu_items ?? 0} de {data?.menu_items ?? 0} itens do cardápio possuem ficha técnica associada.</p>
            <div className="panel-actions"><button className="secondary" onClick={() => go('fichas-tecnicas')}>Ver fichas técnicas</button><button className="secondary" onClick={() => go('importar-fichas')}>Importar fichas</button></div>
          </article>

          <article className="card executive-panel">
            <div className="panel-head"><div><span className="eyebrow">EXPERIÊNCIA</span><h2>Satisfação dos funcionários</h2></div><strong className="coverage-number">{satisfaction == null ? '—' : satisfaction.toFixed(1)}</strong></div>
            <p>{data?.feedback_responses ?? 0} respostas agregadas entre {periodLabel(data?.feedback_period_start,data?.feedback_period_end)}.</p>
            <div className="insight-box"><small>Motivo mais citado</small><strong>{data?.top_feedback_tag ? TAG_LABELS[data.top_feedback_tag.tag] ?? data.top_feedback_tag.tag : '—'}</strong><span>{data?.top_feedback_tag?.count ?? 0} marcações</span></div>
            <div className="panel-actions"><button className="secondary" onClick={() => go('feedbacks')}>Abrir satisfação</button></div>
          </article>
        </section>


        <section className="card comparison-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">COMPARATIVO ENTRE UNIDADES</span>
              <h2>Onde a operação precisa de atenção</h2>
              <p>Indicadores agregados da demonstração para comparar rapidamente as unidades.</p>
            </div>
            <button className="secondary" onClick={() => go('unidades')}>Ver unidades</button>
          </div>
          <div className="comparison-table">
            <div className="comparison-row comparison-head">
              <span>Unidade</span><span>Satisfação</span><span>Respostas</span><span>Cardápios</span><span>Cobertura</span>
            </div>
            {(data?.unit_comparison ?? []).map((unit) => {
              const satisfactionWarning = unit.satisfaction != null && unit.satisfaction < 4
              const coverageWarning = unit.technical_coverage_percent < 80
              return <div className="comparison-row" key={unit.unit_id}>
                <div><strong>{unit.company_name}</strong><small>{unit.unit_name.replace(' — Demonstração','')}</small></div>
                <span className={satisfactionWarning ? 'metric-warning' : 'metric-good'}>{unit.satisfaction == null ? '—' : unit.satisfaction.toFixed(1)}</span>
                <span>{unit.feedback_responses}</span>
                <span>{unit.published_menus}</span>
                <span className={coverageWarning ? 'metric-warning' : 'metric-good'}>{unit.technical_coverage_percent}%</span>
              </div>
            })}
          </div>
          <div className="comparison-actions">
            <button className="secondary" onClick={() => go('feedbacks')}>Analisar satisfação</button>
            <button className="secondary" onClick={() => go('fichas-tecnicas')}>Revisar cobertura técnica</button>
            <button className="primary" onClick={() => go('cardapios')}>Gerenciar cardápios</button>
          </div>
        </section>

        <section className="card alerts-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">CENTRAL DE ALERTAS</span>
              <h2>O que precisa de atenção agora</h2>
              <p>Alertas automáticos gerados a partir dos indicadores agregados da operação.</p>
            </div>
            <span className={alerts.length ? "badge" : "badge soft"}>{alerts.length ? `${alerts.length} alerta(s)` : 'Tudo em ordem'}</span>
          </div>

          {alerts.length ? (
            <div className="alerts-list">
              {alerts.map((alert,index) => (
                <article className={`alert-item ${alert.level}`} key={`${alert.title}-${index}`}>
                  <span className="alert-signal">{alert.level === 'high' ? '!' : alert.level === 'medium' ? '•' : 'i'}</span>
                  <div className="alert-copy">
                    <strong>{alert.title}</strong>
                    <p>{alert.detail}</p>
                  </div>
                  <button className="secondary" onClick={() => go(alert.hash)}>{alert.action}</button>
                </article>
              ))}
            </div>
          ) : (
            <div className="alerts-empty">
              <span>✓</span>
              <div><strong>Nenhum alerta operacional no momento</strong><p>Os indicadores da demonstração estão dentro dos parâmetros configurados.</p></div>
            </div>
          )}
        </section>

        <section className="card operations-card">
          <div className="section-heading"><div><span className="eyebrow">OPERAÇÃO</span><h2>Status e próximos cuidados</h2><p>Leitura rápida do que merece atenção na demonstração.</p></div></div>
          <div className="operations-grid">
            <div className="operation-row good"><span>✓</span><div><strong>Feedbacks ativos</strong><small>Relatórios agregados disponíveis com proteção de grupos pequenos.</small></div></div>
            <div className="operation-row good"><span>✓</span><div><strong>Fluxo do colaborador conectado</strong><small>Cardápio, recomendação, registro, avaliação e progresso estão integrados.</small></div></div>
            <div className={coverage >= 80 ? 'operation-row good' : 'operation-row warning'}><span>{coverage >= 80 ? '✓' : '!'}</span><div><strong>Cobertura técnica {coverage}%</strong><small>{coverage >= 80 ? 'Base demo com boa cobertura nutricional.' : 'Parte do cardápio ainda está sem ficha técnica associada.'}</small></div></div>
            <div className="operation-row info"><span>i</span><div><strong>Dados oficiais pendentes</strong><small>Empresas, fichas, cardápios e integrações reais serão substituídos na etapa final.</small></div></div>
          </div>
        </section>

        <section className="overview-grid">
          <article className="card overview-card"><div className="overview-icon">▣</div><span className="eyebrow">ÚLTIMA PUBLICAÇÃO</span><h2>{data?.latest_menu?.unit_name ?? 'Nenhuma publicação'}</h2><p>{data?.latest_menu ? `Período ${periodLabel(data.latest_menu.period_start,data.latest_menu.period_end)}` : 'Publique um cardápio para iniciar a operação.'}</p><button className="secondary" onClick={() => go('cardapios')}>Abrir cardápios</button></article>
          <article className="card overview-card"><div className="overview-icon">♡</div><span className="eyebrow">EXPERIÊNCIA</span><h2>Feedbacks e satisfação</h2><p>Veja tendências, motivos mais citados e comentários anonimizados.</p><button className="secondary" onClick={() => go('feedbacks')}>Ver relatório</button></article>
        </section>
      </main>
    </div>
  )
}
