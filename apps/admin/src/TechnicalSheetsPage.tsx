import { useEffect, useState } from 'react'
import { getTechnicalSheet, listTechnicalSheets, saveTechnicalSheet, TechnicalSheet, TechnicalSheetSummary } from './api'

const emptySheet: Omit<TechnicalSheet, 'code' | 'updated_at'> = {
  name: '', category: '', portion_quantity: null, portion_unit: 'g', kcal: null,
  protein_g: null, carbs_g: null, fat_g: null, ingredients: [], allergens: [],
}

const n = (value: string) => value.trim() === '' ? null : Number(value)

export function TechnicalSheetsPage() {
  const [adminKey, setAdminKey] = useState('')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<TechnicalSheetSummary[]>([])
  const [code, setCode] = useState('')
  const [form, setForm] = useState(emptySheet)
  const [ingredientsText, setIngredientsText] = useState('')
  const [allergensText, setAllergensText] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!adminKey.trim()) return
    setBusy(true); setMessage('')
    try { setItems((await listTechnicalSheets(adminKey.trim(), search)).items) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao carregar fichas.') }
    finally { setBusy(false) }
  }

  async function open(itemCode: string) {
    setBusy(true); setMessage('')
    try {
      const sheet = await getTechnicalSheet(adminKey.trim(), itemCode)
      setCode(sheet.code)
      setForm({ name: sheet.name, category: sheet.category, portion_quantity: sheet.portion_quantity, portion_unit: sheet.portion_unit, kcal: sheet.kcal, protein_g: sheet.protein_g, carbs_g: sheet.carbs_g, fat_g: sheet.fat_g, ingredients: sheet.ingredients, allergens: sheet.allergens })
      setIngredientsText(sheet.ingredients.join('\n'))
      setAllergensText(sheet.allergens.map((a) => `${a.allergen}:${a.status}`).join('\n'))
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao abrir ficha.') }
    finally { setBusy(false) }
  }

  function reset() {
    setCode(''); setForm(emptySheet); setIngredientsText(''); setAllergensText(''); setMessage('')
  }

  async function save() {
    if (!adminKey.trim() || !code.trim() || !form.name.trim()) { setMessage('Informe chave administrativa, código e nome da preparação.'); return }
    setBusy(true); setMessage('')
    try {
      const payload = {
        ...form,
        ingredients: ingredientsText.split('\n').map((x) => x.trim()).filter(Boolean),
        allergens: allergensText.split('\n').map((line) => {
          const [allergen, status = 'contains'] = line.split(':').map((x) => x.trim())
          return { allergen, status: (['contains','may_contain','free_from'].includes(status) ? status : 'contains') as 'contains' | 'may_contain' | 'free_from' }
        }).filter((x) => x.allergen),
      }
      await saveTechnicalSheet(adminKey.trim(), code.trim(), payload)
      setMessage('Ficha técnica salva e pronta para enriquecer os próximos cardápios publicados.')
      await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao salvar ficha.') }
    finally { setBusy(false) }
  }

  useEffect(() => { if (adminKey) void load() }, [])

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">A</span><div><strong>APETIT</strong><small>Admin</small></div></div>
      <nav>
        <button className="nav-item" onClick={() => { window.location.hash = 'visao-geral' }}>⌂ Visão geral</button>
        <button className="nav-item" onClick={() => { window.location.hash = 'cardapios' }}>▣ Cardápios</button>
        <button className="nav-item active">⌘ Fichas técnicas</button>
        <button className="nav-item" onClick={() => { window.location.hash = 'importar-fichas' }}>↥ Importar fichas</button>
        <button className="nav-item" onClick={() => { window.location.hash = 'feedbacks' }}>♡ Feedbacks</button>
        <button className="nav-item" onClick={() => { window.location.hash = 'unidades' }}>□ Unidades</button>
      </nav>
      <div className="privacy-note"><strong>Base nutricional</strong><p>Somente dados técnicos validados devem ser usados para alimentar recomendações.</p></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><span className="eyebrow">OPERAÇÃO · NUTRIÇÃO</span><h1>Fichas técnicas</h1><p>Cadastre composição, porção, ingredientes e alergênicos por código técnico.</p></div><div style={{display:'flex',gap:8}}><button className="secondary" onClick={() => { window.location.hash = 'importar-fichas' }}>Importar planilha</button><button className="primary" onClick={reset}>Nova ficha</button></div></header>

      <section className="card content-card">
        <div className="form-grid">
          <label className="full"><span>Chave administrativa</span><input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Chave de acesso da operação" /></label>
          <label className="full"><span>Buscar</span><div style={{display:'flex', gap:8}}><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Código ou nome" /><button className="secondary" onClick={load}>Buscar</button></div></label>
        </div>
      </section>

      <section className="metrics-grid">
        <div className="metric"><small>Fichas encontradas</small><strong>{items.length}</strong><span>cadastros técnicos</span></div>
        <div className="metric"><small>Ficha em edição</small><strong>{code || 'Nova'}</strong><span>{form.name || 'Ainda sem nome'}</span></div>
      </section>

      <div style={{display:'grid', gridTemplateColumns:'minmax(260px,.8fr) minmax(420px,1.4fr)', gap:18}}>
        <section className="card content-card">
          <div className="section-heading"><div><h2>Biblioteca</h2><p>Clique para editar.</p></div></div>
          <div className="days-list">{items.length ? items.map((item) => <button key={item.code} className="choice" style={{textAlign:'left'}} onClick={() => open(item.code)}><strong>{item.name}</strong><small style={{display:'block', marginTop:4}}>{item.code} · {item.kcal ?? '—'} kcal · {item.protein_g ?? '—'} g proteína</small></button>) : <p className="muted">Informe a chave e carregue as fichas.</p>}</div>
        </section>

        <section className="card content-card">
          <div className="section-heading"><div><h2>Dados da ficha</h2><p>Valores devem vir de uma fonte técnica validada.</p></div><span className="badge">{code ? 'Edição' : 'Novo cadastro'}</span></div>
          <div className="form-grid">
            <label><span>Código técnico</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="06.03.01.258" /></label>
            <label><span>Preparação</span><input value={form.name} onChange={(e) => setForm({...form, name:e.target.value})} placeholder="Frango grelhado" /></label>
            <label><span>Categoria</span><input value={form.category ?? ''} onChange={(e) => setForm({...form, category:e.target.value})} placeholder="prato_principal" /></label>
            <label><span>Porção</span><div style={{display:'flex', gap:8}}><input type="number" value={form.portion_quantity ?? ''} onChange={(e) => setForm({...form, portion_quantity:n(e.target.value)})} /><input value={form.portion_unit ?? ''} onChange={(e) => setForm({...form, portion_unit:e.target.value})} placeholder="g" /></div></label>
            <label><span>Energia (kcal)</span><input type="number" value={form.kcal ?? ''} onChange={(e) => setForm({...form, kcal:n(e.target.value)})} /></label>
            <label><span>Proteína (g)</span><input type="number" value={form.protein_g ?? ''} onChange={(e) => setForm({...form, protein_g:n(e.target.value)})} /></label>
            <label><span>Carboidratos (g)</span><input type="number" value={form.carbs_g ?? ''} onChange={(e) => setForm({...form, carbs_g:n(e.target.value)})} /></label>
            <label><span>Gorduras (g)</span><input type="number" value={form.fat_g ?? ''} onChange={(e) => setForm({...form, fat_g:n(e.target.value)})} /></label>
            <label className="full"><span>Ingredientes · um por linha</span><textarea value={ingredientsText} onChange={(e) => setIngredientsText(e.target.value)} rows={6} placeholder={'Peito de frango\nAzeite\nErvas'} /></label>
            <label className="full"><span>Alergênicos · formato alergênico:status</span><textarea value={allergensText} onChange={(e) => setAllergensText(e.target.value)} rows={5} placeholder={'leite:contains\nsoja:may_contain'} /><small>Status: contains, may_contain ou free_from.</small></label>
          </div>
          {!!message && <div className="alert warning">{message}</div>}
          <div className="action-row"><span className="helper">Ao publicar um cardápio, o código puxa estes valores como snapshot.</span><button className="primary" disabled={busy} onClick={save}>{busy ? 'Salvando...' : 'Salvar ficha técnica'}</button></div>
        </section>
      </div>
    </main>
  </div>
}
