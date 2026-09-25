import { DEMO_UNITS } from './demoUnits'
import './units.css'

export function UnitsPage() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">A</span><div><strong>APETIT</strong><small>Admin</small></div></div>
        <nav>
          <button className="nav-item" onClick={() => { window.location.hash = 'visao-geral' }}><span>⌂</span>Visão geral</button>
          <button className="nav-item" onClick={() => { window.location.hash = 'cardapios' }}><span>▣</span>Cardápios</button>
          <button className="nav-item" onClick={() => { window.location.hash = 'importar-fichas' }}><span>↥</span>Importações</button>
          <div className="nav-label">Experiência</div>
          <button className="nav-item" onClick={() => { window.location.hash = 'feedbacks' }}><span>♡</span>Feedbacks</button>
          <button className="nav-item" onClick={() => { window.location.hash = 'feedbacks' }}><span>⌁</span>Satisfação</button>
          <div className="nav-label">Gestão</div>
          <button className="nav-item active"><span>□</span>Unidades</button>
          <button className="nav-item"><span>◫</span>Empresas</button>
          <button className="nav-item"><span>⚙</span>Configurações</button>
        </nav>
        <div className="privacy-note"><strong>Ambiente de demonstração</strong><p>Copel, Sanepar e Coca-Cola são cadastros temporários e serão substituídos pela base oficial.</p></div>
      </aside>

      <main className="main">
        <header className="topbar units-topbar">
          <div>
            <span className="eyebrow">GESTÃO · UNIDADES</span>
            <h1>Unidades atendidas</h1>
            <p>Base fictícia para apresentação do APETIT-APP até a chegada do relatório oficial.</p>
          </div>
          <span className="badge">3 unidades demo</span>
        </header>

        <section className="units-summary">
          <div className="metric"><small>Empresas</small><strong>3</strong><span>cadastros temporários</span></div>
          <div className="metric"><small>Unidades</small><strong>3</strong><span>uma por empresa na demo</span></div>
          <div className="metric"><small>Refeitórios</small><strong>3</strong><span>ligados aos fluxos reais</span></div>
        </section>

        <section className="demo-notice">
          <div><span>i</span></div>
          <p><strong>Dados de demonstração.</strong> Os nomes abaixo servem apenas para validar o produto. Quando a Apetit enviar a relação oficial de empresas, unidades e refeitórios, substituiremos esses registros mantendo a mesma arquitetura.</p>
        </section>

        <section className="units-grid">
          {DEMO_UNITS.map((unit, index) => (
            <article className="unit-card" key={unit.unitId}>
              <div className="unit-card-head">
                <div className={`company-avatar company-${index + 1}`}><img src={unit.logoUrl} alt={`Logo ${unit.company}`} loading="lazy" /></div>
                <div>
                  <span className="demo-chip">DEMO</span>
                  <h2>{unit.company}</h2>
                  <p>{unit.unitName}</p>
                </div>
                <span className="unit-status"><i />Ativa</span>
              </div>

              <div className="unit-details">
                <div><small>Refeitório</small><strong>{unit.restaurantName}</strong></div>
                <div><small>Operação</small><strong>Almoço</strong></div>
                <div><small>Origem</small><strong>Base fictícia</strong></div>
              </div>

              <div className="unit-actions">
                <button className="primary" onClick={() => { window.location.hash = `unidade/${unit.unitId}` }}>Abrir unidade</button>
                <button className="secondary" onClick={() => { window.location.hash = 'cardapios' }}>Publicar cardápio</button>
                <button className="secondary" onClick={() => { window.location.hash = `feedbacks/${unit.unitId}` }}>Ver satisfação</button>
              </div>

              <details className="technical-data">
                <summary>Dados técnicos</summary>
                <code>unit: {unit.unitId}</code>
                <code>restaurant: {unit.restaurantId}</code>
              </details>
            </article>
          ))}
        </section>

        <section className="card units-next">
          <div>
            <span className="eyebrow">PRÓXIMA ETAPA</span>
            <h2>Substituição simples pela base oficial</h2>
            <p>Quando o relatório da Apetit chegar, importaremos as empresas, unidades e refeitórios reais e removeremos estes três registros de demonstração.</p>
          </div>
          <button className="primary" onClick={() => { window.location.hash = 'cardapios' }}>Ir para cardápios</button>
        </section>
      </main>
    </div>
  )
}
