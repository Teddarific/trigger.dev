import type { Endpoints } from "@octokit/types";
import type { PushEvent } from "@octokit/webhooks-types";
import { verify } from "@octokit/webhooks-methods";
import { sign as signJWT } from "jsonwebtoken";
import { z } from "zod";
import { env } from "~/env.server";
import type { EmitterWebhookEventName } from "@octokit/webhooks";
import { logger } from "~/services/logger";
import { workerQueue } from "~/services/worker.server";

export async function verifyAndReceiveWebhook(request: Request) {
  if (!env.GITHUB_APP_WEBHOOK_SECRET) {
    return new Response("", { status: 200 });
  }

  const payload = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  const id = headers["x-github-delivery"];
  const hookName = headers["x-github-event"];
  const signature = headers["x-hub-signature"];

  const results = await verify(
    env.GITHUB_APP_WEBHOOK_SECRET,
    payload,
    signature
  );

  if (!results) {
    logger.debug(`[webhooks.github] Invalid signature`, {
      id,
      hookName,
      signature,
    });

    return new Response("", { status: 200 });
  }

  const parsedPayload = JSON.parse(payload);

  const name = (
    parsedPayload.action ? `${hookName}.${parsedPayload.action}` : hookName
  ) as EmitterWebhookEventName;

  logger.debug(`[webhooks.github] Received event`, {
    id,
    name,
  });

  await handleGithubEvent({
    id,
    name,
    payload: parsedPayload,
  });

  return new Response("", { status: 200 });
}

async function handleGithubEvent<TName extends EmitterWebhookEventName>({
  id,
  name,
  payload,
}: {
  id: string;
  name: TName;
  payload: any;
}) {
  switch (name) {
    case "installation.deleted": {
      await workerQueue.enqueue("githubAppInstallationDeleted", {
        id: payload.installation.id,
      });
      break;
    }
    case "push": {
      const push = payload as PushEvent;

      // Only on pushes to a branch
      if (!push.ref.startsWith("refs/heads/")) {
        return;
      }

      const branch = push.ref.replace("refs/heads/", "");

      await workerQueue.enqueue("githubPush", {
        branch: branch,
        commitSha: push.after,
        repository: push.repository.full_name,
      });
      break;
    }
  }
}

type GetAppInstallationEndpoint =
  Endpoints["GET /app/installations/{installation_id}"];

export async function getAppInstallation({
  installation_id,
}: GetAppInstallationEndpoint["parameters"]): Promise<
  GetAppInstallationEndpoint["response"]["data"]
> {
  const jwt = createSignedGitHubAppJWT();

  const response = await fetch(
    `https://api.github.com/app/installations/${installation_id}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to get installation ${installation_id}: ${response.statusText}`
    );
  }

  return await response.json();
}

type CreateInstallationAccessTokenEndpoint =
  Endpoints["POST /app/installations/{installation_id}/access_tokens"];

export type CreateInstallationAccessTokenResponse =
  CreateInstallationAccessTokenEndpoint["response"]["data"];

export async function createInstallationAccessToken(
  url: string
): Promise<CreateInstallationAccessTokenResponse> {
  const jwt = createSignedGitHubAppJWT();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github.v3+json",
      Authorization: `Bearer ${jwt}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to create access token for installation: ${response.statusText}`
    );
  }

  return await response.json();
}

export type GetInstallationRepositoriesEndpoint =
  Endpoints["GET /installation/repositories"];

export type GetInstallationRepositoriesResponse =
  GetInstallationRepositoriesEndpoint["response"]["data"];

export async function getInstallationRepositories(
  token: string
): Promise<GetInstallationRepositoriesResponse["repositories"]> {
  // Continuously fetch pages until we have all repositories
  let page = 1;
  const perPage = 100;

  const repositories: GetInstallationRepositoriesResponse["repositories"] = [];

  while (true) {
    const response = await getInstallationRepositoriesPage(
      token,
      page,
      perPage
    );

    repositories.push(...response.repositories);

    if (response.repositories.length < perPage) {
      break;
    }

    page++;
  }

  return repositories;
}

async function getInstallationRepositoriesPage(
  token: string,
  page = 1,
  perPage = 100
): Promise<GetInstallationRepositoriesResponse> {
  const response = await fetch(
    `https://api.github.com/installation/repositories?per_page=${perPage}&page=${page}`,
    {
      method: "GET",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to get installation repositories: ${response.statusText}`
    );
  }

  return await response.json();
}

export async function getRepositoryContent(
  token: string,
  repo: string,
  path: string
): Promise<string | undefined> {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}`,
    {
      method: "GET",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.raw",
      },
    }
  );

  if (response.status === 404) {
    return;
  }

  if (!response.ok) {
    throw new Error(`Failed to get repository content: ${response.statusText}`);
  }

  return await response.text();
}

export type GetRepEndpoint = Endpoints["GET /repos/{owner}/{repo}"];
export type GetRepoResponse = GetRepEndpoint["response"]["data"];

export async function getRepo(
  token: string,
  name: string
): Promise<GetRepoResponse> {
  const response = await fetch(`https://api.github.com/repos/${name}`, {
    method: "GET",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get repo: ${response.statusText}`);
  }

  return await response.json();
}

export type GetCommitEndpoint =
  Endpoints["GET /repos/{owner}/{repo}/commits/{ref}"];

export type GetCommitResponse = GetCommitEndpoint["response"]["data"];

export type GitHubCommit = GetCommitResponse;

export async function getCommit(
  token: string,
  repo: string,
  ref: string
): Promise<GitHubCommit> {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/commits/${ref}`,
    {
      method: "GET",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get commit: ${response.statusText}`);
  }

  return await response.json();
}

export const AccountSchema = z.object({
  login: z.string(),
  id: z.number(),
  node_id: z.string(),
  name: z.string().optional(),
  email: z.string().optional().nullable(),
  avatar_url: z.string(),
  gravatar_id: z.string(),
  url: z.string(),
  html_url: z.string(),
  followers_url: z.string(),
  following_url: z.string(),
  gists_url: z.string(),
  starred_url: z.string(),
  subscriptions_url: z.string(),
  organizations_url: z.string(),
  repos_url: z.string(),
  events_url: z.string(),
  received_events_url: z.string(),
  type: z.union([
    z.literal("Bot"),
    z.literal("User"),
    z.literal("Organization"),
  ]),
  site_admin: z.boolean(),
});

function createSignedGitHubAppJWT() {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    throw new Error("Missing GitHub App ID or private key");
  }

  const privateKey = Buffer.from(env.GITHUB_APP_PRIVATE_KEY, "base64").toString(
    "utf8"
  );

  const unsignedJWT = {
    iat: Math.floor(Date.now() / 1000) - 10,
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
    iss: env.GITHUB_APP_ID,
  };

  const signedJWT = signJWT(unsignedJWT, privateKey, {
    algorithm: "RS256",
  });

  return signedJWT;
}
