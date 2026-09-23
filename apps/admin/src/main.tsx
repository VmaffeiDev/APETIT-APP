import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { FeedbackPage } from './FeedbackPage'
import { TechnicalSheetImportPage } from './TechnicalSheetImportPage'
import { TechnicalSheetsPage } from './TechnicalSheetsPage'
import { UnitsPage } from './UnitsPage'
import { OverviewPage } from './OverviewPage'
import { ExecutiveReportPage } from './ExecutiveReportPage'
import { UnitDetailPage } from './UnitDetailPage'
import { WeeklyMenuPage } from './WeeklyMenuPage'
import { MenuHistoryPage } from './MenuHistoryPage'
import { AdminLoginPage } from './AdminLoginPage'
import { AdminUsersPage } from './AdminUsersPage'
import { AdminSetupPage } from './AdminSetupPage'
import { adminMe, getAdminToken, isPresentationMode, setAdminToken } from './api'
import './styles.css'

function Root() {
  const [authRevision,setAuthRevision]=useState(0)
  const [authState,setAuthState]=useState<'checking'|'valid'|'invalid'|'forbidden'>('checking')
  const [hash, setHash] = useState(window.location.hash.replace('#', '') || 'visao-geral')

  useEffect(() => {
    const protectedRoute = !isPresentationMode || hash === 'usuarios'
    if (!protectedRoute) {
      setAuthState('valid')
      return
    }
    if (!getAdminToken()) {
      setAuthState('invalid')
      return
    }
    let cancelled = false
    setAuthState('checking')
    adminMe()
      .then(user => {
        if (!cancelled) setAuthState(hash === 'usuarios' && user.role !== 'admin' ? 'forbidden' : 'valid')
      })
      .catch(() => {
        if (!cancelled) {
          setAdminToken('')
          setAuthState('invalid')
        }
      })
    return () => { cancelled = true }
  }, [authRevision, hash])

  useEffect(() => {
    const onExpired = () => { setAuthState('invalid'); setAuthRevision(v => v + 1) }
    window.addEventListener('apetit-admin-session-expired', onExpired)
    return () => window.removeEventListener('apetit-admin-session-expired', onExpired)
  }, [])

  useEffect(() => {
    const onHash = () => setHash(window.location.hash.replace('#', '') || 'visao-geral')
    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest('button')
      if (!button) return
      const label = button.textContent?.toLowerCase() ?? ''
      if (label.includes('visão geral')) {
        window.location.hash = 'visao-geral'
      } else if (label.includes('importar fichas')) {
        window.location.hash = 'importar-fichas'
      } else if (label.includes('fichas técnicas')) {
        window.location.hash = 'fichas-tecnicas'
      } else if (label.includes('feedback') || label.includes('satisfação')) {
        window.location.hash = 'feedbacks'
      } else if (label.includes('relatório executivo')) {
        window.location.hash = 'relatorio-executivo'
      } else if (label.includes('unidades')) {
        window.location.hash = 'unidades'
      } else if (label.includes('cardápios')) {
        window.location.hash = 'cardapios'
      }
    }
    window.addEventListener('hashchange', onHash)
    document.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('hashchange', onHash)
      document.removeEventListener('click', onClick)
    }
  }, [])

  if (hash === 'configurar-admin' && isPresentationMode) return <AdminSetupPage />
  const protectedRoute = !isPresentationMode || hash === 'usuarios'
  if (protectedRoute && (!getAdminToken() || authState === 'invalid')) {
    return <AdminLoginPage onSuccess={() => { setAuthState('checking'); setAuthRevision(v => v + 1) }} />
  }
  if (protectedRoute && authState === 'checking') {
    return <main className="admin-login"><section className="login-card"><h1>Validando acesso...</h1></section></main>
  }
  if (protectedRoute && authState === 'forbidden') {
    return <main className="admin-login"><section className="login-card"><h1>Acesso restrito</h1><p>Esta área exige uma conta individual com perfil Administrador.</p><button className="secondary" onClick={() => { setAdminToken(''); setAuthRevision(v => v + 1) }}>Entrar com outra conta</button></section></main>
  }
  if (hash === 'usuarios') return <AdminUsersPage />
  if (hash === 'visao-geral') return <OverviewPage />
  if (hash === 'historico-cardapios') return <MenuHistoryPage />
  if (hash.startsWith('historico-cardapios/')) return <MenuHistoryPage initialUnitId={hash.slice('historico-cardapios/'.length)} />
  if (hash === 'calendario-cardapios') return <WeeklyMenuPage />
  if (hash.startsWith('calendario-cardapios/')) return <WeeklyMenuPage initialUnitId={hash.slice('calendario-cardapios/'.length)} />
  if (hash.startsWith('unidade/')) return <UnitDetailPage unitId={hash.slice('unidade/'.length)} />
  if (hash === 'relatorio-executivo') return <ExecutiveReportPage />
  if (hash === 'feedbacks') return <FeedbackPage />
  if (hash === 'unidades') return <UnitsPage />
  if (hash === 'fichas-tecnicas') return <TechnicalSheetsPage />
  if (hash === 'importar-fichas') return <TechnicalSheetImportPage />
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Root /></React.StrictMode>,
)
