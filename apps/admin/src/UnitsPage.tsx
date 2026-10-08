import { AdminUser } from './api'
import { DEMO_UNITS } from './demoUnits'
import { filterUnitsForUser, hasAdminPermission } from './access'
import './units.css'

export function UnitsPage({user}:{user:AdminUser|null}) {
  const visibleUnits=filterUnitsForUser(DEMO_UNITS,user)
  const canPublishMenus=hasAdminPermission(user,'publish_menu')
  const canManageSheets=hasAdminPermission(user,'manage_sheets')
  const canManageUsers=hasAdminPermission(user,'manage_users')

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">A</span><div><strong>APETIT</strong><small>Admin</small></div></div>
        <nav>
          <button className="nav-item" onClick={() => { window.location.hash = 'visao-geral' }}><span>⌂</span>Visão geral</button>
          {canPublishMenus&&<button className="nav-item" onClick={() => { window.location.hash = 'cardapios' }}><span>▣</span>Cardápios</button>}
          {canManageSheets&&<button className="nav-item" onClick={() => { window.location.hash = 'importar-fichas' }}><span>↥</span>Importações</button>}
          <button className="nav-item" onClick={() => { window.location.hash = 'fichas-tecnicas' }}><span>⌘</span>Fichas técnicas</button>
          <div className="nav-label">Experiência</div>
          <button className="nav-item" onClick={() => { window.location.hash = 'feedbacks' }}><span>♡</span>Feedbacks</button>
          <div className="nav-label">Gestão</div>
          <button className="nav-item active"><span>□</span>Unidades</button>
          {canManageUsers&&<button className="nav-item" onClick={() => { window.location.hash='empresas' }}><span>◫</span>Empresas</button>}
          <button className="nav-item" onClick={() => { window.location.hash='configuracoes' }}><span>⚙</span>Configurações</button>
        </nav>
        <div className="privacy-note"><strong>Escopo da sua conta</strong><p>Somente unidades atribuídas ao seu perfil aparecem neste painel.</p></div>
      </aside>

      <main className="main">
        <header className="topbar units-topbar">
          <div>
            <span className="eyebrow">GESTÃO · UNIDADES</span>
            <h1>Unidades atendidas</h1>
            <p>Visualização limitada ao escopo definido para sua conta.</p>
          </div>
          <span className="badge">{visibleUnits.length} unidade(s)</span>
        </header>

        <section className="units-summary">
          <div className="metric"><small>Empresas</small><strong>{new Set(visibleUnits.map(unit=>unit.company)).size}</strong><span>visíveis para sua conta</span></div>
          <div className="metric"><small>Unidades</small><strong>{visibleUnits.length}</strong><span>conforme suas permissões</span></div>
          <div className="metric"><small>Refeitórios</small><strong>{visibleUnits.length}</strong><span>ligados às unidades autorizadas</span></div>
        </section>

        <section className="demo-notice">
          <div><span>i</span></div>
          <p><strong>Dados de demonstração.</strong> Estes cadastros serão substituídos pela base oficial da Apetit mantendo a mesma estrutura de permissões.</p>
        </section>

        {visibleUnits.length===0&&<section className="card content-card"><h2>Nenhuma unidade atribuída</h2><p>Sua conta está ativa, mas ainda não possui acesso a nenhuma unidade. Um Administrador precisa atribuir pelo menos uma unidade ao seu perfil.</p></section>}
        <section className="units-grid">
          {visibleUnits.map((unit, index) => (
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
                {canPublishMenus&&<button className="secondary" onClick={() => { window.location.hash = 'cardapios' }}>Publicar cardápio</button>}
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

        {visibleUnits.length>0&&<section className="card units-next">
          <div>
            <span className="eyebrow">ACESSO</span>
            <h2>{canPublishMenus?'Operação liberada para suas unidades':'Consulta das unidades autorizadas'}</h2>
            <p>{canPublishMenus?'Você pode publicar cardápios somente nas unidades atribuídas ao seu perfil.':'Seu perfil é de consulta e não pode publicar ou alterar dados operacionais.'}</p>
          </div>
          {canPublishMenus?<button className="primary" onClick={() => { window.location.hash = 'cardapios' }}>Ir para cardápios</button>:<button className="primary" onClick={() => { window.location.hash = `unidade/${visibleUnits[0].unitId}` }}>Abrir unidade</button>}
        </section>}
      </main>
    </div>
  )
}
