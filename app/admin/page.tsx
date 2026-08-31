import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { AdminLogin } from "@/components/admin/admin-login"

export default async function AdminLoginPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect("/admin/dashboard")
  return <AdminLogin />
}
