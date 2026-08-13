// Memory Wiki plugin module implements vault behavior.
import fs from "node:fs/promises";
import path from "node:path";
import {
  replaceManagedMarkdownBlock,
  withTrailingNewline,
} from "eve-agent/plugin-sdk/memory-host-markdown";
import { FsSafeError, pathExists, root as fsRoot } from "eve-agent/plugin-sdk/security-runtime";
import type { ResolvedMemoryWikiConfig } from "./config.js";
import { appendMemoryWikiLog } from "./log.js";
import { WIKI_RAW_SOURCE_MARKER } from "./markdown.js";
import { resolveMemoryWikiTimestamp } from "./time.js";

export const WIKI_VAULT_DIRECTORIES = [
  "entities",
  "concepts",
  "syntheses",
  "sources",
  "reports",
  "_attachments",
  "_views",
  ".eve-wiki",
  ".eve-wiki/locks",
  ".eve-wiki/cache",
] as const;

type InitializeMemoryWikiVaultResult = {
  rootDir: string;
  created: boolean;
  createdDirectories: string[];
  createdFiles: string[];
};

function buildIndexMarkdown(): string {
  return withTrailingNewline(
    replaceManagedMarkdownBlock({
      original: "# Wiki Index\n",
      heading: "## Generated",
      startMarker: "<!-- eve:wiki:index:start -->",
      endMarker: "<!-- eve:wiki:index:end -->",
      body: "- No compiled pages yet.",
    }),
  );
}

function buildAgentsMarkdown(): string {
  return withTrailingNewline(`\
# Memory Wiki Agent Guide

- Treat generated blocks as plugin-owned.
- Preserve human notes outside managed markers.
- Prefer source-backed claims over wiki-to-wiki citation loops.
- Prefer structured \`claims\` with evidence over burying key beliefs only in prose.
- Use \`.eve-wiki/cache/agent-digest.json\` and \`claims.jsonl\` for machine reads; markdown pages are the human view.
`);
}

function buildWikiOverviewMarkdown(config: ResolvedMemoryWikiConfig): string {
  return withTrailingNewline(`\
# Memory Wiki

This vault is maintained by the EVE memory-wiki plugin.

- Vault mode: \`${config.vaultMode}\`
- Render mode: \`${config.vault.renderMode}\`
- Search corpus default: \`${config.search.corpus}\`

## Architecture
- Raw sources remain the evidence layer.
- To keep unmanaged raw Markdown in \`sources/\`, add \`${WIKI_RAW_SOURCE_MARKER}\` near the top of the page.
- Wiki pages are the human-readable synthesis layer.
- \`.eve-wiki/cache/agent-digest.json\` is the agent-facing compiled digest.

## Notes
<!-- eve:human:start -->
<!-- eve:human:end -->
`);
}

async function writeFileIfMissing(
  rootDir: string,
  relativePath: string,
  content: string,
  createdFiles: string[],
): Promise<void> {
  const root = await fsRoot(rootDir);
  try {
    await root.create(relativePath, content);
  } catch (err) {
    if (err instanceof FsSafeError && err.code === "already-exists") {
      return;
    }
    throw err;
  }
  createdFiles.push(path.join(rootDir, relativePath));
}

export async function initializeMemoryWikiVault(
  config: ResolvedMemoryWikiConfig,
  options?: { nowMs?: number },
): Promise<InitializeMemoryWikiVaultResult> {
  const rootDir = config.vault.path;
  const createdDirectories: string[] = [];
  const createdFiles: string[] = [];

  if (!(await pathExists(rootDir))) {
    createdDirectories.push(rootDir);
  }
  await fs.mkdir(rootDir, { recursive: true });

  for (const relativeDir of WIKI_VAULT_DIRECTORIES) {
    const fullPath = path.join(rootDir, relativeDir);
    if (!(await pathExists(fullPath))) {
      createdDirectories.push(fullPath);
    }
    await fs.mkdir(fullPath, { recursive: true });
  }

  await writeFileIfMissing(rootDir, "AGENTS.md", buildAgentsMarkdown(), createdFiles);
  await writeFileIfMissing(rootDir, "WIKI.md", buildWikiOverviewMarkdown(config), createdFiles);
  await writeFileIfMissing(rootDir, "index.md", buildIndexMarkdown(), createdFiles);
  await writeFileIfMissing(
    rootDir,
    "inbox.md",
    withTrailingNewline("# Inbox\n\nDrop raw ideas, questions, and source links here.\n"),
    createdFiles,
  );
  await writeFileIfMissing(
    rootDir,
    ".eve-wiki/state.json",
    withTrailingNewline(
      JSON.stringify(
        {
          version: 1,
          createdAt: resolveMemoryWikiTimestamp(options?.nowMs),
          renderMode: config.vault.renderMode,
        },
        null,
        2,
      ),
    ),
    createdFiles,
  );
  await writeFileIfMissing(rootDir, ".eve-wiki/log.jsonl", "", createdFiles);

  if (createdDirectories.length > 0 || createdFiles.length > 0) {
    await appendMemoryWikiLog(rootDir, {
      type: "init",
      timestamp: resolveMemoryWikiTimestamp(options?.nowMs),
      details: {
        createdDirectories: createdDirectories.map((dir) => path.relative(rootDir, dir) || "."),
        createdFiles: createdFiles.map((file) => path.relative(rootDir, file)),
      },
    });
  }

  return {
    rootDir,
    created: createdDirectories.length > 0 || createdFiles.length > 0,
    createdDirectories,
    createdFiles,
  };
}
