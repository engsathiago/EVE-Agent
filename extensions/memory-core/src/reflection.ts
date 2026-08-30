// Structured reflection records make completed work durable and searchable.
import fs from "node:fs/promises";
import path from "node:path";

export type StructuredReflectionInput = {
  delivered?: string;
  quality?: string;
  next?: string;
  lesson?: string;
  now?: Date;
};

export type StructuredReflectionResult = {
  path: string;
  recordedAt: string;
  fields: string[];
};

function normalizeReflectionField(value: string | undefined, label: string): string | undefined {
  const normalized = value?.replace(/\s+/gu, " ").trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.length > 4000) {
    throw new Error(`${label} must be at most 4000 characters.`);
  }
  return normalized;
}

/** Append one atomic reflection section to the agent's daily memory file. */
export async function appendStructuredReflection(
  workspaceDir: string,
  input: StructuredReflectionInput,
): Promise<StructuredReflectionResult> {
  const delivered = normalizeReflectionField(input.delivered, "delivered");
  const quality = normalizeReflectionField(input.quality, "quality");
  const next = normalizeReflectionField(input.next, "next");
  const lesson = normalizeReflectionField(input.lesson, "lesson");
  const fields = [
    delivered ? `- Delivered: ${delivered}` : undefined,
    quality ? `- Quality: ${quality}` : undefined,
    next ? `- Next: ${next}` : undefined,
    lesson ? `- Lesson: ${lesson}` : undefined,
  ].filter((entry): entry is string => Boolean(entry));
  if (fields.length === 0) {
    throw new Error("reflection requires at least one of delivered, quality, next, or lesson.");
  }

  const now = input.now ?? new Date();
  const recordedAt = now.toISOString();
  const dailyPath = path.join(workspaceDir, "memory", `${recordedAt.slice(0, 10)}.md`);
  await fs.mkdir(path.dirname(dailyPath), { recursive: true, mode: 0o700 });
  const handle = await fs.open(dailyPath, "a", 0o600);
  try {
    await handle.appendFile(`\n## Reflection — ${recordedAt}\n\n${fields.join("\n")}\n`, "utf8");
  } finally {
    await handle.close();
  }
  return { path: dailyPath, recordedAt, fields };
}
