export type SyncStatus = "draft" | "review" | "published";

export interface InputSection {
  heading?: string | undefined;
  body?: string | undefined;
}

export interface RawCheatInput {
  title: string;
  gameTitle: string;
  contentType?: string;
  templateKey?: string;
  canonicalIntent: string;
  intro?: string;
  sections?: InputSection[];
  warnings?: string[];
  internalLinkHints?: string[];
  seoTitle?: string;
  seoDescription?: string;
  externalId: string;
  status?: string;
  thumbnailUrl?: string | undefined;
  aiUpdatedAt?: string;
}

export interface NormalizedCheatContent {
  title: string;
  gameTitle: string;
  contentType: string;
  templateKey: string;
  canonicalIntent: string;
  intro: string;
  sections: [InputSection, InputSection, InputSection];
  warnings: string[];
  internalLinkHints: string[];
  seoTitle: string;
  seoDescription: string;
  externalId: string;
  status: SyncStatus;
  thumbnailUrl?: string | undefined;
  aiUpdatedAt: string;
  slug: string;
}

export interface SyncInputFile {
  items: RawCheatInput[];
}

export interface SyncResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  publishedCount: number;
  relationMissingCount: number;
  dryRun: boolean;
}

export interface UpsertOutcome {
  action: "created" | "updated" | "skipped" | "failed";
  externalId: string;
  message: string;
  relationMissing?: boolean;
}
