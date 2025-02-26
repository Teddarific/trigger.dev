import { JsonSchema } from "@trigger.dev/common-schemas";
import { z } from "zod";
import {
  WorkflowRunEventPropertiesSchema,
  WorkflowSendRunEventPropertiesSchema,
} from "../sharedSchemas";

export const commandResponses = {
  RESOLVE_INTEGRATION_REQUEST: {
    data: z.object({
      id: z.string(),
      key: z.string(),
      output: JsonSchema.default({}),
    }),
    properties: WorkflowRunEventPropertiesSchema,
  },
  REJECT_INTEGRATION_REQUEST: {
    data: z.object({
      id: z.string(),
      key: z.string(),
      error: JsonSchema.default({}),
    }),
    properties: WorkflowRunEventPropertiesSchema,
  },
};

export const commands = {
  SEND_INTEGRATION_REQUEST: {
    data: z.object({
      key: z.string(),
      request: z.object({
        version: z.string().optional(),
        service: z.string(),
        endpoint: z.string(),
        params: z.any(),
      }),
    }),
    properties: WorkflowSendRunEventPropertiesSchema,
  },
};
