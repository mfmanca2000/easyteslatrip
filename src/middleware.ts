import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Everything except NextAuth's own routes, the unauthenticated health check
  // (hit by the deploy pipeline / uptime monitors), the HA-polling trigger
  // endpoint (machine-to-machine, gated by its own bearer secret instead of
  // the human session), Next's static/internal assets, and the PWA manifest
  // + icons (fetched by the OS/browser install flow without a session).
  matcher: [
    "/((?!api/auth|api/health|api/poll|_next/static|_next/image|favicon.ico|manifest.webmanifest|apple-icon|icons/).*)",
  ],
};
