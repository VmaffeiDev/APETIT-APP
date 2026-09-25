import { adminLogout, getAdminToken, isPresentationMode, setAdminToken } from './api'

export function SettingsPage(){
  const hasSession=Boolean(getAdminToken())
  async function logout(){
    try{ if(hasSession) await adminLogout() }catch{ setAdminToken('') }
    location.hash='visao-geral'
    location.reload()
  }
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">A</span><div><strong>APETIT</strong><small>Admin</small></div></div>
      <nav>
        <button className="nav-item" onClick={()=>location.hash='visao-geral'}>⌂ Visão geral</button>
        <div className="nav-label">Gestão</div>
        <button className="nav-item" onClick={()=>location.hash='unidades'}>□ Unidades</button>
        <button className="nav-item" onClick={()=>location.hash='empresas'}>◫ Empresas</button>
        <button className="nav-item" onClick={()=>location.hash='usuarios'}>♙ Usuários e acessos</button>
        <button className="nav-item active">⚙ Configurações</button>
      </nav>
    </aside>
    <main className="main">
      <header className="topbar"><div><span className="eyebrow">GESTÃO · CONFIGURAÇÕES</span><h1>Configurações do Admin</h1><p>Ambiente, sessão administrativa e atalhos de gestão.</p></div></header>
      <section className="overview-grid">
        <article className="card overview-card"><div className="overview-icon">⚙</div><h2>Ambiente</h2><p>{isPresentationMode?'Modo de apresentação ativo.':'Modo autenticado ativo.'}</p><span className="status-pill"><span className="status-dot" />{isPresentationMode?'Demonstração':'Autenticado'}</span></article>
        <article className="card overview-card"><div className="overview-icon">♙</div><h2>Sessão administrativa</h2><p>{hasSession?'Existe uma sessão individual salva neste dispositivo.':'Nenhuma sessão individual salva neste dispositivo.'}</p>{hasSession&&<button className="secondary" onClick={logout}>Sair da conta</button>}</article>
        <article className="card overview-card"><div className="overview-icon">□</div><h2>Unidades</h2><p>Gerencie e consulte as unidades disponíveis no painel.</p><button className="secondary" onClick={()=>location.hash='unidades'}>Abrir unidades</button></article>
        <article className="card overview-card"><div className="overview-icon">♙</div><h2>Usuários e permissões</h2><p>Gerencie contas individuais, perfis e acessos.</p><button className="secondary" onClick={()=>location.hash='usuarios'}>Abrir acessos</button></article>
      </section>
      <div className="alert warning"><strong>Configurações avançadas ainda não estão liberadas</strong><p>Integrações oficiais, identidade visual por empresa e parâmetros de produção serão ativados quando a base real da APETIT estiver conectada.</p></div>
    </main>
  </div>
}
