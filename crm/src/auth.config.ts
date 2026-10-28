import type { NextAuthConfig } from "next-auth";

/** Разделы, доступные визовому специалисту */
const VISA_PATHS = ["/visa", "/countries", "/api/docs", "/api/notifications"];

// Конфиг без зависимостей от Node (Prisma, bcrypt) — используется в middleware.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic = pathname.startsWith("/login") || pathname.startsWith("/privacy") || pathname.startsWith("/o/") || pathname.startsWith("/api/webhooks") || pathname.startsWith("/api/chats/out/") || pathname.startsWith("/api/public/") || pathname.startsWith("/api/auth");
      if (isPublic) return true;
      if (!auth?.user) return false;
      // визовый специалист работает только в своём кабинете
      if (auth.user.role === "VISA" && !VISA_PATHS.some((p) => pathname.startsWith(p))) return Response.redirect(new URL("/visa", request.nextUrl));
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.login = user.login;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "ADMIN" | "MANAGER" | "VISA";
      session.user.login = token.login as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
