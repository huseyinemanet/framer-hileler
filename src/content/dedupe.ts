import type { FramerField, FramerItem } from "../framer/collections.js";
import { normalizeForDedupe } from "../utils/slug.js";
import type { NormalizedCheatContent } from "./types.js";

const GAME_TITLE_FIELD_CANDIDATES = ["Title", "Adı", "Name", "İsim"] as const;

export function findExistingCheatItem(params: {
  items: FramerItem[];
  fieldsByName: Map<string, FramerField>;
  content: NormalizedCheatContent;
}): FramerItem | null {
  const { items, fieldsByName, content } = params;
  const externalIdFieldId = getFieldId(fieldsByName, "External ID");
  const canonicalIntentFieldId = getFieldId(fieldsByName, "Canonical Intent");
  const titleFieldId = getFieldId(fieldsByName, "Title");

  const byExternalId = items.find((item) => {
    const value = getStringField(item, externalIdFieldId);
    return value === content.externalId;
  });
  if (byExternalId) return byExternalId;

  const normalizedIntent = normalizeForDedupe(content.canonicalIntent);
  const byIntent = items.find((item) => {
    const value = normalizeForDedupe(getStringField(item, canonicalIntentFieldId));
    return value.length > 0 && value === normalizedIntent;
  });
  if (byIntent) return byIntent;

  const normalizedTitle = normalizeForDedupe(content.title);
  const normalizedSlug = normalizeForDedupe(content.slug);
  return (
    items.find((item) => {
      const itemTitle = normalizeForDedupe(getStringField(item, titleFieldId));
      const itemSlug = normalizeForDedupe(item.slug ?? "");
      return (
        (itemTitle.length > 0 && itemTitle === normalizedTitle) ||
        (itemSlug.length > 0 && itemSlug === normalizedSlug)
      );
    }) ?? null
  );
}

export function resolveGameReferenceSlug(params: {
  gameTitle: string;
  gamesItems: FramerItem[];
  gamesFieldsByName: Map<string, FramerField>;
}): string | null {
  const titleFieldId = resolveGameTitleFieldId(params.gamesFieldsByName);
  const target = normalizeForDedupe(params.gameTitle);
  for (const game of params.gamesItems) {
    const slugCandidate = normalizeForDedupe(game.slug ?? "");
    if (slugCandidate === target) return game.slug;
    if (titleFieldId) {
      const title = normalizeForDedupe(getStringField(game, titleFieldId));
      if (title === target) return game.slug;
    }
  }
  return null;
}

export function resolveGameTitleFieldId(
  fieldsByName: Map<string, FramerField>
): string | null {
  for (const candidate of GAME_TITLE_FIELD_CANDIDATES) {
    const fieldId = getFieldId(fieldsByName, candidate, false);
    if (fieldId) return fieldId;
  }
  return null;
}

function getFieldId(
  fieldsByName: Map<string, FramerField>,
  fieldName: string,
  strict = true
): string | null {
  const field = fieldsByName.get(fieldName);
  if (!field && strict) throw new Error(`Field not found: ${fieldName}`);
  return field?.id ?? null;
}

function getStringField(item: FramerItem, fieldId: string | null): string {
  if (!fieldId) return "";
  const value = item.fieldData[fieldId]?.value;
  return typeof value === "string" ? value : "";
}
