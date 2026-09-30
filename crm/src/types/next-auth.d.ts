import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: "ADMIN" | "MANAGER";
    login: string;
  }
  interface Session {
    user: { id: string; role: "ADMIN" | "MANAGER"; login: string } & DefaultSession["user"];
  }
}
