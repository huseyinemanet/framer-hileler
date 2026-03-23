const TURKISH_CHAR_MAP: Record<string, string> = {
  c: "c",
  C: "c",
  g: "g",
  G: "g",
  i: "i",
  I: "i",
  o: "o",
  O: "o",
  s: "s",
  S: "s",
  u: "u",
  U: "u",
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
  ı: "i",
  İ: "i",
  ö: "o",
  Ö: "o",
  ş: "s",
  Ş: "s",
  ü: "u",
  Ü: "u"
};

export function normalizeText(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .split("")
    .map((ch) => TURKISH_CHAR_MAP[ch] ?? ch)
    .join("")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function normalizeForDedupe(input: string): string {
  return normalizeText(input).replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

export function makeSlug(input: string): string {
  return normalizeText(input)
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
