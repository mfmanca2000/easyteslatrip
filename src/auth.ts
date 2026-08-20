import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";

const YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: {
    strategy: "jwt",
    maxAge: YEAR_IN_SECONDS,
  },
  providers: [
    Credentials({
      credentials: {
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const password = credentials?.password;
        const hash = process.env.AUTH_PASSWORD_HASH;

        if (typeof password !== "string" || !hash) {
          return null;
        }

        const valid = await bcrypt.compare(password, hash);
        return valid ? { id: "single-user" } : null;
      },
    }),
  ],
});
