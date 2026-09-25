import { FeedbackDashboard } from './FeedbackDashboard'
import './feedback.css'

export function FeedbackPage({ initialUnitId }: { initialUnitId?: string } = {}) {
  function go(hash: string) {
    window.location.hash = hash
  }

  return (
    <div className="app-shell feedback-page">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">A</span><div><strong>APETIT</strong><small>Admin</small></div></div>
        <nav>
          <button className="nav-item" onClick={() => go('visao-geral')}><span>⌂</span>Visão geral</button>
          <button className="nav-item" onClick={() => go('cardapios')}><span>▣</span>Cardápios</button>
          <button className="nav-item" onClick={() => go('importar-fichas')}><span>↥</span>Importações</button>
          <div className="nav-label">Experiência</div>
          <button className="nav-item active"><span>♡</span>Feedbacks</button>
          <button className="nav-item active" onClick={() => go(initialUnitId ? `feedbacks/${initialUnitId}` : 'feedbacks')}><span>⌁</span>Satisfação</button>
          <div className="nav-label">Gestão</div>
          <button className="nav-item" onClick={() => go('unidades')}><span>□</span>Unidades</button>
          <button className="nav-item"><span>◫</span>Empresas</button>
          <button className="nav-item"><span>⚙</span>Configurações</button>
        </nav>
        <div className="privacy-note"><strong>Privacidade por padrão</strong><p>Recortes pequenos são ocultados e nenhum comentário inclui identidade do funcionário.</p></div>
      </aside>
      <main className="main"><FeedbackDashboard initialUnitId={initialUnitId} /></main>
    </div>
  )
}
