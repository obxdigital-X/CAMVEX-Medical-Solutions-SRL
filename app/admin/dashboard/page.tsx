import { getAdminUser } from "@/lib/admin-auth"
import { redirect } from "next/navigation"
import { listUsers } from "@/app/admin/actions/users"
import { listEquipment } from "@/app/admin/actions/equipment"
import { listMessages, countUnread } from "@/app/admin/actions/messages"
import { getContentForLang } from "@/app/admin/actions/content"
import { listDataSheets } from "@/app/admin/actions/data-sheets"
import { listQuotations } from "@/app/admin/actions/quotations"
import { listActivity } from "@/app/admin/actions/activity"
import { listPartners } from "@/app/admin/actions/partners"
import { getVisitStats, type VisitStats } from "@/app/admin/actions/stats"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { AdminMaintenance } from "@/components/admin/admin-maintenance"

export default async function DashboardPage() {
  const adminUser = await getAdminUser()
  if (!adminUser) redirect("/admin")

  // The admin can lock individual editors out with a maintenance notice.
  if (adminUser.maintenance) {
    return <AdminMaintenance name={adminUser.name} />
  }

  const emptyStats: VisitStats = {
    total: 0,
    last7: 0,
    last30: 0,
    today: 0,
    byCountry: [],
    bySource: [],
    perDay: [],
    topSource: null,
    countriesCount: 0,
  }

  // Load only what the user is allowed to see.
  const [users, equipment, messages, unread, content, sheets, quotations, activity, partners, stats] =
    await Promise.all([
      adminUser.isAdmin ? listUsers() : Promise.resolve([]),
      adminUser.isAdmin || adminUser.permissions.includes("catalog") ? listEquipment() : Promise.resolve([]),
      adminUser.isAdmin || adminUser.permissions.includes("messages") ? listMessages() : Promise.resolve([]),
      adminUser.isAdmin || adminUser.permissions.includes("messages") ? countUnread() : Promise.resolve(0),
      adminUser.isAdmin ? getContentForLang("es") : Promise.resolve({}),
      adminUser.isAdmin || adminUser.permissions.includes("sheets") ? listDataSheets() : Promise.resolve([]),
      adminUser.isAdmin || adminUser.permissions.includes("quotes") ? listQuotations() : Promise.resolve([]),
      adminUser.isAdmin ? listActivity() : Promise.resolve([]),
      adminUser.isAdmin ? listPartners() : Promise.resolve([]),
      adminUser.isAdmin || adminUser.permissions.includes("stats") ? getVisitStats() : Promise.resolve(emptyStats),
    ])

  return (
    <AdminDashboard
      me={adminUser}
      initialUsers={users}
      initialEquipment={equipment}
      initialMessages={messages}
      initialUnread={unread}
      initialContent={content}
      initialSheets={sheets}
      initialQuotations={quotations}
      initialActivity={activity}
      initialPartners={partners}
      initialStats={stats}
    />
  )
}
