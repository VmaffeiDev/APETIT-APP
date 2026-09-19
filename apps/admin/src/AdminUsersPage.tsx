import { FormEvent, useEffect, useState } from 'react'
import { AdminUser, createAdminUser, listAdminUsers } from './api'

const roles:Record<string,string>={admin:'Administrador',operacao:'Operação',nutricao:'Nutrição',visualizacao:'Visualização'}
export function AdminUsersPage(){
 const [users,setUsers]=useState<AdminUser[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState(false)
 const [form,setForm]=useState({name:'',email:'',password:'',role:'operacao'})
 const load=()=>listAdminUsers().then(r=>setUsers(r.users)).catch(e=>setError(e instanceof Error?e.message:'Falha ao carregar usuários.'))
 useEffect(()=>{void load()},[])
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await createAdminUser({...form,unit_ids:[]});setForm({name:'',email:'',password:'',role:'operacao'});await load()}catch(e){setError(e instanceof Error?e.message:'Não foi possível criar usuário.')}finally{setBusy(false)}}
 return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">A</span><div><strong>APETIT</strong><small>Admin</small></div></div><nav><button className="nav-item" onClick={()=>location.hash='visao-geral'}>⌂ Visão geral</button><button className="nav-item active">♙ Usuários e acessos</button></nav></aside><main className="main">
 <header className="topbar"><div><span className="eyebrow">GESTÃO · ACESSOS</span><h1>Usuários e permissões</h1><p>Crie contas individuais para tornar as ações do Admin rastreáveis.</p></div></header>
 {error&&<div className="alert error">{error}</div>}
 <section className="card content-card"><div className="section-heading"><div><h2>Novo usuário</h2><p>Administrador gerencia acessos; Operação publica/restaura; Nutrição publica e mantém fichas; Visualização apenas consulta.</p></div></div>
 <form className="form-grid" onSubmit={submit}><label><span>Nome</span><input required minLength={2} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label><span>E-mail</span><input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label><span>Senha inicial</span><input required type="password" minLength={8} value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label><label><span>Perfil</span><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>{Object.entries(roles).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><button className="primary" disabled={busy}>{busy?'Criando...':'Criar usuário'}</button></form></section>
 <section className="card history-card"><div className="section-heading"><div><span className="eyebrow">EQUIPE</span><h2>{users.length} usuário(s)</h2></div></div><div className="user-list">{users.map(u=><article className="user-row" key={u.id??u.email??u.name}><div><strong>{u.name}</strong><small>{u.email}</small></div><span className="badge soft">{roles[u.role]??u.role}</span><span className={u.active===false?'badge':'status-pill'}>{u.active===false?'Inativo':'Ativo'}</span></article>)}</div></section>
 </main></div>
}
