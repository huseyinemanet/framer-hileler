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
  /** file: JSON input; ai: eşik + rotasyon ile oyun seç, OpenAI üret */
  SYNC_SOURCE: z.enum(["file", "ai"]).default("file"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  /** Bu oyuna bağlı hile sayısı bu değerin altındaysa AI hedef adayı */
  HACKS_PER_GAME_THRESHOLD: z
    .string()
    .optional()
    .transform((value) => Number(value === undefined || value === "" ? "3" : value))
    .pipe(z.number().int().min(1).max(100_000)),
  /** Her çalıştırmada üretilecek hile sayısı */
  AI_CHEATS_PER_RUN: z
    .string()
    .optional()
    .transform((value) => Number(value === undefined || value === "" ? "2" : value))
    .pipe(z.number().int().min(1).max(25)),
  /** daily: takvim günü; hourly: saat; random: her koşuda rastgele */
  AI_ROTATION_GRANULARITY: z.enum(["daily", "hourly", "random"]).default("daily"),
  /** Rotasyon hash’ine karıştırıcı (repo/cron ayrımı için) */
  AI_ROTATION_SEED: z.string().default("framer-hacks-sync"),
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
