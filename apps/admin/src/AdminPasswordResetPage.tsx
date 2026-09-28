import { FormEvent, useMemo, useState } from 'react'
import { confirmAdminPasswordReset, requestAdminPasswordReset } from './api'

export function AdminPasswordResetPage(){
 const params=useMemo(()=>new URLSearchParams(window.location.search),[])
 const initialToken=params.get('reset_token')??''
 const initialEmail=params.get('email')??''
 const [step,setStep]=useState<'request'|'confirm'|'sent'|'done'>(initialToken&&initialEmail?'confirm':'request')
 const [email,setEmail]=useState(initialEmail)
 const [token]=useState(initialToken)
 const [password,setPassword]=useState('')
 const [confirmPassword,setConfirmPassword]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')

 async function requestReset(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');setMessage('')
  try{
   const result=await requestAdminPasswordReset(email.trim())
   setMessage(result.message)
   setStep('sent')
  }catch(err){setError(err instanceof Error?err.message:'Não foi possível solicitar a recuperação.')}
  finally{setBusy(false)}
 }

 async function confirmReset(e:FormEvent){
  e.preventDefault();setError('')
  if(password!==confirmPassword){setError('As senhas não coincidem.');return}
  if(password.length<8){setError('A nova senha deve ter pelo menos 8 caracteres.');return}
  if(!token||!email){setError('Este link de redefinição é inválido. Solicite um novo link.');return}
  setBusy(true)
  try{
   await confirmAdminPasswordReset(email.trim(),token,password)
   window.history.replaceState({},'',window.location.pathname+'#redefinir-senha')
   setStep('done')
   setMessage('Senha redefinida com sucesso. Todas as sessões anteriores foram encerradas.')
  }catch(err){setError(err instanceof Error?err.message:'Não foi possível redefinir a senha.')}
  finally{setBusy(false)}
 }

 return <main className="admin-login"><section className="login-card">
  <div className="brand login-brand"><span className="brand-mark">A</span><div><strong>APETIT</strong><small>Admin</small></div></div>
  <span className="eyebrow">RECUPERAÇÃO DE ACESSO</span>
  <h1>Redefinir senha</h1>

  {step==='request'&&<>
   <p>Informe o e-mail da sua conta. Enviaremos um link seguro para criar uma nova senha.</p>
   <form onSubmit={requestReset}>
    <label><span>E-mail</span><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
    {error&&<div className="alert error">{error}</div>}
    <button className="primary" disabled={busy}>{busy?'Enviando...':'Enviar link de redefinição'}</button>
   </form>
  </>}

  {step==='sent'&&<>
   <div className="alert success"><strong>Confira seu e-mail</strong><p>{message||'Se existir uma conta ativa com este e-mail, enviaremos um link para criar uma nova senha.'}</p></div>
   <button className="secondary" type="button" onClick={()=>{setStep('request');setError('')}}>Solicitar novo link</button>
  </>}

  {step==='confirm'&&<>
   <p>Digite somente a nova senha que deseja usar no APETIT Admin.</p>
   <form onSubmit={confirmReset}>
    <label><span>Nova senha</span><input type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label>
    <label><span>Confirmar nova senha</span><input type="password" minLength={8} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password"/></label>
    {error&&<div className="alert error">{error}</div>}
    <button className="primary" disabled={busy}>{busy?'Redefinindo...':'Redefinir senha'}</button>
   </form>
  </>}

  {step==='done'&&<>
   <div className="alert success">{message}</div>
   <button className="primary" onClick={()=>{window.location.hash='login'}}>Entrar com a nova senha</button>
  </>}

  {step!=='done'&&<button className="secondary" type="button" onClick={()=>{window.location.hash='login'}}>Voltar para o login</button>}
 </section></main>
}
