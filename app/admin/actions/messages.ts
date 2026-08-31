"use server"

import { db } from "@/lib/db"
import { contactMessage } from "@/lib/db/schema"
import { requirePermission } from "@/lib/admin-auth"
import { logActivity } from "@/lib/activity-log"
import { desc, eq, count } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export type Message = {
  id: number
  name: string
  institution: string
  interest: string
  message: string
  phone: string
  read: boolean
  replied: boolean
  repliedAt: string | null
  replyText: string
  createdAt: string
}

// Public action — called from the marketing contact form. No auth required.
export async function saveMessage(input: {
  name: string
  institution: string
  interest: string
  message: string
  phone?: string
}): Promise<{ ok: boolean }> {
  const name = (input.name || "").trim().slice(0, 200)
  const institution = (input.institution || "").trim().slice(0, 200)
  const interest = (input.interest || "").trim().slice(0, 200)
  // No character limit on the message — the column is Postgres `text` (unlimited),
  // so we store the full message the user typed without truncation.
  const message = (input.message || "").trim()
  const phone = (input.phone || "").trim().slice(0, 40)
  // Require at least a name or a message so we don't store empty rows.
  if (!name && !message) return { ok: false }
  await db.insert(contactMessage).values({ name, institution, interest, message, phone })
  revalidatePath("/admin/dashboard")
  return { ok: true }
}

export async function listMessages(): Promise<Message[]> {
  await requirePermission("messages")
  const rows = await db.select().from(contactMessage).orderBy(desc(contactMessage.createdAt))
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    institution: r.institution,
    interest: r.interest,
    message: r.message,
    phone: r.phone,
    read: r.read,
    replied: r.replied,
    repliedAt: r.repliedAt ? r.repliedAt.toISOString() : null,
    replyText: r.replyText,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function countUnread(): Promise<number> {
  await requirePermission("messages")
  const rows = await db.select({ c: count() }).from(contactMessage).where(eq(contactMessage.read, false))
  return rows[0]?.c ?? 0
}

export async function markMessageRead(id: number, read: boolean): Promise<{ ok: boolean }> {
  await requirePermission("messages")
  await db.update(contactMessage).set({ read }).where(eq(contactMessage.id, id))
  revalidatePath("/admin/dashboard")
  return { ok: true }
}

// Marks a message as replied or not replied. When marking as replied (e.g.
// after the admin opens the WhatsApp conversation), it also marks it as read.
// Nothing is sent — the actual reply happens in WhatsApp via the wa.me link.
export async function markMessageReplied(id: number, replied = true): Promise<{ ok: boolean }> {
  const me = await requirePermission("messages")
  const [existing] = await db.select({ name: contactMessage.name }).from(contactMessage).where(eq(contactMessage.id, id)).limit(1)
  await db
    .update(contactMessage)
    .set(
      replied
        ? { replied: true, repliedAt: new Date(), read: true }
        : { replied: false, repliedAt: null },
    )
    .where(eq(contactMessage.id, id))
  if (replied) {
    await logActivity(me, "updated", "Mensajes", `Marcó como respondido el mensaje de “${existing?.name || "contacto"}”`)
  }
  revalidatePath("/admin/dashboard")
  return { ok: true }
}

export async function deleteMessage(id: number): Promise<{ ok: boolean }> {
  const me = await requirePermission("messages")
  const [existing] = await db.select({ name: contactMessage.name }).from(contactMessage).where(eq(contactMessage.id, id)).limit(1)
  await db.delete(contactMessage).where(eq(contactMessage.id, id))
  await logActivity(me, "deleted", "Mensajes", `Eliminó el mensaje de “${existing?.name || "contacto"}”`)
  revalidatePath("/admin/dashboard")
  return { ok: true }
}
