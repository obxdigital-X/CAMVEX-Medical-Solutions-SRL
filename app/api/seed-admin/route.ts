import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

// One-time seed of the default admin account (username: admin).
// Safe to call multiple times: it no-ops if the admin already exists.
export async function GET() {
  try {
    const existing = await db.select({ id: user.id }).from(user).where(eq(user.username, "admin")).limit(1)

    if (existing.length > 0) {
      return NextResponse.json({ ok: true, message: "El usuario admin ya existe." })
    }

    await auth.api.signUpEmail({
      body: {
        // Email is required by Better Auth; username is what's used to log in.
        email: "admin@camvexrd.com",
        password: "CAMVEX123@",
        name: "Administrador",
        username: "admin",
      },
    })

    // Promote to the admin role and grant all permissions.
    await db
      .update(user)
      .set({ role: "admin", permissions: JSON.stringify(["catalog", "messages"]) })
      .where(eq(user.username, "admin"))

    return NextResponse.json({ ok: true, message: "Usuario admin creado." })
  } catch (err) {
    console.log("[v0] seed-admin error:", err instanceof Error ? err.message : err)
    return NextResponse.json({ ok: false, error: "No se pudo crear el admin." }, { status: 500 })
  }
}
