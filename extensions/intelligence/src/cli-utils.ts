import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { EveFlowDefinition, JsonObject } from "./types.js";

export type JsonOption = { json?: boolean };

export function writeValue(value: unknown, options: JsonOption = {}): void {
  if (options.json || typeof value !== "string") {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${value}\n`);
}

export function parseObject(value: string | undefined, label = "JSON"): JsonObject {
  if (!value) {
    return {};
  }
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be an object`);
  }
  return parsed as JsonObject;
}

export function parseStringList(value: string | undefined): string[] {
  return (
    value
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}

export function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function readFlowDefinition(filePath: string): EveFlowDefinition {
  const target = path.resolve(filePath);
  const source = fs.readFileSync(target, "utf8");
  const value =
    path.extname(target).toLowerCase() === ".json" ? JSON.parse(source) : parseYaml(source);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`invalid flow definition: ${target}`);
  }
  return value as EveFlowDefinition;
}

export function writeStarterFlow(filePath: string, overwrite = false): JsonObject {
  const target = path.resolve(filePath);
  if (fs.existsSync(target) && !overwrite) {
    throw new Error(`flow file already exists: ${target}`);
  }
  const definition: EveFlowDefinition = {
    name: "research-and-report",
    description: "Durable EVE flow with an operator review checkpoint.",
    steps: [
      {
        id: "research",
        type: "agent",
        prompt: "Research and organize information about: {{input.topic}}",
      },
      {
        id: "review",
        type: "wait",
        needs: ["research"],
        value: "Review the research before the report.",
      },
      {
        id: "report",
        type: "agent",
        needs: ["review"],
        prompt: "Create a report using: {{steps.research.output}}",
      },
    ],
  };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    target,
    path.extname(target).toLowerCase() === ".json"
      ? `${JSON.stringify(definition, null, 2)}\n`
      : stringifyYaml(definition),
    "utf8",
  );
  return { path: target, definition };
}
