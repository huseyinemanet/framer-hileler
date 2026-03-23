import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  FRAMER_API_KEY: z.string().min(1),
  FRAMER_PROJECT_URL: z.string().min(1),
  FRAMER_HACKS_COLLECTION_NAME: z.string().min(1).default("Hileler"),
  FRAMER_GAMES_COLLECTION_NAME: z.string().min(1).default("Oyunlar"),
  DEFAULT_STATUS: z.enum(["draft", "review", "published"]).default("draft"),
  STRICT_GAME_RELATION: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  SYNC_INPUT_PATH: z.string().default("./data/sample-cheats.json"),
  MAX_RETRIES: z
    .string()
    .optional()
    .transform((value) => Number(value ?? "3")),
  RETRY_BASE_MS: z
    .string()
    .optional()
    .transform((value) => Number(value ?? "400"))
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const env = parsed.data;
