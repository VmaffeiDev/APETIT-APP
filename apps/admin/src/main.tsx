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
import { AdminPasswordResetPage } from './AdminPasswordResetPage'
import { AdminUsersPage } from './AdminUsersPage'
import { AdminSetupPage } from './AdminSetupPage'
import { AdminRegisterPage } from './AdminRegisterPage'
import { CompaniesPage } from './CompaniesPage'
import { SettingsPage } from './SettingsPage'
import { AdminUser, adminMe, getAdminToken, isPresentationMode, setAdminToken } from './api'
import { hasAdminPermission, requiredPermissionForRoute } from './access'
import './styles.css'

function Root() {
  const [authRevision,setAuthRevision]=useState(0)
  const [authState,setAuthState]=useState<'checking'|'valid'|'invalid'|'forbidden'>('checking')
  const [validatedHash,setValidatedHash]=useState<string|null>(null)
  const [currentUser,setCurrentUser]=useState<AdminUser|null>(null)
  const [hash, setHash] = useState(window.location.hash.replace('#', '') || 'visao-geral')

  useEffect(() => {
    const protectedRoute = !isPresentationMode || hash === 'usuarios'
    if (!protectedRoute) {
      setCurrentUser(null)
      setAuthState('valid')
      setValidatedHash(hash)
      return
    }
    if (!getAdminToken()) {
      setCurrentUser(null)
      setValidatedHash(null)
      setAuthState('invalid')
      return
    }
    let cancelled = false
    setAuthState('checking')
    setValidatedHash(null)
    adminMe()
      .then(user => {
        if (!cancelled) {
          setCurrentUser(user)
          setAuthState('valid')
          setValidatedHash(hash)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAdminToken('')
          setCurrentUser(null)
          setValidatedHash(null)
          setAuthState('invalid')
        }
      })
    return () => { cancelled = true }
  }, [authRevision, hash])

  useEffect(() => {
    const onExpired = () => { setCurrentUser(null); setValidatedHash(null); setAuthState('invalid'); setAuthRevision(v => v + 1) }
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
      } else if ((label.includes('feedback') || label.includes('satisfação')) && !window.location.hash.includes('feedbacks/')) {
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

  if (hash === 'cadastro') return <AdminRegisterPage />
  if (hash === 'redefinir-senha') return <AdminPasswordResetPage />
  if (hash === 'login') return <AdminLoginPage onSuccess={() => { window.location.hash='visao-geral'; setAuthState('checking'); setAuthRevision(v => v + 1) }} />
  if (hash === 'configurar-admin' && isPresentationMode) return <AdminSetupPage />
  const protectedRoute = !isPresentationMode || hash === 'usuarios'
  if (protectedRoute && (!getAdminToken() || authState === 'invalid')) {
    return <AdminLoginPage onSuccess={() => { window.location.hash='visao-geral'; setAuthState('checking'); setAuthRevision(v => v + 1) }} />
  }
  if (protectedRoute && (authState === 'checking' || validatedHash !== hash)) {
    return <main className="admin-login"><section className="login-card"><h1>Validando acesso...</h1></section></main>
  }
  const requiredPermission = requiredPermissionForRoute(hash)
  if (protectedRoute && requiredPermission && !hasAdminPermission(currentUser, requiredPermission)) {
    return <main className="admin-login"><section className="login-card"><h1>Acesso restrito</h1><p>Seu perfil não possui permissão para acessar esta área.</p><button className="secondary" onClick={() => { window.location.hash='visao-geral' }}>Voltar à visão geral</button></section></main>
  }
  if (hash === 'usuarios') return <AdminUsersPage />
  if (hash === 'empresas') return <CompaniesPage />
  if (hash === 'configuracoes') return <SettingsPage user={currentUser} />
  if (hash === 'visao-geral') return <OverviewPage user={currentUser} />
  if (hash === 'historico-cardapios') return <MenuHistoryPage user={currentUser} />
  if (hash.startsWith('historico-cardapios/')) return <MenuHistoryPage initialUnitId={hash.slice('historico-cardapios/'.length)} user={currentUser} />
  if (hash === 'calendario-cardapios') return <WeeklyMenuPage user={currentUser} />
  if (hash.startsWith('calendario-cardapios/')) return <WeeklyMenuPage initialUnitId={hash.slice('calendario-cardapios/'.length)} user={currentUser} />
  if (hash.startsWith('unidade/')) return <UnitDetailPage unitId={hash.slice('unidade/'.length)} user={currentUser} />
  if (hash === 'relatorio-executivo') return <ExecutiveReportPage />
  if (hash === 'feedbacks') return <FeedbackPage user={currentUser} />
  if (hash.startsWith('feedbacks/')) return <FeedbackPage initialUnitId={hash.slice('feedbacks/'.length)} user={currentUser} />
  if (hash === 'unidades') return <UnitsPage user={currentUser} />
  if (hash === 'fichas-tecnicas') return <TechnicalSheetsPage user={currentUser} />
  if (hash === 'importar-fichas') return <TechnicalSheetImportPage />
  return <App user={currentUser} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Root /></React.StrictMode>,
)
