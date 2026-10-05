import { FormEvent, useState } from 'react'
import { adminLogout, changeAdminPassword, getAdminToken, isPresentationMode, setAdminToken } from './api'

export function SettingsPage(){
  const hasSession=Boolean(getAdminToken())
  const [currentPassword,setCurrentPassword]=useState('')
  const [newPassword,setNewPassword]=useState('')
  const [confirmPassword,setConfirmPassword]=useState('')
  const [changingPassword,setChangingPassword]=useState(false)
  const [passwordError,setPasswordError]=useState('')
  const [passwordMessage,setPasswordMessage]=useState('')

  async function logout(){
    try{ if(hasSession) await adminLogout() }catch{ setAdminToken('') }
    location.hash='visao-geral'
    location.reload()
  }

  async function submitPassword(event:FormEvent){
    event.preventDefault()
    setPasswordError('')
    setPasswordMessage('')
    if(newPassword.length<8){
      setPasswordError('A nova senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if(newPassword!==confirmPassword){
      setPasswordError('A confirmação da nova senha não confere.')
      return
    }
    if(currentPassword===newPassword){
      setPasswordError('A nova senha deve ser diferente da senha atual.')
      return
    }
    setChangingPassword(true)
    try{
      await changeAdminPassword(currentPassword,newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('Senha alterada com sucesso. As outras sessões desta conta foram encerradas.')
    }catch(error){
      setPasswordError(error instanceof Error?error.message:'Não foi possível alterar a senha.')
    }finally{
      setChangingPassword(false)
    }
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
      <header className="topbar"><div><span className="eyebrow">GESTÃO · CONFIGURAÇÕES</span><h1>Configurações do Admin</h1><p>Ambiente, segurança da conta e atalhos de gestão.</p></div></header>

      <section className="overview-grid">
        <article className="card overview-card"><div className="overview-icon">⚙</div><h2>Ambiente</h2><p>{isPresentationMode?'Modo de apresentação ativo.':'Modo autenticado ativo.'}</p><span className="status-pill"><span className="status-dot" />{isPresentationMode?'Demonstração':'Autenticado'}</span></article>

        <article className="card overview-card"><div className="overview-icon">♙</div><h2>Sessão administrativa</h2><p>{hasSession?'Existe uma sessão individual salva neste dispositivo.':'Nenhuma sessão individual salva neste dispositivo.'}</p>{hasSession?<button className="secondary" onClick={logout}>Sair da conta</button>:<button className="secondary" onClick={()=>location.hash='login'}>Entrar na conta</button>}</article>

        <article className="card overview-card"><div className="overview-icon">□</div><h2>Unidades</h2><p>Gerencie e consulte as unidades disponíveis no painel.</p><button className="secondary" onClick={()=>location.hash='unidades'}>Abrir unidades</button></article>

        <article className="card overview-card"><div className="overview-icon">♙</div><h2>Usuários e permissões</h2><p>Gerencie contas individuais, perfis e acessos.</p><button className="secondary" onClick={()=>location.hash='usuarios'}>Abrir acessos</button></article>
      </section>

      <section className="card content-card">
        <div className="section-heading"><div><span className="eyebrow">SEGURANÇA DA CONTA</span><h2>Alterar senha</h2><p>Atualize sua própria senha sem depender de outro administrador.</p></div></div>

        {hasSession ? <form className="form-grid" onSubmit={submitPassword}>
          <label><span>Senha atual</span><input type="password" autoComplete="current-password" required minLength={8} maxLength={128} value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} /></label>
          <label><span>Nova senha</span><input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={newPassword} onChange={e=>setNewPassword(e.target.value)} /></label>
          <label><span>Confirmar nova senha</span><input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} /></label>
          <div>
            <button className="primary" disabled={changingPassword}>{changingPassword?'Alterando...':'Alterar senha'}</button>
          </div>
        </form> : <div className="alert warning"><strong>Entre com sua conta individual</strong><p>A alteração de senha só fica disponível após autenticação individual.</p><button className="secondary" onClick={()=>location.hash='login'}>Entrar para alterar senha</button></div>}

        {passwordError&&<div className="alert error"><strong>Não foi possível alterar a senha</strong><p>{passwordError}</p></div>}
        {passwordMessage&&<div className="alert success"><strong>Senha atualizada</strong><p>{passwordMessage}</p></div>}
      </section>

      <div className="alert warning"><strong>Configurações avançadas ainda não estão liberadas</strong><p>Integrações oficiais, identidade visual por empresa e parâmetros de produção serão ativados quando a base real da APETIT estiver conectada.</p></div>
    </main>
  </div>
}
