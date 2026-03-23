import { findExistingCheatItem, resolveGameReferenceSlug } from "../content/dedupe.js";
import { mapCheatToFramerFieldData } from "../content/mapper.js";
import type { NormalizedCheatContent, UpsertOutcome } from "../content/types.js";
import type {
  FramerCollection,
  FramerField,
  FramerItem
} from "../framer/collections.js";
import {
  addOrUpdateItemsWithRetry,
  setItemErrorWithRetry
} from "../framer/items.js";
import { logger } from "../utils/logger.js";
import { makeSlug } from "../utils/slug.js";

interface UpsertContext {
  hacksCollection: FramerCollection;
  hacksItems: FramerItem[];
  gamesCollection: FramerCollection;
  gamesItems: FramerItem[];
  hacksFieldsByName: Map<string, FramerField>;
  gamesFieldsByName: Map<string, FramerField>;
  strictGameRelation: boolean;
  dryRun: boolean;
}

export async function upsertCheatItem(
  content: NormalizedCheatContent,
  ctx: UpsertContext
): Promise<UpsertOutcome> {
  try {
    let gameSlug = resolveGameReferenceSlug({
      gameTitle: content.gameTitle,
      gamesItems: ctx.gamesItems,
      gamesFieldsByName: ctx.gamesFieldsByName
    });

    if (!gameSlug) {
      if (ctx.strictGameRelation) {
        return {
          action: "skipped",
          externalId: content.externalId,
          message: `Game relation not found: ${content.gameTitle}`,
          relationMissing: true
        };
      }
      gameSlug = makeSlug(content.gameTitle);
      const gameTitleField = ctx.gamesFieldsByName.get("Title");
      if (!gameTitleField) {
        throw new Error(`"Oyunlar" collection has no "Title" field.`);
      }
      if (ctx.dryRun) {
        logger.warn(`dry-run: would create missing game "${content.gameTitle}"`);
      } else {
        await addOrUpdateItemsWithRetry(ctx.gamesCollection, [
          {
            slug: gameSlug,
            fieldData: {
              [gameTitleField.id]: { type: "string", value: content.gameTitle }
            }
          }
        ]);
        ctx.gamesItems = await ctx.gamesCollection.getItems();
      }
    }

    logger.info(`game resolved: ${content.gameTitle} -> ${gameSlug}`);

    const existing = findExistingCheatItem({
      items: ctx.hacksItems,
      fieldsByName: ctx.hacksFieldsByName,
      content
    });

    const fieldData = mapCheatToFramerFieldData({
      content,
      hacksFieldsByName: ctx.hacksFieldsByName,
      gameReferenceSlug: gameSlug
    });

    const payload: Record<string, unknown> = {
      slug: content.slug,
      fieldData
    };
    if (existing) payload.id = existing.id;

    logger.info(
      `upsert decision: ${existing ? "update" : "create"} (${content.externalId})`
    );

    if (ctx.dryRun) {
      logger.warn(`dry-run: would write item ${content.externalId}`);
    } else {
      await addOrUpdateItemsWithRetry(ctx.hacksCollection, [payload]);
      logger.success(`item written: ${content.externalId}`);
      ctx.hacksItems = await ctx.hacksCollection.getItems();
    }

    return {
      action: existing ? "updated" : "created",
      externalId: content.externalId,
      message: existing
        ? `Updated existing item (${existing.id})`
        : `Created new item (${content.slug})`
    };
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : "Unknown error";
    const message = withErrorTimestamp(rawMessage);
    logger.error(`item failed ${content.externalId}: ${message}`);
    const existing = findExistingCheatItem({
      items: ctx.hacksItems,
      fieldsByName: ctx.hacksFieldsByName,
      content
    });
    if (existing) {
      const errorField = ctx.hacksFieldsByName.get("Error");
      if (errorField) {
        await setItemErrorWithRetry(existing, errorField.id, message);
      }
    }
    return {
      action: "failed",
      externalId: content.externalId,
      message
    };
  }
}

function withErrorTimestamp(message: string): string {
  return `[${new Date().toISOString()}] ${message}`;
}
