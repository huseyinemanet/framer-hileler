import { z } from "zod";
import { toIsoOrNow } from "../utils/dates.js";
import { makeSlug } from "../utils/slug.js";
import type {
  InputSection,
  NormalizedCheatContent,
  RawCheatInput,
  SyncStatus
} from "./types.js";

const rawSectionSchema = z.object({
  heading: z.string().optional(),
  body: z.string().optional()
});

const rawCheatSchema = z.object({
  title: z.string().min(1),
  gameTitle: z.string().min(1),
  contentType: z.string().optional(),
  templateKey: z.string().optional(),
  canonicalIntent: z.string().min(1),
  intro: z.string().optional(),
  sections: z.array(rawSectionSchema).optional(),
  warnings: z.array(z.string()).optional(),
  internalLinkHints: z.array(z.string()).optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  externalId: z.string().min(1),
  status: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
  aiUpdatedAt: z.string().optional()
});

export function validateAndNormalizeInput(
  item: RawCheatInput,
  defaultStatus: SyncStatus
): NormalizedCheatContent {
  const parsed = rawCheatSchema.parse(item);
  assertCheatTitleAndIntent(parsed.gameTitle.trim(), parsed.title.trim());
  const intro = truncate(parsed.intro ?? "", 350);
  const sections = normalizeSections(parsed.sections ?? []);
  const seoTitle = (parsed.seoTitle ?? parsed.title).trim();
  const seoDescription = (
    parsed.seoDescription ?? (intro || parsed.title)
  ).trim();

  return {
    title: parsed.title.trim(),
    gameTitle: parsed.gameTitle.trim(),
    contentType: "hile",
    templateKey: (parsed.templateKey ?? "cheat-default").trim(),
    canonicalIntent: parsed.canonicalIntent.trim(),
    intro,
    sections,
    warnings: compactStrings(parsed.warnings ?? []),
    internalLinkHints: compactStrings(parsed.internalLinkHints ?? []),
    seoTitle,
    seoDescription: truncate(seoDescription, 160),
    externalId: parsed.externalId.trim(),
    status: normalizeStatus(parsed.status, defaultStatus),
    thumbnailUrl: parsed.thumbnailUrl,
    aiUpdatedAt: toIsoOrNow(parsed.aiUpdatedAt),
    slug: makeSlug(parsed.title)
  };
}

function normalizeSections(
  sections: InputSection[]
): [InputSection, InputSection, InputSection] {
  const trimmed = sections.slice(0, 3).map((section) => ({
    heading: section.heading?.trim() ?? "",
    body: section.body?.trim() ?? ""
  }));
  while (trimmed.length < 3) trimmed.push({ heading: "", body: "" });
  const section1 = trimmed[0] ?? { heading: "", body: "" };
  const section2 = trimmed[1] ?? { heading: "", body: "" };
  if (!section1.heading || !section1.body || !section2.heading || !section2.body) {
    throw new Error(
      "Validation failed: Section 1 and Section 2 must include both heading and body."
    );
  }
  return [
    section1,
    section2,
    trimmed[2] ?? { heading: "", body: "" }
  ];
}

function compactStrings(values: string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

/**
 * AI veya manuel girişte rehber/strateji başlıklarını erken yakalar.
 * Site kalıbı: "{Oyun Adı} Hileleri: …"
 */
function assertCheatTitleAndIntent(gameTitle: string, title: string): void {
  const t = title.trim();
  const g = gameTitle.trim();
  if (g.length === 0) return;
  if (!t.toLowerCase().includes(g.toLowerCase())) {
    throw new Error(
      `Başlık oyun adını içermeli (CMS ile eşleşme için): "${g}" — alınan: "${t}"`
    );
  }
  if (!/\bhileleri\b|\bhilesi\b|\bkod(lar)?\b|\bkonsol\b|\btrainer\b|\bglitch\b|\bduplicate\b|\bsonsuz\b|\bpara hilesi\b|\bcan hilesi\b/i.test(t)) {
    throw new Error(
      `Başlık oyun hilesi formatında olmalı (örn. "… Hileleri: …" veya kod/trainer): "${t}"`
    );
  }
  const strategyOnly =
    /\bstrateji\b|\brehber\b|\bekonomi yönetimi\b|\bkaynak toplama\b|\bwalkthrough\b|\bgörev rehberi\b/i.test(
      t
    ) &&
    !/\bhileleri\b|\bhilesi\b/i.test(t);
  if (strategyOnly) {
    throw new Error(
      `Başlık strateji/rehber gibi görünüyor; "… Hileleri: …" formatına çevir: "${t}"`
    );
  }
  const afterColon = t.split(/:\s*/).slice(1).join(": ").trim();
  if (afterColon.length > 0) {
    const cheatHint =
      /\b(kod|konsol|trainer|glitch|duplicate|sonsuz|para|can|cephane|mühimmat|ammo|xp|seviye|unlock|açık)\b/i.test(
        afterColon
      );
    const badSubtitle =
      /\bstrateji\b|\brehber\b|\bekonomi\b|\bkaynak toplama\b|\bzafer\b|\bustalaş\b|\boptimizasyon\b/i.test(
        afterColon
      );
    if (badSubtitle && !cheatHint) {
      throw new Error(
        `Başlığın hile kısmı kod/trainer/sonsuz para gibi net bir hile konusu içermeli: "${t}"`
      );
    }
  }
}

function normalizeStatus(input: string | undefined, fallback: SyncStatus): SyncStatus {
  if (input === "draft" || input === "review" || input === "published") {
    return input;
  }
  return fallback;
}
