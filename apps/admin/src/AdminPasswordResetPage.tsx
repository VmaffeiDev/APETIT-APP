import { FormEvent, useState } from 'react'
import { confirmAdminPasswordReset, requestAdminPasswordReset } from './api'

export function AdminPasswordResetPage(){
 const [step,setStep]=useState<'request'|'confirm'|'done'>('request')
 const [email,setEmail]=useState('')
 const [code,setCode]=useState('')
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
   setStep('confirm')
  }catch(err){setError(err instanceof Error?err.message:'Não foi possível solicitar a recuperação.')}
  finally{setBusy(false)}
 }

 async function confirmReset(e:FormEvent){
  e.preventDefault();setError('')
  if(password!==confirmPassword){setError('As senhas não coincidem.');return}
  if(password.length<8){setError('A nova senha deve ter pelo menos 8 caracteres.');return}
  if(!/^\d{6}$/.test(code.trim())){setError('Digite o código de 6 dígitos enviado por e-mail.');return}
  setBusy(true)
  try{
   await confirmAdminPasswordReset(email.trim(),code.trim(),password)
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
   <p>Informe o e-mail da sua conta. Enviaremos um código de 6 dígitos para confirmar a redefinição.</p>
   <form onSubmit={requestReset}>
    <label><span>E-mail</span><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
    {error&&<div className="alert error">{error}</div>}
    <button className="primary" disabled={busy}>{busy?'Enviando...':'Enviar código'}</button>
   </form>
  </>}

  {step==='confirm'&&<>
   <p>{message||'Se existir uma conta ativa com este e-mail, um código será enviado.'}</p>
   <form onSubmit={confirmReset}>
    <label><span>E-mail</span><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
    <label><span>Código de 6 dígitos</span><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} autoComplete="one-time-code"/></label>
    <label><span>Nova senha</span><input type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label>
    <label><span>Confirmar nova senha</span><input type="password" minLength={8} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password"/></label>
    {error&&<div className="alert error">{error}</div>}
    <button className="primary" disabled={busy}>{busy?'Redefinindo...':'Redefinir senha'}</button>
    <button className="secondary" type="button" disabled={busy} onClick={()=>{setStep('request');setCode('');setError('')}}>Enviar outro código</button>
   </form>
  </>}

  {step==='done'&&<>
   <div className="alert success">{message}</div>
   <button className="primary" onClick={()=>{window.location.hash='login'}}>Entrar com a nova senha</button>
  </>}

  {step!=='done'&&<button className="secondary" type="button" onClick={()=>{window.location.hash='login'}}>Voltar para o login</button>}
 </section></main>
}
