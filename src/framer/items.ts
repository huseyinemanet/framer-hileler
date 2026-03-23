import { env } from "../utils/env.js";
import type { FramerClient } from "./client.js";
import type { FramerCollection, FramerItem } from "./collections.js";

export async function getCollectionItems(
  collection: FramerCollection
): Promise<FramerItem[]> {
  return (await collection.getItems()) as FramerItem[];
}

export async function addOrUpdateItemsWithRetry(
  collection: FramerCollection,
  items: Array<Record<string, unknown>>
): Promise<void> {
  await withRetry(async () => {
    await collection.addItems(items);
  });
}

export async function setItemErrorWithRetry(
  item: FramerItem,
  fieldId: string,
  message: string
): Promise<void> {
  if (!item.setAttributes) return;
  await withRetry(async () => {
    await item.setAttributes?.({
      fieldData: {
        [fieldId]: { type: "string", value: message }
      }
    });
  });
}

export async function publishIfNeeded(
  framer: FramerClient,
  shouldPublish: boolean,
  shouldDeploy: boolean
): Promise<{ published: boolean; deployed: boolean }> {
  if (!shouldPublish) return { published: false, deployed: false };
  const publishResult = await framer.publish();
  if (shouldDeploy) {
    await framer.deploy(publishResult.deployment.id);
  }
  return { published: true, deployed: shouldDeploy };
}

async function withRetry<T>(task: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= env.MAX_RETRIES; attempt += 1) {
    try {
      return await task();
    } catch (error: unknown) {
      lastError = error;
      if (attempt === env.MAX_RETRIES) break;
      const sleepMs = env.RETRY_BASE_MS * 2 ** (attempt - 1);
      await sleep(sleepMs);
    }
  }
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
