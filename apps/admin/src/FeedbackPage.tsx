import { FeedbackDashboard } from './FeedbackDashboard'
import { AdminUser } from './api'
import { hasAdminPermission } from './access'
import './feedback.css'

export function FeedbackPage({ initialUnitId, user }: { initialUnitId?: string; user: AdminUser | null }) {
  const canPublishMenus=hasAdminPermission(user,'publish_menu')
  const canManageSheets=hasAdminPermission(user,'manage_sheets')
  const canManageUsers=hasAdminPermission(user,'manage_users')
  function go(hash: string) {
    window.location.hash = hash
  }

  return (
    <div className="app-shell feedback-page">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">A</span><div><strong>APETIT</strong><small>Admin</small></div></div>
        <nav>
          <button className="nav-item" onClick={() => go('visao-geral')}><span>⌂</span>Visão geral</button>
          {canPublishMenus&&<button className="nav-item" onClick={() => go('cardapios')}><span>▣</span>Cardápios</button>}
          {canManageSheets&&<button className="nav-item" onClick={() => go('importar-fichas')}><span>↥</span>Importações</button>}
          <div className="nav-label">Experiência</div>
          <button className="nav-item active"><span>♡</span>Feedbacks</button>
          <button className="nav-item active" onClick={() => go(initialUnitId ? `feedbacks/${initialUnitId}` : 'feedbacks')}><span>⌁</span>Satisfação</button>
          <div className="nav-label">Gestão</div>
          <button className="nav-item" onClick={() => go('unidades')}><span>□</span>Unidades</button>
          {canManageUsers&&<button className="nav-item" onClick={() => go('empresas')}><span>◫</span>Empresas</button>}
          <button className="nav-item" onClick={() => go('configuracoes')}><span>⚙</span>Configurações</button>
        </nav>
        <div className="privacy-note"><strong>Privacidade por padrão</strong><p>Indicadores exigem ao menos 5 pessoas distintas. Comentários livres ficam ocultos até revisão de privacidade.</p></div>
      </aside>
      <main className="main"><FeedbackDashboard initialUnitId={initialUnitId} user={user} /></main>
    </div>
  )
}
