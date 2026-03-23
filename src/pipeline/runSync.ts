import { readFile } from "node:fs/promises";
import { validateAndNormalizeInput } from "../content/validate.js";
import type { RawCheatInput, SyncResult } from "../content/types.js";
import { connectFramer } from "../framer/client.js";
import { getCollectionsContext } from "../framer/collections.js";
import { getCollectionItems, publishIfNeeded } from "../framer/items.js";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import { upsertCheatItem } from "./upsertCheatItem.js";

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

    let hacksItems = await getCollectionItems(context.hacksCollection);
    let gamesItems = await getCollectionItems(context.gamesCollection);

    const result: SyncResult = {
      total: rawItems.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      publishedCount: 0,
      relationMissingCount: 0,
      dryRun: options.dryRun
    };

    for (const raw of rawItems) {
      try {
        const normalized = validateAndNormalizeInput(raw, env.DEFAULT_STATUS);
        const outcome = await upsertCheatItem(normalized, {
          hacksCollection: context.hacksCollection,
          hacksItems,
          gamesCollection: context.gamesCollection,
          gamesItems,
          hacksFieldsByName: context.hacksFieldsByName,
          gamesFieldsByName: context.gamesFieldsByName,
          strictGameRelation: env.STRICT_GAME_RELATION,
          dryRun: options.dryRun
        });

        hacksItems = await context.hacksCollection.getItems();
        gamesItems = await context.gamesCollection.getItems();

        if (outcome.action === "created") result.created += 1;
        if (outcome.action === "updated") result.updated += 1;
        if (outcome.action === "skipped") result.skipped += 1;
        if (outcome.action === "failed") result.failed += 1;
        if (outcome.relationMissing) result.relationMissingCount += 1;
        logger.info(`${outcome.externalId}: ${outcome.message}`);
      } catch (error: unknown) {
        result.failed += 1;
        const externalId =
          typeof raw === "object" && raw !== null && "externalId" in raw
            ? String((raw as { externalId?: unknown }).externalId ?? "unknown")
            : "unknown";
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error(`${externalId}: ${message}`);
      }
    }

    if (options.dryRun) {
      logger.info("publish skipped (dry-run)");
    } else {
      const publishResult = await publishIfNeeded(framer, options.publish, options.deploy);
      result.publishedCount = publishResult.published ? 1 : 0;
      logger.info(
        publishResult.published
          ? publishResult.deployed
            ? "publish performed + deployed"
            : "publish performed (deploy skipped)"
          : "publish skipped"
      );
    }
    return result;
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
