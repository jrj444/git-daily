import { prisma } from "./prisma";
import { encrypt, decrypt } from "./crypto";

function getOAuthConfig() {
  const clientId = process.env.GITLAB_CLIENT_ID;
  const clientSecret = process.env.GITLAB_CLIENT_SECRET;
  const issuer = process.env.GITLAB_OAUTH_ISSUER || "https://gitlab.com";
  return { clientId, clientSecret, issuer };
}

async function refreshOAuthToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const { clientId, clientSecret, issuer } = getOAuthConfig();
  if (!clientId || !clientSecret) {
    throw new Error("GITLAB_CLIENT_ID and GITLAB_CLIENT_SECRET are required for token refresh");
  }

  const url = `${issuer.replace(/\/+$/, "")}/oauth/token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }

  return res.json();
}

export async function resolveGitLabToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      gitlabToken: true,
      gitlabRefreshToken: true,
      gitlabAccessTokenExpiresAt: true,
    },
  });

  if (!user?.gitlabToken) return null;

  const token = decrypt(user.gitlabToken);

  if (token.startsWith("glpat-")) return token;

  if (!user.gitlabRefreshToken || !user.gitlabAccessTokenExpiresAt) {
    return token;
  }

  if (new Date() < new Date(user.gitlabAccessTokenExpiresAt)) {
    return token;
  }

  try {
    const refreshToken = decrypt(user.gitlabRefreshToken);
    const refreshed = await refreshOAuthToken(refreshToken);
    const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: {
        gitlabToken: encrypt(refreshed.access_token),
        gitlabRefreshToken: encrypt(refreshed.refresh_token),
        gitlabAccessTokenExpiresAt: expiresAt,
      },
    });

    return refreshed.access_token;
  } catch (e) {
    console.error("[oauth] token refresh failed", e);
    return null;
  }
}
