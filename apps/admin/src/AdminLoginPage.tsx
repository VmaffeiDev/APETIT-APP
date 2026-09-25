import { FormEvent, useState } from 'react'
import { adminLogin, confirmAdminPasswordRecovery, requestAdminPasswordRecovery, setAdminToken } from './api'

type Mode='login'|'recovery'

export function AdminLoginPage({onSuccess}:{onSuccess:()=>void}){
 const [mode,setMode]=useState<Mode>('login')
 const [email,setEmail]=useState('')
 const [password,setPassword]=useState('')
 const [code,setCode]=useState('')
 const [newPassword,setNewPassword]=useState('')
 const [confirmPassword,setConfirmPassword]=useState('')
 const [codeRequested,setCodeRequested]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')

 async function submitLogin(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');setMessage('')
  try{
   const result=await adminLogin(email.trim(),password)
   setAdminToken(result.token)
   onSuccess()
  }catch(err){
   setError(err instanceof Error?err.message:'Não foi possível entrar.')
  }finally{setBusy(false)}
 }

 async function requestCode(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');setMessage('')
  try{
   const result=await requestAdminPasswordRecovery(email.trim())
   setCodeRequested(true)
   setMessage(result.message||'Se houver uma conta ativa, enviaremos um código de recuperação.')
  }catch(err){
   setError(err instanceof Error?err.message:'Não foi possível solicitar a recuperação.')
  }finally{setBusy(false)}
 }

 async function resetPassword(e:FormEvent){
  e.preventDefault();setError('');setMessage('')
  if(newPassword.length<8){setError('A nova senha precisa ter pelo menos 8 caracteres.');return}
  if(newPassword!==confirmPassword){setError('A confirmação da nova senha não confere.');return}
  setBusy(true)
  try{
   const result=await confirmAdminPasswordRecovery(email.trim(),code.trim(),newPassword)
   setMode('login');setPassword('');setCode('');setNewPassword('');setConfirmPassword('');setCodeRequested(false)
   setMessage(result.message||'Senha redefinida. Entre com a nova senha.')
  }catch(err){
   setError(err instanceof Error?err.message:'Não foi possível redefinir a senha.')
  }finally{setBusy(false)}
 }

 return <main className="admin-login"><section className="login-card">
  <div className="brand login-brand"><span className="brand-mark">A</span><div><strong>APETIT</strong><small>Admin</small></div></div>

  {mode==='login'?<>
   <span className="eyebrow">ACESSO DA EQUIPE</span><h1>Entrar no Admin</h1><p>Use sua conta individual. Suas publicações e alterações serão vinculadas ao seu usuário.</p>
   <form onSubmit={submitLogin}>
    <label><span>E-mail</span><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/></label>
    <label><span>Senha</span><input type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>
    {error&&<div className="alert error">{error}</div>}{message&&<div className="alert success">{message}</div>}
    <button className="primary" disabled={busy}>{busy?'Entrando...':'Entrar'}</button>
   </form>
   <button className="secondary" type="button" onClick={()=>{setMode('recovery');setError('');setMessage('')}}>Esqueci minha senha</button>
   <small className="login-help">Cada pessoa deve usar sua própria conta. Não compartilhe senhas.</small>
  </>:<>
   <span className="eyebrow">RECUPERAÇÃO DE ACESSO</span><h1>Redefinir senha</h1><p>Informe o e-mail da sua conta administrativa. O código de recuperação expira em 15 minutos.</p>
   {!codeRequested?<form onSubmit={requestCode}>
    <label><span>E-mail</span><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
    {error&&<div className="alert error">{error}</div>}{message&&<div className="alert success">{message}</div>}
    <button className="primary" disabled={busy}>{busy?'Enviando...':'Enviar código'}</button>
   </form>:<form onSubmit={resetPassword}>
    <label><span>E-mail</span><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
    <label><span>Código de recuperação</span><input inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,10))} autoComplete="one-time-code"/></label>
    <label><span>Nova senha</span><input type="password" minLength={8} maxLength={128} required value={newPassword} onChange={e=>setNewPassword(e.target.value)} autoComplete="new-password"/></label>
    <label><span>Confirmar nova senha</span><input type="password" minLength={8} maxLength={128} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password"/></label>
    {error&&<div className="alert error">{error}</div>}{message&&<div className="alert success">{message}</div>}
    <button className="primary" disabled={busy}>{busy?'Redefinindo...':'Salvar nova senha'}</button>
   </form>}
   <button className="secondary" type="button" onClick={()=>{setMode('login');setCodeRequested(false);setError('');setMessage('')}}>Voltar para entrar</button>
  </>}
 </section></main>
}
