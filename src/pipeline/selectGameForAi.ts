import type { FramerField, FramerItem } from "../framer/collections.js";
import { resolveGameTitleFieldId } from "../content/dedupe.js";
export type AiRotationGranularity = "daily" | "hourly" | "random";

export interface GamePick {
  slug: string;
  displayTitle: string;
  cheatCount: number;
}

/**
 * Her Hile kaydındaki Game relation değerinden (slug) sayım yapar.
 */
export function countCheatsPerGameSlug(params: {
  hacksItems: FramerItem[];
  gameFieldId: string;
}): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of params.hacksItems) {
    const entry = item.fieldData[params.gameFieldId];
    const slug = extractCollectionRefSlug(entry?.value);
    if (!slug) continue;
    map.set(slug, (map.get(slug) ?? 0) + 1);
  }
  return map;
}

function extractCollectionRefSlug(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (
    value &&
    typeof value === "object" &&
    "value" in value &&
    typeof (value as { value: unknown }).value === "string"
  ) {
    const v = (value as { value: string }).value.trim();
    return v.length > 0 ? v : null;
  }
  return null;
}

function gameDisplayTitle(
  game: FramerItem,
  titleFieldId: string | null
): string {
  if (titleFieldId) {
    const raw = game.fieldData[titleFieldId]?.value;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return game.slug;
}

/**
 * Eşik: cheatCount < threshold olan oyunlar öncelikli.
 * Hepsi eşiğin üstündeyse en az hileye sahip oyunlar havuzu kullanılır.
 * Rotasyon: granularity + seed ile deterministik indeks (random modunda Math.random).
 */
export function selectGameForAiRun(params: {
  gamesItems: FramerItem[];
  gamesFieldsByName: Map<string, FramerField>;
  cheatsPerGameSlug: Map<string, number>;
  threshold: number;
  granularity: AiRotationGranularity;
  rotationSeed: string;
}): GamePick {
  const titleFieldId = resolveGameTitleFieldId(params.gamesFieldsByName);
  if (params.gamesItems.length === 0) {
    throw new Error("Oyunlar koleksiyonunda hiç kayıt yok.");
  }

  const scored = params.gamesItems.map((game) => {
    const count = params.cheatsPerGameSlug.get(game.slug) ?? 0;
    return {
      slug: game.slug,
      displayTitle: gameDisplayTitle(game, titleFieldId),
      cheatCount: count
    };
  });

  const underThreshold = scored.filter((g) => g.cheatCount < params.threshold);
  const pool = underThreshold.length > 0 ? underThreshold : [...scored].sort((a, b) => a.cheatCount - b.cheatCount);

  pool.sort((a, b) => {
    if (a.cheatCount !== b.cheatCount) return a.cheatCount - b.cheatCount;
    return a.slug.localeCompare(b.slug, "tr");
  });

  const idx = pickRotationIndex(pool.length, params.granularity, params.rotationSeed);
  const picked = pool[idx];
  if (!picked) throw new Error("Oyun seçilemedi.");
  return picked;
}

function pickRotationIndex(
  length: number,
  granularity: AiRotationGranularity,
  seed: string
): number {
  if (length <= 1) return 0;
  if (granularity === "random") {
    return Math.floor(Math.random() * length);
  }
  const now = new Date();
  const key =
    granularity === "hourly"
      ? `${now.toISOString().slice(0, 13)}Z`
      : now.toISOString().slice(0, 10);
  const h = djb2(`${seed}|${key}`);
  return h % length;
}

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}
