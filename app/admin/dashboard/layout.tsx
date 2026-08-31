import type React from "react"
import { redirect } from "next/navigation"
import { getAdminUser } from "@/lib/admin-auth"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const adminUser = await getAdminUser()
  if (!adminUser) redirect("/admin")
  return <>{children}</>
}
