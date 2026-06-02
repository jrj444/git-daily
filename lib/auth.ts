import type { NextAuthOptions, DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitLabProvider from "next-auth/providers/gitlab";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { encrypt } from "./crypto";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: "MEMBER" | "ADMIN";
    } & DefaultSession["user"];
  }
  interface User {
    id: string;
    username: string;
    displayName: string;
    role: "MEMBER" | "ADMIN";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    username: string;
    role: "MEMBER" | "ADMIN";
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.username || !creds?.password) return null;
        const user = await prisma.user.findUnique({
          where: { username: creds.username },
        });
        if (!user || !user.passwordHash) return null;
        const ok = await bcrypt.compare(creds.password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          name: user.displayName,
        } as any;
      },
    }),
    GitLabProvider({
      clientId: process.env.GITLAB_CLIENT_ID!,
      clientSecret: process.env.GITLAB_CLIENT_SECRET!,
      authorization: process.env.GITLAB_OAUTH_ISSUER
        ? {
            url: `${process.env.GITLAB_OAUTH_ISSUER}/oauth/authorize`,
            params: { scope: "read_user api" },
          }
        : { params: { scope: "read_user api" } },
      token: process.env.GITLAB_OAUTH_ISSUER
        ? `${process.env.GITLAB_OAUTH_ISSUER}/oauth/token`
        : undefined,
      userinfo: process.env.GITLAB_OAUTH_ISSUER
        ? `${process.env.GITLAB_OAUTH_ISSUER}/api/v4/user`
        : undefined,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "gitlab" && account.access_token) {
        const p = profile as any;
        const gitlabUserId = Number(p.id);
        const issuer = process.env.GITLAB_OAUTH_ISSUER || "https://gitlab.com";
        const expiresAt = account.expires_at
          ? new Date(account.expires_at * 1000)
          : new Date(Date.now() + 7200 * 1000);

        let dbUser = await prisma.user.findFirst({
          where: { gitlabUserId },
        });

        if (dbUser) {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: {
              gitlabRefreshToken: account.refresh_token
                ? encrypt(account.refresh_token)
                : dbUser.gitlabRefreshToken,
            },
          });
          (user as any).id = dbUser.id;
          (user as any).username = dbUser.username;
          (user as any).role = dbUser.role;
        }

        if (!dbUser) {
          let username = p.preferred_username || p.nickname || "gitlab_user";
          let created = null;
          let attempts = 0;
          while (!created && attempts < 10) {
            try {
              created = await prisma.user.create({
                data: {
                  username,
                  passwordHash: null,
                  displayName: p.name || username,
                  role: "MEMBER",
                  gitlabBaseUrl: issuer,
                  gitlabUserId,
                  gitlabEmail: p.email,
                  gitlabToken: encrypt(account.access_token),
                  gitlabRefreshToken: account.refresh_token
                    ? encrypt(account.refresh_token)
                    : null,
                  gitlabAccessTokenExpiresAt: expiresAt,
                },
              });
            } catch (e: any) {
              if (e?.code === "P2002") {
                if (attempts === 0) {
                  username = `${p.preferred_username || "gitlab_user"}_gitlab`;
                } else {
                  username = `${p.preferred_username || "gitlab_user"}_gitlab_${Date.now().toString(36)}_${attempts}`;
                }
                attempts++;
              } else {
                throw e;
              }
            }
          }
          if (!created) throw new Error("Failed to create OAuth user");
          (user as any).id = created.id;
          (user as any).username = created.username;
          (user as any).role = created.role;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as any).id;
        token.username = (user as any).username;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.username = token.username as string;
        session.user.role = token.role as "MEMBER" | "ADMIN";
      }
      return session;
    },
  },
};
