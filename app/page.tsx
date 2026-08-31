import { CamvexSite } from "@/components/camvex-site"
import { getPublicEquipmentByLang } from "@/app/admin/actions/equipment"
import { getPublicContent } from "@/app/admin/actions/content"
import { getPublicPartners } from "@/app/admin/actions/partners"

export const dynamic = "force-dynamic"

export default async function Page() {
  const [equipmentByLang, content, partners] = await Promise.all([
    getPublicEquipmentByLang(),
    getPublicContent(),
    getPublicPartners(),
  ])
  return <CamvexSite equipmentByLang={equipmentByLang} content={content} partners={partners} />
}
