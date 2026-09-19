import { DEMO_UNITS } from './demoUnits'

function go(hash: string) {
  window.location.hash = hash
}

export function OverviewPage() {
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
            <span className="eyebrow">APETIT · VISÃO GERAL</span>
            <h1>Operação em um só lugar</h1>
            <p>Acompanhe cardápios, fichas técnicas, experiência dos colaboradores e unidades atendidas.</p>
          </div>
          <div className="status-pill"><span className="status-dot" />Ambiente de demonstração</div>
        </header>

        <section className="overview-hero card">
          <div>
            <span className="badge">DEMO V1</span>
            <h2>Produto pronto para apresentação</h2>
            <p>Os fluxos principais estão conectados ao app do colaborador. Os dados abaixo são fictícios e serão substituídos pela base oficial da Apetit.</p>
          </div>
          <button className="primary" onClick={() => go('cardapios')}>Publicar cardápio</button>
        </section>

        <section className="overview-metrics">
          <article className="metric"><small>Unidades demo</small><strong>{DEMO_UNITS.length}</strong><span>Copel, Sanepar e Coca-Cola</span></article>
          <article className="metric"><small>Cardápio</small><strong>Ativo</strong><span>fluxo disponível no app</span></article>
          <article className="metric"><small>Feedback</small><strong>Conectado</strong><span>avaliações agregadas</span></article>
          <article className="metric"><small>Privacidade</small><strong>Protegida</strong><span>sem saúde individual no admin</span></article>
        </section>

        <section className="overview-grid">
          <article className="card overview-card">
            <div className="overview-icon">▣</div>
            <span className="eyebrow">OPERAÇÃO</span>
            <h2>Cardápios</h2>
            <p>Importe XLSX/CSV, confira os itens e publique o período para as unidades.</p>
            <button className="secondary" onClick={() => go('cardapios')}>Abrir cardápios</button>
          </article>
          <article className="card overview-card">
            <div className="overview-icon">⌘</div>
            <span className="eyebrow">NUTRIÇÃO</span>
            <h2>Fichas técnicas</h2>
            <p>Centralize porções, macros, ingredientes e alergênicos usados nas recomendações.</p>
            <button className="secondary" onClick={() => go('fichas-tecnicas')}>Abrir biblioteca</button>
          </article>
          <article className="card overview-card">
            <div className="overview-icon">♡</div>
            <span className="eyebrow">EXPERIÊNCIA</span>
            <h2>Feedbacks</h2>
            <p>Acompanhe satisfação e pontos de melhoria com recortes agregados e protegidos.</p>
            <button className="secondary" onClick={() => go('feedbacks')}>Ver feedbacks</button>
          </article>
          <article className="card overview-card">
            <div className="overview-icon">□</div>
            <span className="eyebrow">GESTÃO</span>
            <h2>Unidades</h2>
            <p>Visualize empresas, refeitórios e a estrutura temporária usada na demonstração.</p>
            <button className="secondary" onClick={() => go('unidades')}>Ver unidades</button>
          </article>
        </section>

        <section className="card readiness-card">
          <div>
            <span className="eyebrow">STATUS DA DEMO</span>
            <h2>Fluxos disponíveis para apresentação</h2>
            <p>Os módulos abaixo já podem ser demonstrados mesmo sem a base oficial da Apetit.</p>
          </div>
          <div className="readiness-list">
            {[
              ['App do colaborador', 'Login, cardápio, prato, feedback e progresso'],
              ['Cardápios', 'Importação, prévia e publicação'],
              ['Fichas técnicas', 'Cadastro e importação em lote'],
              ['Feedbacks', 'Resumo agregado com proteção de privacidade'],
              ['Unidades', 'Base fictícia controlada para demonstração'],
            ].map(([title, desc]) => <div className="readiness-row" key={title}><span className="readiness-check">✓</span><div><strong>{title}</strong><small>{desc}</small></div></div>)}
          </div>
        </section>
      </main>
    </div>
  )
}
