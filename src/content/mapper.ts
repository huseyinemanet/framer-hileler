import type { FramerField } from "../framer/collections.js";
import type { NormalizedCheatContent } from "./types.js";

type FieldValue = { type: string; value: unknown };

export interface CheatFieldMappingInput {
  content: NormalizedCheatContent;
  hacksFieldsByName: Map<string, FramerField>;
  gameReferenceSlug: string;
  errorMessage?: string;
}

export function mapCheatToFramerFieldData(
  input: CheatFieldMappingInput
): Record<string, FieldValue> {
  const { content, hacksFieldsByName, gameReferenceSlug, errorMessage } = input;
  const warningsText = content.warnings.join("\n");
  const internalHintsText = content.internalLinkHints.join("\n");

  const fieldData: Record<string, FieldValue> = {
    [fieldId(hacksFieldsByName, "Title")]: value("string", content.title),
    [fieldId(hacksFieldsByName, "Thumbnail")]: value(
      "image",
      content.thumbnailUrl ?? ""
    ),
    [fieldId(hacksFieldsByName, "Game")]: value(
      "collectionReference",
      gameReferenceSlug
    ),
    [fieldId(hacksFieldsByName, "Content Type")]: value(
      "string",
      content.contentType
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
    [fieldId(hacksFieldsByName, "Status")]: value("string", content.status),
    [fieldId(hacksFieldsByName, "AI Updated At")]: value(
      "string",
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
