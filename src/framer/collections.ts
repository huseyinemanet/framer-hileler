import type { FramerClient } from "./client.js";

export interface FramerField {
  id: string;
  name: string;
  type: string;
  cases?: Array<{ id: string; name: string }>;
}

export interface FramerItem {
  id: string;
  slug: string;
  fieldData: Record<string, { type: string; value: unknown }>;
  setAttributes?: (update: {
    slug?: string;
    fieldData?: Record<string, { type: string; value: unknown }>;
  }) => Promise<unknown>;
}

export interface FramerCollection {
  id: string;
  name: string;
  getFields: () => Promise<FramerField[]>;
  getItems: () => Promise<FramerItem[]>;
  addItems: (items: unknown[]) => Promise<unknown>;
}

export interface ValidatedCollectionContext {
  hacksCollection: FramerCollection;
  gamesCollection: FramerCollection;
  hacksFieldsByName: Map<string, FramerField>;
  gamesFieldsByName: Map<string, FramerField>;
}

const REQUIRED_HACKS_FIELDS = [
  "Title",
  "Thumbnail",
  "Game",
  "Content Type",
  "Template Key",
  "Canonical Intent",
  "Intro",
  "Section 1 Heading",
  "Section 1 Body",
  "Section 2 Heading",
  "Section 2 Body",
  "Section 3 Heading",
  "Section 3 Body",
  "Warnings",
  "Internal Link Hints",
  "SEO Title",
  "SEO Description",
  "External ID",
  "Status",
  "AI Updated At",
  "Error"
] as const;

export async function getCollectionsContext(
  framer: FramerClient,
  hacksCollectionName: string,
  gamesCollectionName: string
): Promise<ValidatedCollectionContext> {
  const collections = (await framer.getCollections()) as unknown as FramerCollection[];
  const hacksCollection = collections.find((c) => c.name === hacksCollectionName);
  const gamesCollection = collections.find((c) => c.name === gamesCollectionName);

  if (!hacksCollection) {
    throw new Error(`Collection not found: ${hacksCollectionName}`);
  }
  if (!gamesCollection) {
    throw new Error(`Collection not found: ${gamesCollectionName}`);
  }

  const hacksFields = await hacksCollection.getFields();
  const gamesFields = await gamesCollection.getFields();

  const hacksFieldsByName = toFieldMap(hacksFields);
  const gamesFieldsByName = toFieldMap(gamesFields);

  for (const fieldName of REQUIRED_HACKS_FIELDS) {
    if (!hacksFieldsByName.has(fieldName)) {
      throw new Error(
        `Missing required field in "${hacksCollectionName}": ${fieldName}`
      );
    }
  }

  // Slug is shown in the CMS but Framer often exposes it only as CollectionItem.slug /
  // addItems({ slug }), not as a row in getFields(). Do not require a "Slug" field id.

  const gameField = hacksFieldsByName.get("Game");
  if (!gameField || gameField.type !== "collectionReference") {
    throw new Error(`"Game" field must be type "collectionReference".`);
  }

  return {
    hacksCollection,
    gamesCollection,
    hacksFieldsByName,
    gamesFieldsByName
  };
}

function toFieldMap(fields: FramerField[]): Map<string, FramerField> {
  return new Map(fields.map((field) => [field.name, field]));
}
