import { useEffect, useMemo, useState } from 'react'
import { AdminUser, FeedbackSummary, getAdminToken, getFeedbackSummary, isPresentationMode, presentationAdminKey } from './api'
import { DEMO_UNITS } from './demoUnits'
import { filterUnitsForUser } from './access'

const TAG_LABELS: Record<string, string> = {
  sabor: 'Sabor',
  comida_fria: 'Comida fria',
  acabou_antes: 'Acabou antes de eu chegar',
  poucas_opcoes: 'Poucas opções',
  sem_opcao_adequada: 'Sem opção adequada',
  atendimento: 'Atendimento',
  temperatura: 'Temperatura',
  variedade: 'Variedade',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(`${value}T12:00:00`))
}

export function FeedbackDashboard({ initialUnitId, user }: { initialUnitId?: string; user: AdminUser | null }) {
  const allowedUnits = useMemo(()=>filterUnitsForUser(DEMO_UNITS,user),[user])
  const initialUnit = allowedUnits.find((unit) => unit.unitId === initialUnitId) ?? allowedUnits[0] ?? DEMO_UNITS[0]
  const authenticated=Boolean(getAdminToken())
  const today = new Date()
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(today.getDate() - 6)

  const [unitId, setUnitId] = useState(initialUnit.unitId)
  const [restaurantId, setRestaurantId] = useState(initialUnit.restaurantId)
  const [adminKey, setAdminKey] = useState(presentationAdminKey)
  const [start, setStart] = useState(isPresentationMode ? '2026-09-15' : sevenDaysAgo.toISOString().slice(0, 10))
  const [end, setEnd] = useState(isPresentationMode ? '2026-09-19' : today.toISOString().slice(0, 10))
  const [summary, setSummary] = useState<FeedbackSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const selectedUnit = useMemo(() => allowedUnits.find((unit) => unit.unitId === unitId) ?? allowedUnits[0] ?? DEMO_UNITS[0], [allowedUnits,unitId])
  const maxTag = useMemo(() => Math.max(1, ...(summary?.tags.map((tag) => tag.count) ?? [1])), [summary])

  async function load() {
    if (!unitId.trim() || (!authenticated && !adminKey.trim())) {
      setError(isPresentationMode ? 'Não foi possível iniciar o relatório de demonstração.' : 'Informe uma unidade válida.')
      return
    }
    setBusy(true)
    setError('')
    try {
      setSummary(await getFeedbackSummary({
        unitId: unitId.trim(),
        restaurantId: restaurantId.trim() || undefined,
        start,
        end,
        adminKey: adminKey.trim(),
      }))
    } catch (err) {
      setSummary(null)
      setError(err instanceof Error ? err.message : 'Falha ao carregar os feedbacks.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (isPresentationMode || authenticated) void load()
  }, [])

  return (
    <>
      <header className="topbar">
        <div>
          <span className="eyebrow">EXPERIÊNCIA · FEEDBACKS</span>
          <h1>Satisfação dos funcionários</h1>
          <p>Acompanhe a experiência no refeitório sem expor avaliações individuais.</p>
        </div>
        <div className="status-pill"><span className="status-dot" />Privacidade ativa</div>
      </header>

      <section className="card feedback-filters">
        <div className="section-heading">
          <div><h2>Filtros do relatório</h2><p>Recortes com menos de 5 pessoas distintas têm detalhes ocultados automaticamente.</p></div>
          <span className="badge soft">mín. 5 pessoas</span>
        </div>
        <div className="form-grid feedback-filter-grid">
          <label><span>Unidade</span><select value={unitId} onChange={(e) => { const next = allowedUnits.find((unit) => unit.unitId === e.target.value) ?? allowedUnits[0] ?? DEMO_UNITS[0]; setUnitId(next.unitId); setRestaurantId(next.restaurantId); setSummary(null) }}>{allowedUnits.map((unit) => <option key={unit.unitId} value={unit.unitId}>{unit.company} · {unit.unitName.replace(' — Demonstração','')}</option>)}</select></label>
          <label><span>Refeitório</span><input value={selectedUnit.restaurantName} readOnly /></label>
          <label><span>De</span><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label><span>Até</span><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          {isPresentationMode ? <div className="full presentation-access"><strong>Modo apresentação</strong><span>Dados fictícios controlados de 15/09 a 19/09/2026. Se a API demo estiver indisponível, o painel usa uma amostra local identificada como demonstração.</span></div> : !authenticated ? <label className="full"><span>Chave administrativa</span><input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Chave de acesso da operação" /></label> : <div className="full presentation-access"><strong>Conta autenticada</strong><span>Relatório limitado às unidades atribuídas a {user?.name}.</span></div>}
        </div>
        {error && <div className="alert error">{error}</div>}
        <div className="action-row"><span className="helper">{isPresentationMode ? 'Dados fictícios para demonstração · nenhum funcionário real é usado.' : 'Nenhum identificador de funcionário é retornado neste relatório.'}</span><button className="primary" disabled={busy} onClick={load}>{busy ? 'Carregando...' : 'Atualizar relatório'}</button></div>
      </section>

      {summary?.suppressed && (
        <section className="card privacy-empty">
          <div className="privacy-shield">◈</div>
          <span className="eyebrow">RECORTE PROTEGIDO</span>
          <h2>Dados detalhados não exibidos</h2>
          <p>{summary.message}</p>
          <div className="suppressed-count"><strong>{summary.responses}</strong><span>respostas no período</span></div>
          <small>O relatório detalhado será liberado automaticamente quando houver pelo menos {summary.minimum_group} respostas no recorte selecionado.</small>
        </section>
      )}

      {summary && !summary.suppressed && summary.ratings && (
        <>
          <section className="metrics-grid feedback-metrics">
            <div className="metric"><small>Respostas</small><strong>{summary.responses}</strong><span>{formatDate(summary.period_start)} a {formatDate(summary.period_end)}</span></div>
            <div className="metric rating-metric"><small>Satisfação geral</small><strong>{summary.ratings.overall.toFixed(1)} <em>/ 5</em></strong><span>média de comida + atendimento</span></div>
            <div className="metric"><small>Comida</small><strong>{summary.ratings.food.toFixed(1)}</strong><span>avaliação média</span></div>
            <div className="metric"><small>Atendimento</small><strong>{summary.ratings.service.toFixed(1)}</strong><span>avaliação média</span></div>
          </section>

          <div className="dashboard-grid">
            <section className="card content-card trend-card">
              <div className="section-heading"><div><h2>Evolução da satisfação</h2><p>Somente dias com volume mínimo aparecem no gráfico.</p></div></div>
              {summary.trend.length ? (
                <div className="trend-chart">
                  {summary.trend.map((point) => (
                    <div className="trend-point" key={point.date}>
                      <div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max(10, point.rating / 5 * 100)}%` }}><span>{point.rating.toFixed(1)}</span></div></div>
                      <strong>{formatDate(point.date)}</strong>
                      <small>{point.responses} resp.</small>
                    </div>
                  ))}
                </div>
              ) : <div className="empty-inline">Ainda não há dias individuais com volume suficiente para mostrar tendência.</div>}
            </section>

            <section className="card content-card">
              <div className="section-heading"><div><h2>O que mais apareceu</h2><p>Motivos marcados pelos funcionários.</p></div></div>
              <div className="tag-ranking">
                {summary.tags.length ? summary.tags.map((tag, index) => (
                  <div className="tag-row" key={tag.tag}>
                    <span className="rank">{index + 1}</span>
                    <div className="tag-body"><div><strong>{TAG_LABELS[tag.tag] ?? tag.tag.replaceAll('_', ' ')}</strong><span>{tag.count}</span></div><div className="tag-track"><div style={{ width: `${tag.count / maxTag * 100}%` }} /></div></div>
                  </div>
                )) : <div className="empty-inline">Nenhum motivo foi marcado neste período.</div>}
              </div>
            </section>
          </div>

          <section className="card content-card comments-card">
            <div className="section-heading"><div><h2>Comentários recentes</h2><p>Exibidos sem nome, e-mail ou identificador do funcionário.</p></div><span className="badge soft">anonimizado</span></div>
            <div className="comments-list">
              {summary.comments.length ? summary.comments.map((comment, index) => (
                <article className="comment-item" key={`${comment.date}-${index}`}><div className="quote-mark">“</div><div><p>{comment.comment}</p><small>{formatDate(comment.date)}</small></div></article>
              )) : <div className="empty-inline">Comentários livres ficam ocultos até revisão de privacidade.</div>}
            </div>
          </section>
        </>
      )}
    </>
  )
}
