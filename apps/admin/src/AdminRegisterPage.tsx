import { FormEvent, useState } from 'react'
import { registerAdminUser } from './api'

export function AdminRegisterPage(){
 const [name,setName]=useState('')
 const [email,setEmail]=useState('')
 const [password,setPassword]=useState('')
 const [confirmPassword,setConfirmPassword]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')

 async function submit(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');setNotice('')
  try{
   if(password!==confirmPassword) throw new Error('As senhas não coincidem.')
   const result=await registerAdminUser({name:name.trim(),email:email.trim(),password})
   setNotice(result.message)
   setPassword('');setConfirmPassword('')
  }catch(err){
   setError(err instanceof Error?err.message:'Não foi possível concluir o cadastro.')
  }finally{setBusy(false)}
 }

 return <main className="admin-login"><section className="login-card">
  <div className="brand login-brand"><span className="brand-mark">A</span><div><strong>APETIT</strong><small>Admin</small></div></div>
  <span className="eyebrow">CADASTRO DA EQUIPE</span>
  <h1>Criar conta</h1>
  <p>Cadastre seus dados para solicitar acesso ao Admin. Por segurança, a conta só será liberada depois da aprovação de um administrador.</p>
  <form onSubmit={submit}>
   <label><span>Nome completo</span><input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label>
   <label><span>E-mail</span><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
   <label><span>Senha</span><input type="password" minLength={8} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label>
   <label><span>Confirmar senha</span><input type="password" minLength={8} maxLength={128} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password"/></label>
   {error&&<div className="alert error" role="alert">{error}</div>}
   {notice&&<div className="alert" role="status">{notice}</div>}
   <button className="primary" disabled={busy||Boolean(notice)}>{busy?'Enviando...':notice?'Cadastro enviado':'Solicitar acesso'}</button>
  </form>
  <button type="button" className="secondary" onClick={()=>{window.location.hash='login'}}>Já tenho uma conta</button>
  <small className="login-help">Seu perfil e as unidades permitidas serão definidos pelo administrador após a aprovação.</small>
 </section></main>
}
