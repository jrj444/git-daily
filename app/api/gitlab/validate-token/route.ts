import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { resolveGitLabToken } from "@/lib/gitlab-token";
import { withErrors, requireUser } from "@/lib/session";
import { validateToken, listProjects } from "@/lib/gitlab";

const Body = z.object({
  baseUrl: z.string().url(),
  token: z.string().min(8).optional(),
});

export const POST = withErrors(async (req: Request) => {
  const user = await requireUser();
  const body = Body.parse(await req.json());

  let token: string | null | undefined = body.token;
  if (!token) {
    token = await resolveGitLabToken(user.id);
    if (!token) {
      return NextResponse.json(
        { error: "请先填写 token" },
        { status: 400 }
      );
    }
  }

  const me = await validateToken({ baseUrl: body.baseUrl, token });

  // Persist baseUrl + (optional) token + cached user info.
  // Don't overwrite a previously-customized gitlabEmail; only fill it on first connect.
  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { gitlabEmail: true },
  });
  const update: any = {
    gitlabBaseUrl: body.baseUrl,
    gitlabUserId: me.id,
  };
  if (!existing?.gitlabEmail) {
    update.gitlabEmail = me.public_email || me.email;
  }
  if (body.token) update.gitlabToken = encrypt(body.token);
  await prisma.user.update({ where: { id: user.id }, data: update });

  // Try to refresh project list cache lightly
  try {
    const projects = await listProjects({ baseUrl: body.baseUrl, token });
    await prisma.$transaction(
      projects.slice(0, 200).map((p) =>
        prisma.repository.upsert({
          where: {
            userId_gitlabProjectId: {
              userId: user.id,
              gitlabProjectId: p.id,
            },
          },
          update: {
            nameWithNamespace: p.name_with_namespace,
            webUrl: p.web_url,
          },
          create: {
            userId: user.id,
            gitlabProjectId: p.id,
            nameWithNamespace: p.name_with_namespace,
            webUrl: p.web_url,
            defaultBranch: p.default_branch ?? undefined,
            enabled: false,
          },
        })
      )
    );
  } catch (e: any) {
    return NextResponse.json({
      ok: true,
      user: { id: me.id, name: me.name, email: me.email },
      warning: `Token 有效，但项目列表加载失败：${e?.message || e}`,
    });
  }

  return NextResponse.json({
    ok: true,
    user: { id: me.id, name: me.name, email: me.email },
  });
});
