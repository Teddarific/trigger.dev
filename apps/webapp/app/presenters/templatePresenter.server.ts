import type { PrismaClient } from "~/db.server";
import { prisma } from "~/db.server";
import { renderMarkdown } from "~/services/renderMarkdown.server";
import type { TemplateListItem } from "./templateListPresenter.server";

export class TemplatePresenter {
  #prismaClient: PrismaClient;

  constructor(prismaClient: PrismaClient = prisma) {
    this.#prismaClient = prismaClient;
  }

  async data({
    slug,
    id,
  }: {
    slug?: string;
    id?: string;
  }): Promise<{ template: TemplateListItem | undefined }> {
    const template = slug
      ? await this.#prismaClient.template.findUnique({
          where: {
            slug,
          },
        })
      : await this.#prismaClient.template.findUnique({
          where: {
            id,
          },
        });

    if (!template) {
      return { template: undefined };
    }

    const templateWithServiceMetadata = {
      ...template,
      docsHTML: renderMarkdown(template.markdownDocs),
      services: [],
    };

    return { template: templateWithServiceMetadata };
  }
}
