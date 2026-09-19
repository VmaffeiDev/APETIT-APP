import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { FeedbackPage } from './FeedbackPage'
import { TechnicalSheetImportPage } from './TechnicalSheetImportPage'
import { TechnicalSheetsPage } from './TechnicalSheetsPage'
import { UnitsPage } from './UnitsPage'
import { OverviewPage } from './OverviewPage'
import './styles.css'

function Root() {
  const [hash, setHash] = useState(window.location.hash.replace('#', '') || 'visao-geral')

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

  if (hash === 'visao-geral') return <OverviewPage />
  if (hash === 'feedbacks') return <FeedbackPage />
  if (hash === 'unidades') return <UnitsPage />
  if (hash === 'fichas-tecnicas') return <TechnicalSheetsPage />
  if (hash === 'importar-fichas') return <TechnicalSheetImportPage />
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Root /></React.StrictMode>,
)
