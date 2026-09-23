import { FormEvent, useState } from 'react'
import { adminLogin, setAdminToken, requestAdminPasswordRecovery, confirmAdminPasswordRecovery } from './api'

export function AdminLoginPage({onSuccess}:{onSuccess:()=>void}){
 const [email,setEmail]=useState('')
 const [password,setPassword]=useState('')
 const [mode,setMode]=useState<'login'|'request'|'confirm'>('login')
 const [code,setCode]=useState('')
 const [newPassword,setNewPassword]=useState('')
 const [confirmPassword,setConfirmPassword]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')

 async function submit(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');setNotice('')
  try {
   if(mode==='login'){
    const result=await adminLogin(email.trim(),password)
    setAdminToken(result.token);onSuccess()
   }else if(mode==='request'){
    const result=await requestAdminPasswordRecovery(email.trim())
    setNotice(result.message)
    setMode('confirm')
   }else{
    if(newPassword!==confirmPassword) throw new Error('As senhas não coincidem.')
    const result=await confirmAdminPasswordRecovery(email.trim(),code.trim(),newPassword)
    setNotice(result.message)
    setPassword('');setCode('');setNewPassword('');setConfirmPassword('');setMode('login')
   }
  }catch(err){setError(err instanceof Error?err.message:'Não foi possível concluir a solicitação.')}
  finally{setBusy(false)}
 }
 return <main className="admin-login"><section className="login-card">
  <div className="brand login-brand"><span className="brand-mark">A</span><div><strong>APETIT</strong><small>Admin</small></div></div>
  <span className="eyebrow">ACESSO DA EQUIPE</span>
  <h1>{mode==='login'?'Entrar no Admin':mode==='request'?'Recuperar senha':'Definir nova senha'}</h1>
  <p>{mode==='login'?'Use sua conta individual. Suas publicações e alterações serão vinculadas ao seu usuário.':mode==='request'?'Informe o e-mail da sua conta. Se ela estiver ativa, você receberá um código de recuperação.':'Digite o código enviado ao seu e-mail e escolha uma nova senha.'}</p>
  <form onSubmit={submit}>
   <label><span>E-mail</span><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/></label>
   {mode==='login'&&<label><span>Senha</span><input type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>}
   {mode==='confirm'&&<>
    <label><span>Código de recuperação</span><input inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} required value={code} onChange={e=>setCode(e.target.value.replace(/[^0-9]/g,''))} autoComplete="one-time-code" placeholder="10 dígitos"/></label>
    <label><span>Nova senha</span><input type="password" minLength={8} maxLength={128} required value={newPassword} onChange={e=>setNewPassword(e.target.value)} autoComplete="new-password"/></label>
    <label><span>Confirme a nova senha</span><input type="password" minLength={8} maxLength={128} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password"/></label>
   </>}
   {error&&<div className="alert error" role="alert">{error}</div>}
   {notice&&<div className="alert" role="status">{notice}</div>}
   <button className="primary" disabled={busy}>{busy?'Aguarde...':mode==='login'?'Entrar':mode==='request'?'Enviar código':'Salvar nova senha'}</button>
  </form>
  {mode==='login'?<button type="button" className="secondary" onClick={()=>{setMode('request');setError('');setNotice('')}}>Esqueci minha senha</button>:<div className="login-help"><button type="button" className="secondary" onClick={()=>{setMode('login');setError('');setNotice('')}}>Voltar ao login</button>{mode==='confirm'&&<button type="button" className="secondary" onClick={()=>{setMode('request');setError('');setNotice('')}}>Solicitar outro código</button>}</div>}
  <small className="login-help">Não compartilhe sua senha ou código de recuperação.</small>
 </section></main>
}
