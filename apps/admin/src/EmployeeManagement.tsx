import { FormEvent, useEffect, useState } from 'react'
import { EmployeeAccess, EmployeeUnit, assignEmployeeUnit, getEmployeeUnits, listEmployees } from './api'

export function EmployeeManagement() {
  const [employees, setEmployees] = useState<EmployeeAccess[]>([])
  const [units, setUnits] = useState<EmployeeUnit[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState({ q: '', unassigned: false, offset: 0 })
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState<EmployeeAccess | null>(null)
  const [unitId, setUnitId] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setEmployees([])
    setHasMore(false)
    Promise.all([listEmployees(filter.q, filter.unassigned, filter.offset), getEmployeeUnits()])
      .then(([result, options]) => {
        if (cancelled) return
        setEmployees(result.employees)
        setHasMore(result.has_more)
        setUnits(options.units)
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Falha ao carregar funcionários.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filter, revision])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!editing || !unitId || saving) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await assignEmployeeUnit(editing.id, unitId)
      setSuccess(`Vínculo de ${editing.name || editing.email || 'funcionário'} atualizado. A alteração foi registrada na auditoria.`)
      setEditing(null)
      setRevision(v => v + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar vínculo.')
    } finally { setSaving(false) }
  }

  return <section className="card content-card" aria-labelledby="employee-heading">
    <div className="section-heading"><div><span className="eyebrow">APP DO FUNCIONÁRIO</span><h2 id="employee-heading">Funcionários e unidades</h2><p>Após o primeiro acesso por e-mail, vincule o funcionário à unidade para liberar seu cadastro no aplicativo.</p></div></div>
    <form className="form-grid" onSubmit={event => { event.preventDefault(); setFilter(current => ({ ...current, q: search.trim(), offset: 0 })); setSuccess('') }}>
      <label><span>Buscar por nome ou e-mail</span><input maxLength={120} value={search} disabled={saving} onChange={event => setSearch(event.target.value)} placeholder="Nome ou e-mail do funcionário" /></label>
      <label><span>Vínculo</span><select value={String(filter.unassigned)} disabled={saving} onChange={event => setFilter(current => ({ ...current, unassigned: event.target.value === 'true', offset: 0 }))}><option value="false">Todos os funcionários</option><option value="true">Aguardando unidade</option></select></label>
      <button className="secondary" disabled={loading || saving}>Buscar funcionários</button>
    </form>
    {error && <div className="alert error" role="alert">{error}<button type="button" className="secondary" disabled={saving || loading} onClick={() => setRevision(v => v + 1)}>Tentar novamente</button></div>}
    {success && <p role="status">{success}</p>}
    {loading ? <p role="status">Carregando funcionários...</p> : !error && employees.length === 0 ? <p>Nenhum funcionário encontrado para este filtro.</p> : null}
    <div className="user-list">{employees.map(person => <article className="user-row" key={person.id}>
      <div><strong>{person.name || 'Cadastro pendente'}</strong><small>{person.email || 'E-mail não informado'}</small></div>
      <div><span className="badge soft">{person.unit_name || 'Aguardando unidade'}</span><small>{person.company_name || 'Sem vínculo'}</small></div>
      <button type="button" className="secondary" disabled={saving || loading} onClick={() => { setEditing(person); setUnitId(person.unit_id || ''); setSuccess(''); setError('') }}>Alterar vínculo</button>
    </article>)}</div>
    <div className="action-row"><button type="button" className="secondary" disabled={loading || saving || filter.offset === 0} onClick={() => setFilter(current => ({ ...current, offset: Math.max(0, current.offset - 25) }))}>Anterior</button><span>Página {Math.floor(filter.offset / 25) + 1}</span><button type="button" className="secondary" disabled={loading || saving || !hasMore} onClick={() => setFilter(current => ({ ...current, offset: current.offset + 25 }))}>Próxima</button></div>
    {editing && <form className="access-editor" onSubmit={save}>
      <h3>Vincular {editing.name || editing.email || 'funcionário'}</h3>
      <p>Unidade atual: {editing.unit_name || 'Sem unidade'}. A nova unidade define o cardápio e as operações disponíveis no aplicativo.</p>
      <label><span>Nova unidade</span><select required value={unitId} disabled={saving} onChange={event => setUnitId(event.target.value)}><option value="">Selecione uma unidade</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.company_name} · {unit.name}</option>)}</select></label>
      {!units.length && <p>Nenhuma unidade disponível para vincular.</p>}
      <p>Após a alteração, peça ao funcionário para sair e entrar novamente no aplicativo.</p>
      <div className="access-editor-actions"><button type="button" className="secondary" disabled={saving} onClick={() => setEditing(null)}>Cancelar</button><button className="primary" disabled={saving || !unitId || unitId === editing.unit_id}>{saving ? 'Salvando...' : 'Confirmar vínculo'}</button></div>
    </form>}
  </section>
}
