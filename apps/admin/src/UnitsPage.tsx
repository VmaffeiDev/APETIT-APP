import { AdminSidebar } from './AdminSidebar'
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
      <AdminSidebar />

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
                <div className={`company-avatar company-${index + 1}`}><span aria-label={unit.company}>{unit.company.slice(0, 2).toUpperCase()}</span></div>
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
