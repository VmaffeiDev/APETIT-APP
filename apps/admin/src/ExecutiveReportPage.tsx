import { useEffect, useMemo, useState } from 'react'
import { AdminOverview, getAdminOverview, getExecutiveReportPdf, presentationAdminKey } from './api'

function go(hash:string){ window.location.hash = hash }

function fmtDate(value?:string|null){
  if(!value) return '—'
  return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${value}T12:00:00`))
}

export function ExecutiveReportPage(){
  const [data,setData]=useState<AdminOverview|null>(null)
  const [error,setError]=useState('')
  const [exporting,setExporting]=useState(false)

  useEffect(()=>{
    getAdminOverview(presentationAdminKey)
      .then(setData)
      .catch((e)=>setError(e instanceof Error ? e.message : 'Não foi possível carregar o relatório.'))
  },[])

  const alerts=useMemo(()=>{
    if(!data) return []
    const items:Array<{level:'Alta'|'Média';title:string;detail:string}> = []
    for(const unit of data.unit_comparison){
      if(unit.technical_coverage_percent<80){
        items.push({
          level:unit.technical_coverage_percent<50?'Alta':'Média',
          title:`${unit.company_name}: cobertura técnica abaixo do desejado`,
          detail:`${unit.technical_coverage_percent}% dos itens possuem ficha técnica associada.`,
        })
      }
      if(unit.satisfaction!=null && unit.satisfaction<4){
        items.push({
          level:'Alta',
          title:`${unit.company_name}: satisfação abaixo de 4,0`,
          detail:`Média atual de ${unit.satisfaction.toFixed(1)} no período analisado.`,
        })
      }
      if(unit.published_menus===0){
        items.push({
          level:'Alta',
          title:`${unit.company_name}: nenhuma publicação de cardápio`,
          detail:'A unidade ainda não possui cardápio publicado.',
        })
      }
    }
    if(data.technical_sheets>data.complete_sheets){
      items.push({
        level:'Média',
        title:'Fichas técnicas incompletas',
        detail:`${data.technical_sheets-data.complete_sheets} ficha(s) ainda possuem macros incompletos.`,
      })
    }
    return items
  },[data])

  async function downloadPdf(){
    setExporting(true)
    setError('')
    try{
      const blob=await getExecutiveReportPdf(presentationAdminKey)
      const fileName=`APETIT-Relatorio-Executivo-${new Date().toISOString().slice(0,10)}.pdf`
      const file=new File([blob],fileName,{type:'application/pdf'})
      const shareNavigator=navigator as Navigator & {
        canShare?: (data: ShareData) => boolean
      }

      if(navigator.share && shareNavigator.canShare?.({files:[file]})){
        await navigator.share({
          title:'APETIT · Relatório Executivo',
          files:[file],
        })
      }else{
        const url=URL.createObjectURL(blob)
        const anchor=document.createElement('a')
        anchor.href=url
        anchor.download=fileName
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        window.setTimeout(()=>URL.revokeObjectURL(url),1000)
      }
    }catch(e){
      if(e instanceof DOMException && e.name==='AbortError') return
      setError(e instanceof Error ? e.message : 'Não foi possível baixar o PDF.')
    }finally{
      setExporting(false)
    }
  }

  const generatedAt=new Intl.DateTimeFormat('pt-BR',{
    day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'
  }).format(new Date())

  return <div className="report-shell">
    <div className="report-toolbar no-print">
      <button className="secondary" onClick={()=>go('visao-geral')}>← Voltar ao painel</button>
      <div className="report-toolbar-actions">
        <button className="secondary" onClick={()=>window.print()}>Imprimir</button>
        <button className="primary" disabled={exporting} onClick={downloadPdf}>{exporting ? 'Gerando PDF...' : 'Baixar PDF'}</button>
      </div>
    </div>

    <main className="report-page">
      <header className="report-header">
        <div className="report-brand">
          <span className="brand-mark">A</span>
          <div><strong>APETIT</strong><small>Relatório Executivo</small></div>
        </div>
        <div className="report-meta">
          <strong>DEMONSTRAÇÃO</strong>
          <span>Gerado em {generatedAt}</span>
        </div>
      </header>

      <section className="report-title">
        <span className="eyebrow">RESUMO EXECUTIVO</span>
        <h1>Operação, experiência e qualidade da base</h1>
        <p>Visão consolidada dos indicadores operacionais do ambiente de demonstração APETIT.</p>
      </section>

      {error && <div className="alert error">{error}</div>}

      <section className="report-kpis">
        <article><small>Unidades</small><strong>{data?.units ?? '—'}</strong><span>{data?.restaurants ?? '—'} refeitórios</span></article>
        <article><small>Cardápios publicados</small><strong>{data?.published_menus ?? '—'}</strong><span>{data?.menu_items ?? '—'} itens</span></article>
        <article><small>Fichas técnicas</small><strong>{data?.technical_sheets ?? '—'}</strong><span>{data?.complete_sheets ?? '—'} completas</span></article>
        <article><small>Satisfação geral</small><strong>{data?.satisfaction_overall==null?'—':data.satisfaction_overall.toFixed(1)}</strong><span>{data?.feedback_responses ?? '—'} respostas</span></article>
      </section>

      <section className="report-section">
        <div className="report-section-head">
          <div><span className="eyebrow">QUALIDADE DA BASE</span><h2>Cobertura técnica</h2></div>
          <strong className="report-big-number">{data?.technical_coverage_percent ?? 0}%</strong>
        </div>
        <div className="coverage-track report-track"><div style={{width:`${data?.technical_coverage_percent ?? 0}%`}}/></div>
        <p>{data?.enriched_menu_items ?? 0} de {data?.menu_items ?? 0} itens possuem ficha técnica associada.</p>
      </section>

      <section className="report-section">
        <div className="report-section-head">
          <div><span className="eyebrow">EXPERIÊNCIA</span><h2>Satisfação dos colaboradores</h2></div>
          <strong className="report-big-number">{data?.satisfaction_overall==null?'—':data.satisfaction_overall.toFixed(1)}</strong>
        </div>
        <p>Período analisado: {fmtDate(data?.feedback_period_start)} a {fmtDate(data?.feedback_period_end)} · {data?.feedback_responses ?? 0} respostas agregadas.</p>
        <div className="report-insight">
          <small>Motivo mais citado</small>
          <strong>{data?.top_feedback_tag?.tag ?? '—'}</strong>
          <span>{data?.top_feedback_tag?.count ?? 0} marcações</span>
        </div>
      </section>

      <section className="report-section">
        <span className="eyebrow">COMPARATIVO ENTRE UNIDADES</span>
        <h2>Indicadores por unidade</h2>
        <div className="report-table">
          <div className="report-row report-row-head">
            <span>Unidade</span><span>Satisfação</span><span>Respostas</span><span>Cardápios</span><span>Cobertura</span>
          </div>
          {(data?.unit_comparison ?? []).map(unit=><div className="report-row" key={unit.unit_id}>
            <div><strong>{unit.company_name}</strong><small>{unit.unit_name.replace(' — Demonstração','')}</small></div>
            <span>{unit.satisfaction==null?'—':unit.satisfaction.toFixed(1)}</span>
            <span>{unit.feedback_responses}</span>
            <span>{unit.published_menus}</span>
            <span>{unit.technical_coverage_percent}%</span>
          </div>)}
        </div>
      </section>

      <section className="report-section">
        <span className="eyebrow">ALERTAS OPERACIONAIS</span>
        <h2>Pontos que exigem atenção</h2>
        {alerts.length ? <div className="report-alerts">
          {alerts.map((alert,index)=><article key={index}>
            <span className={alert.level==='Alta'?'report-risk high':'report-risk medium'}>{alert.level}</span>
            <div><strong>{alert.title}</strong><p>{alert.detail}</p></div>
          </article>)}
        </div> : <div className="report-ok">✓ Nenhum alerta operacional relevante no período.</div>}
      </section>

      <section className="report-section">
        <span className="eyebrow">ÚLTIMA PUBLICAÇÃO</span>
        <h2>{data?.latest_menu?.unit_name ?? 'Nenhuma publicação encontrada'}</h2>
        <p>{data?.latest_menu ? `Período ${fmtDate(data.latest_menu.period_start)} a ${fmtDate(data.latest_menu.period_end)}` : '—'}</p>
      </section>

      <footer className="report-footer">
        <strong>APETIT · Relatório Executivo de Demonstração</strong>
        <p>Todos os dados deste relatório são fictícios e controlados para apresentação. Na versão final, serão substituídos exclusivamente pelos dados oficiais da APETIT. O relatório utiliza somente indicadores agregados e não exibe prescrições, restrições ou histórico alimentar individual.</p>
      </footer>
    </main>
  </div>
}
