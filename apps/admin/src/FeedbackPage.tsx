import { AdminSidebar } from './AdminSidebar'
import { FeedbackDashboard } from './FeedbackDashboard'
import { AdminUser } from './api'
import { hasAdminPermission } from './access'
import './feedback.css'

export function FeedbackPage({ initialUnitId, user }: { initialUnitId?: string; user: AdminUser | null }) {
  const canPublishMenus=hasAdminPermission(user,'publish_menu')
  const canManageSheets=hasAdminPermission(user,'manage_sheets')
  const canManageUsers=hasAdminPermission(user,'manage_users')
  function go(hash: string) {
    window.location.hash = hash
  }

  return (
    <div className="app-shell feedback-page">
      <AdminSidebar />
      <main className="main"><FeedbackDashboard initialUnitId={initialUnitId} user={user} /></main>
    </div>
  )
}
