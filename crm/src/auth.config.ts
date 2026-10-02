import type { NextAuthConfig } from "next-auth";

// Конфиг без зависимостей от Node (Prisma, bcrypt) — используется в middleware.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic = pathname.startsWith("/login") || pathname.startsWith("/privacy") || pathname.startsWith("/api/webhooks") || pathname.startsWith("/api/auth");
      if (isPublic) return true;
      return !!auth?.user;
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
      session.user.role = token.role as "ADMIN" | "MANAGER";
      session.user.login = token.login as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
