import { betterAuth } from "better-auth"
import { username, admin } from "better-auth/plugins"
import { nextCookies } from "better-auth/next-js"
import { eq } from "drizzle-orm"
import { pool, db } from "@/lib/db"
import { user, activityLog } from "@/lib/db/schema"

export const auth = betterAuth({
  database: pool,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  // Login is by username ("admin"), so we don't require a real email.
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  plugins: [
    username(),
    admin(),
    // MUST be last. Forwards Better Auth's Set-Cookie headers into Next.js
    // when auth.api.* runs inside a Server Action (e.g. endAdminSession's
    // signOut). Without it, logout revokes the session in the DB but the stale
    // cookie stays in the browser, so the next login is sent with an invalid
    // cookie and rejected — appearing as "contraseña incorrecta" until the user
    // manually clears cookies.
    nextCookies(),
  ],
  trustedOrigins: [
    ...(process.env.NODE_ENV === "development"
      ? [
          "http://localhost:3000",
          ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
          ...(process.env.V0_DEV_APP_URL ? [process.env.V0_DEV_APP_URL] : []),
          ...(process.env.V0_BUILD_URL ? [process.env.V0_BUILD_URL] : []),
          ...(process.env.V0_SANDBOX_URL ? [process.env.V0_SANDBOX_URL] : []),
        ]
      : []),
    ...(process.env.NODE_ENV === "production"
      ? [
          ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
          ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
            : []),
        ]
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  databaseHooks: {
    session: {
      create: {
        // Records the access in the Caché SERVER-SIDE, the moment a session is
        // created (i.e. on every successful login, from any user or device).
        // This replaces the old client-triggered logLogin() call, which relied
        // on the freshly-set cookie reaching a follow-up request and silently
        // failed for logins on other computers — so their entries never showed.
        after: async (createdSession) => {
          try {
            const rows = await db
              .select({ name: user.name, username: user.username, role: user.role })
              .from(user)
              .where(eq(user.id, createdSession.userId))
              .limit(1)
            const u = rows[0]
            if (!u) return
            await db.insert(activityLog).values({
              actorId: createdSession.userId,
              actorName: u.name ?? "",
              actorUsername: u.username ?? "",
              actorRole: u.role === "admin" ? "admin" : "editor",
              action: "login",
              entity: "Accesos",
              summary: "Entró al panel de administración",
            })
          } catch (err) {
            console.log("[v0] login hook error:", err instanceof Error ? err.message : err)
          }
        },
      },
    },
  },
  ...(process.env.NODE_ENV === "development"
    ? {
        advanced: {
          // In dev (v0 preview iframe), force cross-site cookies so the
          // session cookie is stored by the browser.
          defaultCookieAttributes: {
            sameSite: "none" as const,
            secure: true,
          },
        },
      }
    : {}),
})
