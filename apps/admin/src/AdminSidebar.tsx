import { createContext, useContext } from 'react'
import { AdminUser } from './api'
import { hasAdminPermission } from './access'

export const AdminUserContext = createContext<AdminUser | null>(null)

const links = [
  { hash: 'visao-geral', label: 'Visão geral', icon: '⌂', group: 'Operação' },
  { hash: 'cardapios', label: 'Cardápios', icon: '▣', group: 'Operação', permission: 'publish_menu' },
  { hash: 'historico-cardapios', label: 'Histórico de publicações', icon: '◷', group: 'Operação' },
  { hash: 'calendario-cardapios', label: 'Calendário semanal', icon: '▦', group: 'Operação' },
  { hash: 'fichas-tecnicas', label: 'Fichas técnicas', icon: '⌘', group: 'Operação' },
  { hash: 'importar-fichas', label: 'Importar fichas', icon: '↥', group: 'Operação', permission: 'manage_sheets' },
  { hash: 'feedbacks', label: 'Satisfação e feedbacks', icon: '♡', group: 'Experiência' },
  { hash: 'relatorio-executivo', label: 'Relatório executivo', icon: '▤', group: 'Experiência' },
  { hash: 'unidades', label: 'Unidades', icon: '□', group: 'Gestão' },
  { hash: 'empresas', label: 'Empresas', icon: '◫', group: 'Gestão', permission: 'manage_users' },
  { hash: 'usuarios', label: 'Usuários e acessos', icon: '♙', group: 'Gestão', permission: 'manage_users' },
  { hash: 'configuracoes', label: 'Configurações', icon: '⚙', group: 'Gestão' },
] as const

export function AdminSidebar() {
  const user = useContext(AdminUserContext)
  const route = (window.location.hash.slice(1) || 'visao-geral').split('/')[0]
  const active = route === 'unidade' ? 'unidades' : route
  const visible = links.filter(link => !('permission' in link) || hasAdminPermission(user, link.permission))
  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark">A</span><div><strong>APETIT</strong><small>Admin</small></div></div>
    <nav aria-label="Navegação administrativa">{['Operação','Experiência','Gestão'].map(group => <div key={group}>
      <div className="nav-label">{group}</div>
      {visible.filter(link => link.group === group).map(link => <button key={link.hash} type="button" className={`nav-item${active === link.hash ? ' active' : ''}`} aria-current={active === link.hash ? 'page' : undefined} onClick={() => { window.location.hash = link.hash }}><span>{link.icon}</span>{link.label}</button>)}
    </div>)}</nav>
    <div className="privacy-note"><strong>Privacidade por padrão</strong><p>Dados alimentares individuais não aparecem neste painel.</p></div>
  </aside>
}
