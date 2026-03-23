# Framer Hileler Sync

Framer CMS içindeki `Hileler` koleksiyonuna JSON input ile güvenli upsert yapan Node.js + TypeScript sync pipeline.

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

## Çalıştırma

- `npm install`
- Dry-run: `npm run sync:hacks -- --input ./data/sample-cheats.json`
- Yazma (sync only): `npm run sync:hacks -- --write --input ./data/sample-cheats.json`
- Yazma + publish: `npm run sync:hacks -- --write --publish --input ./data/sample-cheats.json`
- Yazma + publish + deploy: `npm run sync:hacks -- --write --publish --deploy --input ./data/sample-cheats.json`

## Input Format

Örnek dosya: `data/sample-cheats.json`

Her öğede en kritik alanlar:
- `title`
- `gameTitle`
- `canonicalIntent`
- `externalId`

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
