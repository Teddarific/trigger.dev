import { z } from "zod";
import { EventRuleSchema } from "./eventFilter";
import { DeserializedJsonSchema } from "./json";

export const TriggerMetadataSchema = z.object({
  title: z.string(),
  elements: z.array(
    z.object({
      label: z.string(),
      text: z.string(),
      url: z.string().optional(),
    })
  ),
  eventRule: EventRuleSchema,
  schema: DeserializedJsonSchema.optional(),
});

export type TriggerMetadata = z.infer<typeof TriggerMetadataSchema>;

export const TriggerVariantConfigSchema = z.object({
  id: z.string(),
  trigger: TriggerMetadataSchema,
});

export type TriggerVariantConfig = z.infer<typeof TriggerVariantConfigSchema>;
