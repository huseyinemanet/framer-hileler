import type { FramerField } from "../framer/collections.js";
import type { NormalizedCheatContent } from "./types.js";

type FieldValue = { type: string; value: unknown };

export interface CheatFieldMappingInput {
  content: NormalizedCheatContent;
  hacksFieldsByName: Map<string, FramerField>;
  gameReferenceValue: string;
  errorMessage?: string;
}

export function mapCheatToFramerFieldData(
  input: CheatFieldMappingInput
): Record<string, FieldValue> {
  const { content, hacksFieldsByName, gameReferenceValue, errorMessage } = input;
  const warningsText = content.warnings.join("\n");
  const internalHintsText = content.internalLinkHints.join("\n");
  const contentTypeField = mustField(hacksFieldsByName, "Content Type");
  const statusField = mustField(hacksFieldsByName, "Status");
  const aiUpdatedAtField = mustField(hacksFieldsByName, "AI Updated At");

  const fieldData: Record<string, FieldValue> = {
    [fieldId(hacksFieldsByName, "Title")]: value("string", content.title),
    [fieldId(hacksFieldsByName, "Thumbnail")]: value(
      "image",
      content.thumbnailUrl ?? ""
    ),
    [fieldId(hacksFieldsByName, "Game")]: value(
      "collectionReference",
      gameReferenceValue
    ),
    [contentTypeField.id]: value(
      contentTypeField.type === "enum" ? "enum" : "string",
      resolveEnumCaseId(contentTypeField, content.contentType)
    ),
    [fieldId(hacksFieldsByName, "Template Key")]: value(
      "string",
      content.templateKey
    ),
    [fieldId(hacksFieldsByName, "Canonical Intent")]: value(
      "string",
      content.canonicalIntent
    ),
    [fieldId(hacksFieldsByName, "Intro")]: value("string", content.intro),
    [fieldId(hacksFieldsByName, "Section 1 Heading")]: value(
      "string",
      content.sections[0].heading ?? ""
    ),
    [fieldId(hacksFieldsByName, "Section 1 Body")]: value(
      "string",
      content.sections[0].body ?? ""
    ),
    [fieldId(hacksFieldsByName, "Section 2 Heading")]: value(
      "string",
      content.sections[1].heading ?? ""
    ),
    [fieldId(hacksFieldsByName, "Section 2 Body")]: value(
      "string",
      content.sections[1].body ?? ""
    ),
    [fieldId(hacksFieldsByName, "Section 3 Heading")]: value(
      "string",
      content.sections[2].heading ?? ""
    ),
    [fieldId(hacksFieldsByName, "Section 3 Body")]: value(
      "string",
      content.sections[2].body ?? ""
    ),
    [fieldId(hacksFieldsByName, "Warnings")]: value("string", warningsText),
    [fieldId(hacksFieldsByName, "Internal Link Hints")]: value(
      "string",
      internalHintsText
    ),
    [fieldId(hacksFieldsByName, "SEO Title")]: value("string", content.seoTitle),
    [fieldId(hacksFieldsByName, "SEO Description")]: value(
      "string",
      content.seoDescription
    ),
    [fieldId(hacksFieldsByName, "External ID")]: value(
      "string",
      content.externalId
    ),
    [statusField.id]: value(
      statusField.type === "enum" ? "enum" : "string",
      resolveEnumCaseId(statusField, content.status)
    ),
    [aiUpdatedAtField.id]: value(
      aiUpdatedAtField.type === "date" ? "date" : "string",
      content.aiUpdatedAt
    ),
    [fieldId(hacksFieldsByName, "Error")]: value("string", errorMessage ?? "")
  };

  const slugField = hacksFieldsByName.get("Slug");
  if (slugField) {
    fieldData[slugField.id] = value("string", content.slug);
  }

  return fieldData;
}

function mustField(fields: Map<string, FramerField>, name: string): FramerField {
  const field = fields.get(name);
  if (!field) {
    throw new Error(`Field not found in runtime field map: ${name}`);
  }
  return field;
}

function resolveEnumCaseId(field: FramerField, raw: string): string {
  if (field.type !== "enum") return raw;
  const cases = field.cases ?? [];
  const direct = cases.find((c) => c.id === raw);
  if (direct) return direct.id;
  const byName = cases.find((c) => c.name.toLowerCase() === raw.toLowerCase());
  if (byName) return byName.id;
  if (cases.length === 0) return raw;
  return cases[0]?.id ?? raw;
}

function fieldId(fields: Map<string, FramerField>, name: string): string {
  const field = fields.get(name);
  if (!field) {
    throw new Error(`Field not found in runtime field map: ${name}`);
  }
  return field.id;
}

function value(type: string, rawValue: unknown): FieldValue {
  return { type, value: rawValue };
}
