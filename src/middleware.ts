import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Everything except NextAuth's own routes, the unauthenticated health check
  // (hit by the deploy pipeline / uptime monitors), and Next's static/internal
  // assets. The future HA-polling trigger endpoint gets its own carve-out in a
  // later ticket.
  matcher: ["/((?!api/auth|api/health|_next/static|_next/image|favicon.ico).*)"],
};
