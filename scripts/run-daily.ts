import { runAiSync } from "../src/pipeline/runAiSync.js";
import { runSync } from "../src/pipeline/runSync.js";
import { env } from "../src/utils/env.js";
import { logger } from "../src/utils/logger.js";

async function runDaily(): Promise<void> {
  const publish = false;
  const deploy = false;
  const result =
    env.SYNC_SOURCE === "ai"
      ? await runAiSync({ dryRun: false, publish, deploy })
      : await runSync({
          inputPath: env.SYNC_INPUT_PATH,
          dryRun: false,
          publish,
          deploy
        });

  if (result.aiMeta) {
    logger.info(
      `daily AI hedef: ${result.aiMeta.selectedGameTitle} (${result.aiMeta.selectedGameSlug})`
    );
  }
  logger.success(
    `daily sync done total=${result.total} created=${result.created} updated=${result.updated} skipped=${result.skipped} failed=${result.failed} published_count=${result.publishedCount} relation_missing_count=${result.relationMissingCount}`
  );

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

runDaily().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unexpected error";
  logger.error(message);
  process.exit(1);
});
