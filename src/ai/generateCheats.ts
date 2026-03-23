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
    .preprocess((value) => {
      if (Array.isArray(value)) return value;
      if (value && typeof value === "object") {
        const obj = value as Record<string, unknown>;
        if (Array.isArray(obj.sections)) return obj.sections;
        const candidates = ["section1", "section2", "section3"]
          .map((k) => obj[k])
          .filter(Boolean);
        if (candidates.length > 0) return candidates;
      }
      return value;
    }, z
      .array(
        z.object({
          heading: z.string().optional(),
          body: z.string().optional()
        })
      )
      .optional()),
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
 * Sadece **oyun hileleri** (kod, konsol, trainer tablosu, bilinen glitch vb.) — strateji/rehber değil.
 */
export async function generateCheatsWithAnthropic(
  params: GenerateCheatsParams
): Promise<RawCheatInput[]> {
  const contextBlock =
    params.gameContextLines.length > 0
      ? params.gameContextLines.join("\n")
      : "(Ek bağlam yok)";

  const gameQuoted = JSON.stringify(params.gameDisplayTitle);

  const system = `Sen Türkçe bir "oyun hileleri" sitesi için içerik üretiyorsun. Çıktı SADECE gerçek hile içeriği olmalı.

ZORUNLU TÜR — her kayıt şunlardan en az birini içermeli:
- PC/konsol hile kodları veya tuş kombinasyonları (oyunun resmi / yaygın bilinen hileleri)
- Konsol / komut satırı / debug menüsü ile ilgili bilinen yöntemler (varsa)
- Trainer tablosu: hangi tuş ne yapar (trainer kullanımı risklidir; yalnızca bilgilendirme + uyarı)
- Bilinen para / can / cephane / XP gibi **hile** yöntemleri (yalnızca oyun içi veya yaygın kaynaklarda geçenler)
- Yaygın bilinen glitch/duplicate **hile**leri (çok kısa, risk uyarısı ile)

KESİNLİKLE YASAK — bunları yazma (bunlar rehber/strateji, hile değil):
- "strateji", "rehber", "nasıl kazanılır", build/meta, görev/walkthrough, combat timing, "ekonomi yönetimi", "kaynak toplama", genel oynanış ipuçları
- Sadece "daha iyi oyna" anlatan içerik; mutlaka hile/kod/trainer/glitch odağı olmalı

BAŞLIK FORMATI (site ile uyumlu, birebir kalıp):
- title = (gameTitle metninin kendisi, tırnaksız) + " Hileleri: " + kısa hile konusu
  Örnek: Ghost of Tsushima Hileleri: Sınırsız Para ve Kaynak Kodları

canonicalIntent: küçük harf, Türkçe, hile konusu (ör. "ghost of tsushima para hilesi kodlari").

Çıktı YALNIZCA geçerli JSON nesnesi; markdown veya açıklama yok.
Şema: {"cheats":[...]} — en az ${params.cheatsCount} öğe (tercihen tam ${params.cheatsCount}).
Her öğede zorunlu: title, gameTitle, canonicalIntent, externalId.
gameTitle = kullanıcı mesajındaki JSON.stringify ile verilen tam metin.
externalId: ai-${params.gameSlug}-<özet> küçük harf tire.
templateKey: "cheat-default", contentType: "hile".
Section 1 ve 2: heading+body dolu; Section 3 opsiyonel. Body'lerde mümkünse kodları liste veya satır satır ver.
warnings: en az 1 madde (trainer/online riski, kayıt bozulması, güncelleme ile çalışmama vb.).`;

  const user = `Oyun slug: ${params.gameSlug}
gameTitle (birebir): ${gameQuoted}

CMS bağlamı (sadece bağlam; hile yoksa genel bilinen hileleri kullan):
${contextBlock}

Bu oyun için ${params.cheatsCount} AYRI oyun hilesi makalesi üret. Her biri farklı hile konusu olsun (ör. para, can, cephane, farklı kod setleri). Strateji/rehber yazma.`;

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
      temperature: 0.45,
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
