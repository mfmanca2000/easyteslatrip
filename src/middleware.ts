import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Everything except NextAuth's own routes, the unauthenticated health check
  // (hit by the deploy pipeline / uptime monitors), the HA-polling trigger
  // endpoint (machine-to-machine, gated by its own bearer secret instead of
  // the human session), and Next's static/internal assets.
  matcher: ["/((?!api/auth|api/health|api/poll|_next/static|_next/image|favicon.ico).*)"],
};
