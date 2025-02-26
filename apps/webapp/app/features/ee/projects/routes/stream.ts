import type { LoaderArgs } from "@remix-run/server-runtime";
import { randomUUID } from "crypto";
import { eventStream } from "remix-utils";
import { z } from "zod";
import { prisma } from "~/db.server";
import { requireUserId } from "~/services/session.server";

export async function loader({ request, params }: LoaderArgs) {
  await requireUserId(request);

  const { id } = z.object({ id: z.string() }).parse(params);

  const project = await findProjectForUpdates(id);

  if (!project) {
    return new Response("Not found", { status: 404 });
  }

  let lastUpdatedAt: number = project.updatedAt.getTime();
  let lastDeploymentId: string | undefined = project.deployments[0]?.id;
  let workflowCount = project._count.workflows;

  let stopped = false;

  return eventStream(request.signal, (send) => {
    const pinger = setInterval(() => {
      send({ event: "ping", data: new Date().toISOString() });
    }, 1000);

    const interval = setInterval(() => {
      if (stopped) return;
      // Get the updatedAt date from the projects database, and send it to the client if it's different from the last one
      findProjectForUpdates(id)
        .then((project) => {
          if (stopped) return;

          if (project) {
            if (lastUpdatedAt !== project.updatedAt.getTime()) {
              send({ event: "update", data: project.updatedAt.toISOString() });
            } else if (lastDeploymentId !== project.deployments[0]?.id) {
              send({ event: "update", data: randomUUID() });
            } else if (workflowCount !== project._count.workflows) {
              send({ event: "update", data: randomUUID() });
            }

            workflowCount = project._count.workflows;
            lastDeploymentId = project.deployments[0]?.id;
            lastUpdatedAt = project.updatedAt.getTime();
          }
        })
        .catch((error) => {
          stopped = true;
        });
    }, 348);

    return function clear() {
      stopped = true;
      clearInterval(pinger);
      clearInterval(interval);
    };
  });
}

function findProjectForUpdates(id: string) {
  return prisma.repositoryProject.findUnique({
    where: {
      id,
    },
    select: {
      updatedAt: true,
      deployments: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
      _count: {
        select: {
          workflows: true,
        },
      },
    },
  });
}
