import { env } from "./utils/env.js";
import { logger } from "./utils/logger.js";
import { runAiSync } from "./pipeline/runAiSync.js";
import { runSync } from "./pipeline/runSync.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--write");
  const publish = args.includes("--publish");
  const deploy = args.includes("--deploy");
  const forceFile = args.includes("--file");
  const useAi =
    !forceFile && (args.includes("--ai") || env.SYNC_SOURCE === "ai");
  if (deploy && !publish) {
    throw new Error("--deploy can only be used together with --publish.");
  }
  const inputPath = getArgValue(args, "--input") ?? env.SYNC_INPUT_PATH;

  logger.info(
    `starting ${useAi ? "AI" : "file"} sync${useAi ? "" : ` from ${inputPath}`} mode=${dryRun ? "dry-run" : "write"} publish=${publish} deploy=${deploy}`
  );
  const result = useAi
    ? await runAiSync({ dryRun, publish, deploy })
    : await runSync({ inputPath, dryRun, publish, deploy });
  if (result.aiMeta) {
    logger.info(
      `AI seçimi: oyun="${result.aiMeta.selectedGameTitle}" slug=${result.aiMeta.selectedGameSlug} mevcut_hile=${result.aiMeta.cheatsForThatGame} eşik=${result.aiMeta.threshold}`
    );
  }
  logger.success(
    `sync completed total=${result.total} created=${result.created} updated=${result.updated} skipped=${result.skipped} failed=${result.failed} published_count=${result.publishedCount} relation_missing_count=${result.relationMissingCount}`
  );

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

function getArgValue(args: string[], key: string): string | null {
  const index = args.indexOf(key);
  if (index < 0) return null;
  return args[index + 1] ?? null;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unexpected error";
  logger.error(message);
  process.exit(1);
});
