import { z } from "zod";
import type { RawCheatInput } from "../content/types.js";

const rawCheatFromAiSchema = z.object({
  title: z.string().min(1),
  gameTitle: z.string().min(1),
  contentType: z.string().optional(),
  templateKey: z.string().optional(),
  canonicalIntent: z.string().min(1),
  intro: z.string().optional(),
  sections: z
    .array(
      z.object({
        heading: z.string().optional(),
        body: z.string().optional()
      })
    )
    .optional(),
  warnings: z.array(z.string()).optional(),
  internalLinkHints: z.array(z.string()).optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  externalId: z.string().min(1),
  status: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
  aiUpdatedAt: z.string().optional()
});

const aiResponseSchema = z.object({
  cheats: z.array(rawCheatFromAiSchema).min(1)
});

const ANTHROPIC_API_VERSION = "2023-06-01";

export interface GenerateCheatsParams {
  apiKey: string;
  model: string;
  gameDisplayTitle: string;
  gameSlug: string;
  cheatsCount: number;
  /** Oyuna özel kısa bağlam (CMS'ten opsiyonel alanlar) */
  gameContextLines: string[];
}

interface AnthropicMessageResponse {
  content?: Array<{ type: string; text?: string }>;
  error?: { type?: string; message?: string };
}

/**
 * Anthropic Messages API — JSON çıktı (prompt ile zorlanır; gerekirse ```json``` temizlenir).
 * İçerik: yasal oyun ipuçları / rehber tonu (hile yazılımı değil).
 */
export async function generateCheatsWithAnthropic(
  params: GenerateCheatsParams
): Promise<RawCheatInput[]> {
  const contextBlock =
    params.gameContextLines.length > 0
      ? params.gameContextLines.join("\n")
      : "(Ek bağlam yok)";

  const system = `Sen bir oyun rehber sitesi için Türkçe içerik yazıyorsun.
Kurallar:
- Sadece yasal oyun içi ipuçları, strateji ve rehber tonu kullan; hile yazılımı, exploit veya ToS ihlali önerme.
- Çıktı YALNIZCA geçerli bir JSON nesnesi olsun; markdown kod bloğu veya açıklama metni ekleme.
- Şema: {"cheats":[...]} — cheats dizisinde en az ${params.cheatsCount} öğe olsun (tercihen tam ${params.cheatsCount}).
- Her öğede zorunlu: title, gameTitle, canonicalIntent, externalId.
- gameTitle alanını kullanıcı mesajındaki JSON.stringify ile verilen tam metinle doldur.
- externalId benzersiz olsun: ai-${params.gameSlug}-<kısa-özet> formatında küçük harf, tire ile.
- templateKey: "cheat-default", contentType: kısa İngilizce etiket (ör. tips, build, economy).
- Her kayıtta Section 1 ve 2 için hem heading hem body dolu olsun; Section 3 opsiyonel.
- warnings: oyuncu için güvenli/etik uyarılar (en az 1 madde).`;

  const user = `Oyun slug: ${params.gameSlug}
gameTitle için kullanman gereken TAM metin (birebir): ${JSON.stringify(params.gameDisplayTitle)}

CMS bağlamı:
${contextBlock}

Bu oyun için ${params.cheatsCount} ayrı rehber/hile (oyun içi ipuçları) yaz.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": params.apiKey,
      "anthropic-version": ANTHROPIC_API_VERSION,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: 8192,
      temperature: 0.7,
      system,
      messages: [{ role: "user", content: user }]
    })
  });

  const rawBody = await res.text();
  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${rawBody.slice(0, 500)}`);
  }

  let json: AnthropicMessageResponse;
  try {
    json = JSON.parse(rawBody) as AnthropicMessageResponse;
  } catch {
    throw new Error("Anthropic yanıtı JSON değil.");
  }

  if (json.error?.message) {
    throw new Error(`Anthropic API: ${json.error.message}`);
  }

  const textBlocks =
    json.content
      ?.filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("") ?? "";

  if (!textBlocks.trim()) {
    throw new Error("Anthropic yanıtında metin içeriği yok.");
  }

  const jsonText = extractJsonObjectString(textBlocks);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText) as unknown;
  } catch {
    throw new Error("Anthropic çıktısı JSON olarak parse edilemedi.");
  }

  const validated = aiResponseSchema.parse(parsed);
  const cheats = validated.cheats as RawCheatInput[];
  if (cheats.length < params.cheatsCount) {
    throw new Error(
      `Anthropic yeterli kayıt üretmedi: beklenen ${params.cheatsCount}, gelen ${cheats.length}`
    );
  }
  return cheats.slice(0, params.cheatsCount);
}

/** ```json ... ``` veya çevresindeki metni ayıklar. */
function extractJsonObjectString(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}
