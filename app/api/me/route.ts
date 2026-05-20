import { NextResponse } from "next/server";
import { z } from "zod";
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
      gitlabBaseUrl: true,
      gitlabToken: true,
      gitlabUserId: true,
      gitlabEmail: true,
      noiseRegex: true,
    },
  });
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Never return the raw token; show a masked preview only
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
});

export const PATCH = withErrors(async (req: Request) => {
  const user = await requireUser();
  const body = PatchBody.parse(await req.json());
  await prisma.user.update({
    where: { id: user.id },
    data: {
      noiseRegex:
        body.noiseRegex === undefined ? undefined : body.noiseRegex || null,
      displayName: body.displayName ?? undefined,
      gitlabEmail:
        body.gitlabEmail === undefined ? undefined : body.gitlabEmail || null,
    },
  });
  return NextResponse.json({ ok: true });
});
