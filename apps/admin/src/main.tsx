import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { FeedbackPage } from './FeedbackPage'
import './styles.css'

function Root() {
  const [hash, setHash] = useState(window.location.hash.replace('#', '') || 'cardapios')

  useEffect(() => {
    const onHash = () => setHash(window.location.hash.replace('#', '') || 'cardapios')
    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest('button')
      if (!button) return
      const label = button.textContent?.toLowerCase() ?? ''
      if (label.includes('feedback') || label.includes('satisfação')) {
        window.location.hash = 'feedbacks'
      }
    }
    window.addEventListener('hashchange', onHash)
    document.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('hashchange', onHash)
      document.removeEventListener('click', onClick)
    }
  }, [])

  return hash === 'feedbacks' ? <FeedbackPage /> : <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
