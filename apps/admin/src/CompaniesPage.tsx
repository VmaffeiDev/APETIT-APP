import { DEMO_UNITS } from './demoUnits'

export function CompaniesPage(){
  const companies=Array.from(new Set(DEMO_UNITS.map(unit=>unit.company)))
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">A</span><div><strong>APETIT</strong><small>Admin</small></div></div>
      <nav>
        <button className="nav-item" onClick={()=>location.hash='visao-geral'}>⌂ Visão geral</button>
        <div className="nav-label">Gestão</div>
        <button className="nav-item" onClick={()=>location.hash='unidades'}>□ Unidades</button>
        <button className="nav-item active">◫ Empresas</button>
        <button className="nav-item" onClick={()=>location.hash='usuarios'}>♙ Usuários e acessos</button>
        <button className="nav-item" onClick={()=>location.hash='configuracoes'}>⚙ Configurações</button>
      </nav>
    </aside>
    <main className="main">
      <header className="topbar"><div><span className="eyebrow">GESTÃO · EMPRESAS</span><h1>Empresas atendidas</h1><p>Visão das empresas e unidades disponíveis no ambiente de demonstração.</p></div><span className="badge">DEMO</span></header>
      <section className="overview-grid">
        {companies.map(company=>{
          const units=DEMO_UNITS.filter(unit=>unit.company===company)
          return <article className="card overview-card" key={company}>
            <div className="overview-icon">◫</div>
            <h2>{company}</h2>
            <p>{units.length} unidade(s) cadastrada(s) neste ambiente.</p>
            <div className="readiness-list">
              {units.map(unit=><div className="readiness-row" key={unit.unitId}><span className="readiness-check">✓</span><div><strong>{unit.unitName.replace(' — Demonstração','')}</strong><small>{unit.restaurantName.replace(' — Demo','')}</small></div></div>)}
            </div>
            <button className="secondary" onClick={()=>location.hash=`unidade/${units[0].unitId}`}>Abrir unidade</button>
          </article>
        })}
      </section>
      <div className="alert warning"><strong>Dados de demonstração</strong><p>As empresas desta tela são fictícias/controladas para apresentação e serão substituídas pela base oficial quando houver integração.</p></div>
    </main>
  </div>
}
