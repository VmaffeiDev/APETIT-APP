import { FormEvent, useState } from 'react'
import { adminLogin, setAdminToken } from './api'

export function AdminLoginPage({onSuccess}:{onSuccess:()=>void}){
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('')
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{const result=await adminLogin(email.trim(),password);setAdminToken(result.token);onSuccess()}catch(err){setError(err instanceof Error?err.message:'Não foi possível entrar.')}finally{setBusy(false)}}
 return <main className="admin-login"><section className="login-card">
  <div className="brand login-brand"><span className="brand-mark">A</span><div><strong>APETIT</strong><small>Admin</small></div></div>
  <span className="eyebrow">ACESSO DA EQUIPE</span><h1>Entrar no Admin</h1><p>Use sua conta individual. Suas publicações e alterações serão vinculadas ao seu usuário.</p>
  <form onSubmit={submit}><label><span>E-mail</span><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/></label><label><span>Senha</span><input type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>
  {error&&<div className="alert error">{error}</div>}<button className="primary" disabled={busy}>{busy?'Entrando...':'Entrar'}</button></form>
  <small className="login-help">Cada pessoa deve usar sua própria conta. Não compartilhe senhas.</small>
 </section></main>
}
