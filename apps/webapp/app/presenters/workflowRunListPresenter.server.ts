import { z } from "zod";
import type { PrismaClient } from "~/db.server";
import { prisma } from "~/db.server";
import type { Organization } from "../models/organization.server";
import {
  getCurrentRuntimeEnvironment,
  RuntimeEnvironment,
} from "../models/runtimeEnvironment.server";
import type { User } from "../models/user.server";
import type { Workflow } from "../models/workflow.server";
import { allStatuses } from "../models/workflowRunStatus";

const literals = allStatuses.map((s) => z.literal(s));
const statusSchema = z.union([literals[0], literals[1], ...literals.splice(2)]);

const SearchParamsSchema = z.object({
  page: z.coerce.number().default(1),
  statuses: z.preprocess((arg) => {
    if (arg === undefined || typeof arg !== "string") {
      return undefined;
    }
    const statuses = arg.split(",");
    if (statuses.length === 0) {
      return undefined;
    }
    return statuses;
  }, z.array(statusSchema).optional().default(allStatuses)),
});

export class WorkflowRunListPresenter {
  #prismaClient: PrismaClient;

  constructor(prismaClient: PrismaClient = prisma) {
    this.#prismaClient = prismaClient;
  }

  async data({
    userId,
    organizationSlug,
    workflowSlug,
    pageSize = 20,
    searchParams,
  }: {
    userId: User["id"];
    organizationSlug: Organization["slug"];
    workflowSlug: Workflow["slug"];
    pageSize?: number;
    searchParams: URLSearchParams;
  }) {
    const searchEntries = Object.fromEntries(searchParams.entries());
    const { page, statuses } = SearchParamsSchema.parse(searchEntries);

    const organization =
      await this.#prismaClient.organization.findUniqueOrThrow({
        where: {
          slug: organizationSlug,
        },
      });

    const workflow = await this.#prismaClient.workflow.findUniqueOrThrow({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: workflowSlug,
        },
      },
      include: {
        currentEnvironments: {
          where: {
            userId,
          },
          include: {
            environment: true,
          },
        },
      },
    });

    const currentEnvironment = await getCurrentRuntimeEnvironment(
      organizationSlug,
      workflow.currentEnvironments[0]?.environment,
      "development"
    );

    const offset = (page - 1) * pageSize;
    const total = await this.#prismaClient.workflowRun.count({
      where: {
        workflow: {
          slug: workflowSlug,
          organization: {
            slug: organizationSlug,
            users: {
              some: {
                id: userId,
              },
            },
          },
        },
        environmentId: currentEnvironment.id,
        status: {
          in: statuses,
        },
      },
    });

    const totalRealRuns = await this.#prismaClient.workflowRun.count({
      where: {
        isTest: false,
        workflow: {
          slug: workflowSlug,
          organization: {
            slug: organizationSlug,
            users: {
              some: {
                id: userId,
              },
            },
          },
        },
        environmentId: currentEnvironment.id,
        status: {
          in: statuses,
        },
      },
    });

    const runs = await this.#prismaClient.workflowRun.findMany({
      select: {
        id: true,
        startedAt: true,
        finishedAt: true,
        status: true,
        isTest: true,
      },
      where: {
        status: {
          in: statuses,
        },
        environmentId: currentEnvironment.id,
        workflow: {
          slug: workflowSlug,
          organization: {
            slug: organizationSlug,
            users: {
              some: {
                id: userId,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: offset,
      take: pageSize,
    });

    return {
      runs,
      page,
      pageCount: Math.ceil(total / pageSize),
      total,
      totalRealRuns,
      filters: {
        statuses,
      },
      hasFilters: statuses.length !== allStatuses.length,
      pageSize,
    };
  }
}
