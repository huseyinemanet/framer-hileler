import { readFile } from "node:fs/promises";
import type { RawCheatInput, SyncResult } from "../content/types.js";
import { connectFramer } from "../framer/client.js";
import { getCollectionsContext } from "../framer/collections.js";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import { runSyncCore } from "./runSyncCore.js";

export interface RunSyncOptions {
  inputPath: string;
  dryRun: boolean;
  publish: boolean;
  deploy: boolean;
}

export async function runSync(options: RunSyncOptions): Promise<SyncResult> {
  const rawItems = await loadInput(options.inputPath);
  const framer = await connectFramer();

  try {
    const context = await getCollectionsContext(
      framer,
      env.FRAMER_HACKS_COLLECTION_NAME,
      env.FRAMER_GAMES_COLLECTION_NAME
    );
    logger.success("collection found");
    logger.success("field validation passed");

    return await runSyncCore({
      framer,
      context,
      rawItems,
      dryRun: options.dryRun,
      publish: options.publish,
      deploy: options.deploy
    });
  } finally {
    await framer.disconnect();
    logger.info("disconnect completed");
  }
}

async function loadInput(path: string): Promise<RawCheatInput[]> {
  const text = await readFile(path, "utf8");
  const json = JSON.parse(text) as unknown;
  if (!Array.isArray(json)) {
    throw new Error("Input JSON must be an array.");
  }
  return json as RawCheatInput[];
}
