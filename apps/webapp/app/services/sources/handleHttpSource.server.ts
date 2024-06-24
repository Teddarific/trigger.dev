import type { PrismaClient } from "~/db.server";
import { prisma } from "~/db.server";
import { workerQueue } from "../worker.server";

export class HandleHttpSourceService {
  #prismaClient: PrismaClient;

  constructor(prismaClient: PrismaClient = prisma) {
    this.#prismaClient = prismaClient;
  }

  public async call(id: string, request: Request) {
    const httpSource = await this.#prismaClient.httpSource.findUnique({
      where: { id },
      include: {
        endpoint: true,
        environment: true,
      },
    });

    if (!httpSource) {
      return { status: 404 };
    }

    if (!httpSource.active) {
      return { status: 200 };
    }

    if (!httpSource.interactive) {
      // Create a request delivery and then enqueue it to be delivered
      const delivery =
        await this.#prismaClient.httpSourceRequestDelivery.create({
          data: {
            sourceId: httpSource.id,
            endpointId: httpSource.endpointId,
            environmentId: httpSource.environmentId,
            url: request.url,
            method: request.method,
            headers: Object.fromEntries(request.headers),
            body: ["POST", "PUT", "PATCH"].includes(request.method)
              ? Buffer.from(await request.arrayBuffer())
              : undefined,
          },
        });

      await workerQueue.enqueue(
        "deliverHttpSourceRequest",
        {
          id: delivery.id,
        },
        {
          queueName: `endpoint-${httpSource.endpointId}`,
        }
      );

      return { status: 200 };
    }

    // TODO: implement interactive webhooks

    return { status: 200 };
  }
}
