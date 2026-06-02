import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withErrors, requireUser } from "@/lib/session";
import { maskToken, decrypt } from "@/lib/crypto";

export const GET = withErrors(async () => {
  const user = await requireUser();
  const u = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      passwordHash: true,
      gitlabBaseUrl: true,
      gitlabToken: true,
      gitlabRefreshToken: true,
      gitlabAccessTokenExpiresAt: true,
      gitlabUserId: true,
      gitlabEmail: true,
      noiseRegex: true,
    },
  });
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let tokenMask = "";
  if (u.gitlabToken) {
    try {
      tokenMask = maskToken(decrypt(u.gitlabToken));
    } catch {
      tokenMask = "****";
    }
  }

  return NextResponse.json({
    user: {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      gitlabBaseUrl: u.gitlabBaseUrl,
      gitlabUserId: u.gitlabUserId,
      gitlabEmail: u.gitlabEmail,
      noiseRegex: u.noiseRegex,
      hasToken: !!u.gitlabToken,
      tokenMask,
      isOAuth: !!u.gitlabRefreshToken,
      hasPassword: !!u.passwordHash,
      tokenExpiresAt: u.gitlabAccessTokenExpiresAt?.toISOString() ?? null,
    },
  });
});

const PatchBody = z.object({
  noiseRegex: z.string().optional().nullable(),
  displayName: z.string().min(1).max(50).optional(),
  gitlabEmail: z
    .string()
    .trim()
    .email("请填写有效的邮箱")
    .optional()
    .or(z.literal(""))
    .nullable(),
  password: z.string().min(6).max(100).optional(),
});

export const PATCH = withErrors(async (req: Request) => {
  const user = await requireUser();
  const body = PatchBody.parse(await req.json());
  const data: any = {};

  if (body.noiseRegex !== undefined) {
    data.noiseRegex = body.noiseRegex || null;
  }
  if (body.displayName !== undefined) {
    data.displayName = body.displayName;
  }
  if (body.gitlabEmail !== undefined) {
    data.gitlabEmail = body.gitlabEmail || null;
  }
  if (body.password) {
    data.passwordHash = await bcrypt.hash(body.password, 10);
  }

  if (Object.keys(data).length > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data,
    });
  }

  return NextResponse.json({ ok: true });
});
