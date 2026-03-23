# Framer Hileler Sync

Framer CMS içindeki `Hileler` koleksiyonuna güvenli upsert yapan Node.js + TypeScript pipeline.

- **file**: JSON dosyasından içerik
- **ai**: `Oyunlar` + mevcut `Hileler` ilişkisine göre **eşik altı** bir oyun seçer, **Anthropic (Claude)** ile o oyuna özel hile/rehber içeriği üretir, Framer’a yazar

Varsayılan çalışma modu **dry-run**'dır. Yazma yapmak için `--write` zorunludur.

## Env

`.env.example` dosyasını `.env` olarak kopyala:

- `FRAMER_API_KEY`
- `FRAMER_PROJECT_URL`
- `FRAMER_HACKS_COLLECTION_NAME` (default: `Hileler`)
- `FRAMER_GAMES_COLLECTION_NAME` (default: `Oyunlar`)
- `DEFAULT_STATUS` (`draft|review|published`)
- `STRICT_GAME_RELATION` (`true|false`)
- `SYNC_INPUT_PATH` (default: `./data/sample-cheats.json`)
- `SYNC_SOURCE` (`file` | `ai`) — `ai` ise CLI’da `--ai` olmadan da AI modu (override: `--file`)
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (AI modu; yanlış id için API `404 not_found_error` verir — [Anthropic](https://console.anthropic.com/) veya `GET https://api.anthropic.com/v1/models` ile doğrula)
- `HACKS_PER_GAME_THRESHOLD` — oyuna bağlı hile sayısı bundan küçükse öncelikli aday
- `AI_CHEATS_PER_RUN` — her koşuda üretilecek kayıt sayısı
- `AI_ROTATION_GRANULARITY` (`daily` | `hourly` | `random`) — aynı gün/saat içinde hangi oyunun sırası geldiği
- `AI_ROTATION_SEED` — rotasyon karıştırıcı (farklı repo/cron için)

## Çalıştırma

- `npm install`
- **Dosya modu** dry-run: `npm run sync:hacks -- --input ./data/sample-cheats.json`
- **Dosya modu** yazma: `npm run sync:hacks -- --write --input ./data/sample-cheats.json`
- **AI modu** — hangi oyunun seçildiğini görmek (Anthropic çağrılmaz): `npm run sync:hacks -- --ai`
- **AI modu** yazma: `npm run sync:hacks -- --ai --write`
- `SYNC_SOURCE=ai` iken tek seferlik dosya modu: `npm run sync:hacks -- --file --input ./data/sample-cheats.json`
- Yazma + publish: `npm run sync:hacks -- --write --publish --input ./data/sample-cheats.json`
- Yazma + publish + deploy: `npm run sync:hacks -- --write --publish --deploy --input ./data/sample-cheats.json`

`npm run run:daily` — `.env` içinde `SYNC_SOURCE=ai` ise günlük AI senkronu çalışır.

### GitHub Actions

Repo değişkeni `SYNC_SOURCE=ai` yapınca workflow `ANTHROPIC_API_KEY` secret’ı ve yukarıdaki AI env’lerini kullanır. Dosya modu için `SYNC_SOURCE=file` (varsayılan) bırakın.

## Input Format

Örnek dosya: `data/sample-cheats.json`

Her öğede en kritik alanlar:
- `title`
- `gameTitle`
- `canonicalIntent`
- `externalId`

Başlık kuralı (AI + dosya modu): `title` içinde **tam `gameTitle` metni** ve **“Hileleri” / “Hilesi” / kod-konsol-trainer** gibi net hile sinyali olmalı; strateji/rehber başlıkları reddedilir.

Section kuralı:
- `Section 1` heading+body zorunlu
- `Section 2` heading+body zorunlu
- `Section 3` opsiyonel

## Dedupe / Upsert

Sıra:
1. `External ID` exact match
2. `Canonical Intent` normalized exact match
3. `title/slug` normalized fallback

Normalize kuralları:
- trim
- lowercase
- Turkish karakter normalize
- boşluk/tire standardizasyonu

Warnings / Internal Link Hints standardı:
- her öğe `trim` edilir
- boş öğe atılır
- tek string'e `newline` ile yazılır (boş satır yok)

## Publish ve Deploy

- `--publish`: preview publish çalıştırır
- `--deploy`: yalnızca `--publish` ile birlikte kullanılabilir

## Bilinen Sınırlamalar

- CMS’te **Slug** sütunu görünse bile Server API `getFields()` içinde her zaman ayrı bir alan olarak gelmeyebilir. Slug, item üzerindeki `slug` alanı ile set edilir; `getFields()`’te `Slug` varsa ek olarak `fieldData`’ya da yazılır.
- Framer API transactional değil; bu yüzden item-bazlı retry + kısmi hata izolasyonu uygulanır.
- Thumbnail alanı URL bazlı yazılır. Asset upload akışı TODO.
- `STRICT_GAME_RELATION=true` varsayılanı önerilir. Bu modda eksik game relation item'i create etmez, skip+raporlar.

## Batch Summary

Çıktıda şu metrikler döner:
- `created`
- `updated`
- `skipped`
- `failed`
- `published_count`
- `relation_missing_count`
