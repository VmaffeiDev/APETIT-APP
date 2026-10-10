import { AdminSidebar } from './AdminSidebar'
import { DragEvent, useRef, useState } from 'react'
import { getAdminToken, previewTechnicalSheetImport, publishTechnicalSheetImport, TechnicalSheetImportPreview } from './api'

export function TechnicalSheetImportPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const authenticated = Boolean(getAdminToken())
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<TechnicalSheetImportPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  function selectFile(nextFile: File | null) {
    if (!nextFile) return
    const extension = nextFile.name.toLowerCase().split('.').pop()
    if (!['xlsx','csv'].includes(extension ?? '')) {
      setFile(null); setPreview(null)
      setMessage('Formato não suportado. Selecione um arquivo .xlsx ou .csv.')
      return
    }
    setFile(nextFile); setPreview(null); setMessage('')
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    selectFile(event.dataTransfer.files?.[0] ?? null)
  }

  async function validate() {
    if (!file) {
      setMessage('Selecione um arquivo XLSX ou CSV.')
      return
    }
    if (!authenticated) {
      setMessage('Sua sessão expirou. Entre novamente no Admin para importar fichas.')
      return
    }
    setBusy(true); setMessage('')
    try { setPreview(await previewTechnicalSheetImport('', file)) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao validar arquivo.') }
    finally { setBusy(false) }
  }

  async function publish() {
    if (!preview) return
    setBusy(true); setMessage('')
    try {
      const result = await publishTechnicalSheetImport('', preview.preview_id)
      setMessage(`${result.count} ficha(s) importadas: ${result.created} novas e ${result.updated} atualizadas.`)
      setPreview(null); setFile(null)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao importar fichas.') }
    finally { setBusy(false) }
  }

  return <div className="app-shell">
    <AdminSidebar />
    <main className="main">
      <header className="topbar"><div><span className="eyebrow">OPERAÇÃO · NUTRIÇÃO</span><h1>Importar fichas técnicas</h1><p>Carregue XLSX ou CSV, valide a composição e só então publique na biblioteca nutricional.</p></div><button className="secondary" onClick={() => { window.location.hash = 'fichas-tecnicas' }}>Voltar à biblioteca</button></header>

      <section className="card content-card">
        <div className="form-grid">
          <div className="full presentation-access"><strong>Conta autenticada</strong><span>A importação será autorizada pela sua sessão de Nutrição. Não é necessária chave administrativa.</span></div>
        </div>
        <div
          className={`dropzone ${file ? 'has-file' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
        >
          <input ref={inputRef} hidden type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={(e) => selectFile(e.target.files?.[0] ?? null)} />
          <div className="upload-icon">↥</div>
          {file ? <><strong>{file.name}</strong><p>{(file.size / 1024).toFixed(1)} KB · pronto para validar</p><span className="linkish">Trocar arquivo</span></> : <><strong>Selecione ou arraste a planilha de fichas técnicas</strong><p>XLSX ou CSV com código, preparação e dados nutricionais.</p><span className="file-hint">O arquivo de amostra do APETIT pode ser enviado diretamente aqui.</span></>}
        </div>
        <div className="action-row"><span className="helper">Colunas mínimas: código e preparação/nome.</span><button className="primary" disabled={busy} onClick={validate}>{busy ? 'Validando...' : 'Validar arquivo'}</button></div>
      </section>

      {preview && <>
        <section className="metrics-grid">
          <div className="metric"><small>Fichas válidas</small><strong>{preview.count}</strong><span>registros reconhecidos</span></div>
          <div className="metric"><small>Completas</small><strong>{preview.complete_count}</strong><span>kcal + P + C + G</span></div>
          <div className="metric"><small>Incompletas</small><strong>{preview.incomplete_count}</strong><span>precisam de revisão</span></div>
        </section>
        {preview.warnings.length > 0 && <div className="alert warning"><strong>Revise o arquivo</strong>{preview.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
        <section className="card content-card">
          <div className="section-heading"><div><h2>Prévia</h2><p>Confira os registros antes de atualizar a biblioteca.</p></div><span className="badge">{preview.file_name}</span></div>
          <div className="items-table">
            <div className="table-row header"><span>Código</span><span>Preparação</span><span>Porção</span><span>Macros</span></div>
            {preview.items.map((item) => {
              const complete = [item.kcal, item.protein_g, item.carbs_g, item.fat_g].every((value) => value !== null)
              return <div className="table-row" key={item.code}><strong>{item.code}</strong><span>{item.name}</span><span>{item.portion_quantity ?? '—'} {item.portion_unit ?? ''}</span><span className={complete ? '' : 'muted'}>{complete ? `${item.kcal} kcal · ${item.protein_g}P · ${item.carbs_g}C · ${item.fat_g}G` : 'Dados incompletos'}</span></div>
            })}
          </div>
          <div className="action-row"><span className="helper">Códigos existentes serão atualizados; novos códigos serão criados.</span><button className="primary" disabled={busy || preview.count === 0} onClick={publish}>{busy ? 'Importando...' : `Confirmar importação de ${preview.count} ficha(s)`}</button></div>
        </section>
      </>}

      {!!message && <div className="alert warning">{message}</div>}
    </main>
  </div>
}
