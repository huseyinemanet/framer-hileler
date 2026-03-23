import { generateCheatsWithAnthropic } from "../ai/generateCheats.js";
import type { RawCheatInput, SyncResult } from "../content/types.js";
import { connectFramer } from "../framer/client.js";
import type { FramerField, FramerItem } from "../framer/collections.js";
import { getCollectionsContext } from "../framer/collections.js";
import { getCollectionItems } from "../framer/items.js";
import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import { countCheatsPerGameSlug, selectGameForAiRun } from "./selectGameForAi.js";
import { runSyncCore } from "./runSyncCore.js";

export interface RunAiSyncOptions {
  dryRun: boolean;
  publish: boolean;
  deploy: boolean;
}

const OPTIONAL_GAME_CONTEXT_FIELDS = [
  "Platform",
  "Konusu",
  "Türler",
  "Seriler",
  "Geliştiriciler",
  "Yayıncılar"
] as const;

export async function runAiSync(options: RunAiSyncOptions): Promise<SyncResult> {
  const framer = await connectFramer();

  try {
    const context = await getCollectionsContext(
      framer,
      env.FRAMER_HACKS_COLLECTION_NAME,
      env.FRAMER_GAMES_COLLECTION_NAME
    );
    logger.success("collection found");
    logger.success("field validation passed");

    const hacksItems = await getCollectionItems(context.hacksCollection);
    const gamesItems = await getCollectionItems(context.gamesCollection);

    const gameField = context.hacksFieldsByName.get("Game");
    if (!gameField) {
      throw new Error('Hileler koleksiyonunda "Game" alanı bulunamadı.');
    }

    const cheatsPerGameSlug = countCheatsPerGameSlug({
      hacksItems,
      gameFieldId: gameField.id
    });

    const pick = selectGameForAiRun({
      gamesItems,
      gamesFieldsByName: context.gamesFieldsByName,
      cheatsPerGameSlug,
      threshold: env.HACKS_PER_GAME_THRESHOLD,
      granularity: env.AI_ROTATION_GRANULARITY,
      rotationSeed: env.AI_ROTATION_SEED
    });

    const gameItem = gamesItems.find((g) => g.slug === pick.slug);
    const gameContextLines = buildGameContextLines(
      gameItem,
      context.gamesFieldsByName
    );

    logger.info(
      `AI hedef oyun: "${pick.displayTitle}" (slug=${pick.slug}) mevcut_hile_sayısı=${pick.cheatCount} eşik=${env.HACKS_PER_GAME_THRESHOLD}`
    );

    if (options.dryRun) {
      logger.warn(
        "dry-run + --ai: Anthropic çağrılmıyor (maliyet önlemi). Gerçek üretim için --write kullan."
      );
      return {
        total: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        publishedCount: 0,
        relationMissingCount: 0,
        dryRun: true,
        aiMeta: {
          selectedGameSlug: pick.slug,
          selectedGameTitle: pick.displayTitle,
          cheatsForThatGame: pick.cheatCount,
          threshold: env.HACKS_PER_GAME_THRESHOLD
        }
      };
    }

    const apiKey = env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey || apiKey.length === 0) {
      throw new Error("ANTHROPIC_API_KEY eksik. AI yazımı için .env içinde tanımlayın.");
    }

    const rawItems = await generateCheatsWithAnthropic({
      apiKey,
      model: env.ANTHROPIC_MODEL,
      gameDisplayTitle: pick.displayTitle,
      gameSlug: pick.slug,
      cheatsCount: env.AI_CHEATS_PER_RUN,
      gameContextLines
    });

    normalizeAiBatch(rawItems, pick.displayTitle);

    const result = await runSyncCore({
      framer,
      context,
      rawItems,
      dryRun: options.dryRun,
      publish: options.publish,
      deploy: options.deploy
    });

    return {
      ...result,
      aiMeta: {
        selectedGameSlug: pick.slug,
        selectedGameTitle: pick.displayTitle,
        cheatsForThatGame: pick.cheatCount,
        threshold: env.HACKS_PER_GAME_THRESHOLD
      }
    };
  } finally {
    await framer.disconnect();
    logger.info("disconnect completed");
  }
}

function buildGameContextLines(
  game: FramerItem | undefined,
  gamesFieldsByName: Map<string, FramerField>
): string[] {
  if (!game) return [];
  const lines: string[] = [];
  for (const name of OPTIONAL_GAME_CONTEXT_FIELDS) {
    const field = gamesFieldsByName.get(name);
    if (!field) continue;
    const raw = game.fieldData[field.id]?.value;
    if (typeof raw === "string" && raw.trim().length > 0) {
      lines.push(`${name}: ${raw.trim()}`);
    }
  }
  return lines;
}

function normalizeAiBatch(items: RawCheatInput[], exactGameTitle: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    item.gameTitle = exactGameTitle;
    const base = item.externalId.trim();
    let id = base;
    let n = 0;
    while (seen.has(id)) {
      n += 1;
      id = `${base}-${n}`;
    }
    seen.add(id);
    item.externalId = id;
  }
}
