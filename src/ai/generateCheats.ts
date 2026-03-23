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

export interface GenerateCheatsParams {
  apiKey: string;
  model: string;
  gameDisplayTitle: string;
  gameSlug: string;
  cheatsCount: number;
  /** Oyuna özel kısa bağlam (CMS'ten opsiyonel alanlar) */
  gameContextLines: string[];
}

/**
 * OpenAI Chat Completions — JSON çıktı.
 * İçerik: yasal oyun ipuçları / rehber tonu (hile yazılımı değil).
 */
export async function generateCheatsWithOpenAI(
  params: GenerateCheatsParams
): Promise<RawCheatInput[]> {
  const contextBlock =
    params.gameContextLines.length > 0
      ? params.gameContextLines.join("\n")
      : "(Ek bağlam yok)";

  const system = `Sen bir oyun rehber sitesi için Türkçe içerik yazıyorsun.
Kurallar:
- Sadece yasal oyun içi ipuçları, strateji ve rehber tonu kullan; hile yazılımı, exploit veya ToS ihlali önerme.
- Çıktı YALNIZCA geçerli bir JSON nesnesi olsun, markdown veya açıklama metni ekleme.
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

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: params.model,
      temperature: 0.7,
      max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI yanıtında içerik yok.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new Error("OpenAI JSON parse edilemedi.");
  }

  const validated = aiResponseSchema.parse(parsed);
  const cheats = validated.cheats as RawCheatInput[];
  if (cheats.length < params.cheatsCount) {
    throw new Error(
      `OpenAI yeterli kayıt üretmedi: beklenen ${params.cheatsCount}, gelen ${cheats.length}`
    );
  }
  return cheats.slice(0, params.cheatsCount);
}
